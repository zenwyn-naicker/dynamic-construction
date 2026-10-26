import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { prefersReducedMotion, useInView } from "./hooks";
import {
  clamp,
  ease,
  fit,
  type Camera,
  type Item,
  type P2,
} from "./drawing/geometry";
import { SCENES, type Handle } from "./drawing/scenes";
import { metres, type ProjectType, type Size } from "./projectTypes";

/** Replays the build from a stage (0–3) whenever `key` changes. */
export type Replay = { key: number; from: number };

const STAGE_MS = 650;
const points = (list: P2[]) =>
  list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const outline = (rings: P2[][]) =>
  rings
    .map(
      (ring) =>
        "M" +
        ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") +
        "Z",
    )
    .join("");

// The build always plays; with reduced motion the scenes fade pieces in
// instead of letting them fall, so the sequence still reads.
function useBuild({ key, from }: Replay, active: boolean) {
  const [progress, setProgress] = useState(from);
  const played = useRef<number>(undefined);
  useEffect(() => {
    if (played.current === key) return;
    // Holds the first frame until the drawing is on screen.
    if (!active) return setProgress(from);
    played.current = key;
    const start = performance.now();
    const span = (4 - from) * STAGE_MS;
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / span);
      setProgress(from + (4 - from) * t);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      setProgress(4);
    };
  }, [key, from, active]);
  return progress;
}

/** Eases between framings as sizes change; holds still while a handle is dragged. */
function useCamera(target: Camera | undefined, hold: boolean) {
  const [camera, setCamera] = useState(target);
  const shown = useRef(target);
  useEffect(() => {
    if (!target || hold) return;
    const from = shown.current;
    if (!from || prefersReducedMotion()) {
      shown.current = target;
      return setCamera(target);
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = ease((now - start) / 220);
      shown.current = {
        k: from.k + (target.k - from.k) * t,
        ox: from.ox + (target.ox - from.ox) * t,
        oy: from.oy + (target.oy - from.oy) * t,
      };
      setCamera(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target?.k, target?.ox, target?.oy, hold]);
  return camera;
}

function Shape({ item }: { item: Item }) {
  switch (item.kind) {
    case "poly":
      return (
        <polygon
          points={points(item.points)}
          fill={item.fill}
          stroke={item.stroke}
          strokeWidth={item.width}
          opacity={item.opacity}
        />
      );
    case "ring":
      return (
        <path
          d={outline([item.outer, item.inner])}
          fill={item.fill}
          fillRule="evenodd"
          opacity={item.opacity}
        />
      );
    case "line":
      return (
        <line
          x1={item.from[0]}
          y1={item.from[1]}
          x2={item.to[0]}
          y2={item.to[1]}
          stroke={item.stroke}
          strokeWidth={item.width}
          strokeDasharray={item.dash}
          strokeLinecap="round"
          opacity={item.opacity}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={item.at[0]}
          cy={item.at[1]}
          rx={item.rx}
          ry={item.ry}
          fill={item.fill}
        />
      );
    case "text": {
      const [x, y] = item.at;
      return (
        <text
          className={"build-" + item.role}
          x={x}
          y={y}
          dy={item.dy}
          textAnchor={item.anchor}
          transform={item.angle ? `rotate(${item.angle} ${x} ${y})` : undefined}
        >
          {item.text}
        </text>
      );
    }
    case "group":
      return (
        <g
          opacity={item.opacity}
          transform={item.dy ? `translate(0 ${item.dy.toFixed(1)})` : undefined}
          clipPath={item.clip ? `url(#${item.clip})` : undefined}
        >
          {item.items.map((child, index) => (
            <Shape key={index} item={child} />
          ))}
        </g>
      );
  }
}

export default function BuildDrawing({
  type,
  size,
  replay,
  compact = false,
  paused = false,
  onSize,
}: {
  type: ProjectType;
  size: Size;
  replay: Replay;
  compact?: boolean;
  paused?: boolean;
  /** Turns on the drag handles. */
  onSize?: (size: Size) => void;
}) {
  const scene = SCENES[type.id];
  const id = "build" + useId().replace(/[^\w-]/g, "");
  const board = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<[number, number]>();
  const visible = useInView(board);
  const progress = useBuild(replay, visible && !paused);
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Size }>(
    null,
  );
  const [holding, setHolding] = useState(false);
  const camera = useCamera(
    area &&
      fit(
        scene.bounds(size),
        area[0],
        area[1],
        compact ? [14, 14, 14, 14] : [22, 22, 22, 22],
        compact ? 36 : 64,
      ),
    holding,
  );

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setArea([Math.round(width), Math.round(height)]);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function grab(handle: Handle, event: PointerEvent<SVGGElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { handle, x: event.clientX, y: event.clientY, start: size };
    setHolding(true);
  }

  function pull(event: PointerEvent<SVGGElement>) {
    const current = drag.current;
    const svg = event.currentTarget.ownerSVGElement;
    if (!current || !onSize || !area || !svg) return;
    const scale = area[0] / svg.getBoundingClientRect().width;
    const [ax, ay] = current.handle.axis;
    const metresMoved =
      ((event.clientX - current.x) * scale * ax +
        (event.clientY - current.y) * scale * ay) /
      (ax * ax + ay * ay);
    const { key } = current.handle;
    const dimension = type[key]!;
    onSize({
      ...current.start,
      [key]: clamp(
        Math.round((current.start[key] + metresMoved) * 20) / 20,
        dimension.min,
        dimension.max,
      ),
    });
  }

  function release() {
    drag.current = null;
    setHolding(false);
  }

  const output =
    area && camera
      ? scene.draw({
          size,
          progress,
          camera,
          id,
          motion: !prefersReducedMotion(),
        })
      : undefined;
  const stage = Math.min(3, Math.floor(progress));
  const description = type.length
    ? `Illustration of a ${type.label.toLowerCase()} ${metres(size.length)} long and ${metres(size.width)} ${type.id === "Boundary wall" ? "high" : "wide"}`
    : "Illustration of a custom project being measured on site";

  return (
    <div className={"build-board" + (compact ? " compact" : "")} ref={board}>
      {area && output && (
        <svg
          viewBox={`0 0 ${area[0]} ${area[1]}`}
          role="img"
          aria-label={description}
        >
          <defs>
            {output.patterns?.map((pattern) => (
              <pattern
                key={pattern.id}
                id={pattern.id}
                patternUnits="userSpaceOnUse"
                width={pattern.width}
                height={pattern.height}
                patternTransform={pattern.transform}
              >
                {pattern.bricks.map((brick, index) => (
                  <rect key={index} {...brick} />
                ))}
              </pattern>
            ))}
            {output.clips?.map((clip) => (
              <clipPath key={clip.id} id={clip.id}>
                <polygon points={points(clip.points)} />
              </clipPath>
            ))}
          </defs>
          {output.items.map((item, index) => (
            <Shape key={index} item={item} />
          ))}
          {onSize &&
            output.handles?.map((handle) => (
              <g
                key={handle.key}
                className="build-handle"
                transform={`translate(${handle.at[0].toFixed(1)} ${handle.at[1].toFixed(1)})`}
                aria-hidden="true"
                onPointerDown={(event) => grab(handle, event)}
                onPointerMove={pull}
                onPointerUp={release}
                onPointerCancel={release}
              >
                <circle className="build-handle-hit" r="18" />
                <circle className="build-handle-ring" r="12" />
                <circle className="build-handle-knob" r="7" />
              </g>
            ))}
        </svg>
      )}
      <span className="build-note" aria-hidden="true">
        Illustration
      </span>
      <span
        className={"build-stage" + (progress < 4 ? "" : " finished")}
        aria-hidden="true"
      >
        {String(stage + 1).padStart(2, "0")} {scene.stages[stage]}
      </span>
    </div>
  );
}
