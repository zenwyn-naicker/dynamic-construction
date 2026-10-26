import { metres, type ProjectTypeId, type Size } from "../projectTypes";
import {
  COS,
  COURSE,
  SIN,
  box,
  brickwork,
  clamp,
  dimensionAcross,
  dimensionAlong,
  dimensionUp,
  ease,
  faces,
  frontPlane,
  ground,
  person,
  phase,
  projector,
  random,
  rect,
  shade,
  sidePlane,
  tone,
  type Camera,
  type Clip,
  type Item,
  type P2,
  type P3,
  type Pattern,
} from "./geometry";

export type Handle = { key: keyof Size; at: P2; axis: P2 };
export type SceneInput = {
  size: Size;
  /** 0–4: how far through the four build stages the drawing is. */
  progress: number;
  camera: Camera;
  /** Prefix that keeps pattern and clip ids unique on the page. */
  id: string;
  /** False when reduced motion is asked for: pieces fade in rather than fall. */
  motion: boolean;
};
export type SceneOutput = {
  items: Item[];
  patterns?: Pattern[];
  clips?: Clip[];
  handles?: Handle[];
};
export type Scene = {
  stages: string[];
  bounds: (size: Size) => P3[];
  draw: (input: SceneInput) => SceneOutput;
};

const CONCRETE = tone("#c9c3b8");
const CEMENT_BRICKS = ["#a19b90", "#aca69b", "#968f85", "#a6a094"];
const CLAY_BRICKS = ["#a8573a", "#b4623f", "#9c4f36", "#ab5a3c"];
const PLASTER = "#d6d0c5";
const PAINT = "#f3efe7";
const TIMBER = "#a87b4f";
const STEEL = "#7d868c";

const lengthHandle = (at: P2, k: number): Handle => ({
  key: "length",
  at,
  axis: [COS * k, SIN * k],
});
const widthHandle = (at: P2, k: number): Handle => ({
  key: "width",
  at,
  axis: [-COS * k, SIN * k],
});

/** `count` evenly spaced values from `from` to `to`. */
const spread = (from: number, to: number, count: number) =>
  Array.from(
    { length: count },
    (_, i) => from + ((to - from) * i) / (count - 1),
  );

/** How far a piece still has to fall into place. */
const fall = (t: number, distance: number, motion: boolean) =>
  motion ? (1 - ease(t)) * distance : 0;

const WALL_THICKNESS = 0.23;

const wall: Scene = {
  stages: ["Strip foundation", "Brickwork", "Plaster", "Undercoat paint"],
  bounds: ({ length: L, width: H }) => {
    const T = WALL_THICKNESS;
    return [
      [-1, -1, 0],
      [L + 1, -1, 0],
      [L + 1, T + 1.6, 0],
      [-1, T + 1.6, 0],
      [0, 0, H + 0.05],
      [L, 0, H + 0.05],
      [0, T + 1.4, -0.6],
      [L + 1.2, T, H],
      [-0.8, T + 1, 1.9],
    ];
  },
  draw: ({ size: { length: L, width: H }, progress: p, camera, id }) => {
    const P = projector(camera);
    const { k } = camera;
    const T = WALL_THICKNESS;
    const items: Item[] = [ground(P, -1, -1, L + 1, T + 1.6)];
    const patterns: Pattern[] = [];
    items.push(
      box(
        P,
        [-0.2, -0.15, -0.03],
        [L + 0.4, T + 0.3, 0.06],
        CONCRETE,
        ease(phase(p, 0)),
      ),
    );
    // Brickwork rises a course at a time, then plaster and paint sweep along it.
    const height =
      p >= 2 ? H : Math.floor((H * ease(phase(p, 1))) / COURSE) * COURSE;
    const sweep = (stage: number) =>
      p >= stage + 1 ? L + 1 : (L + 0.5) * ease(phase(p, stage));
    const plastered = sweep(2);
    const painted = sweep(3);
    if (height > 0) {
      const f = faces(P, [0, 0, 0], [L, T, height]);
      const detailed = k * COURSE > 2.2;
      if (detailed)
        patterns.push(
          brickwork(
            `${id}-wall`,
            frontPlane(camera, T),
            CEMENT_BRICKS,
            "#cdc7bc",
          ),
        );
      items.push(
        {
          kind: "poly",
          points: rect(P, 0.15, -0.1, L + 0.5, T + 0.45),
          fill: "rgba(23,23,20,.08)",
          opacity: height / H,
        },
        {
          kind: "poly",
          points: f.left,
          fill: detailed ? `url(#${id}-wall)` : CEMENT_BRICKS[0],
        },
      );
      const face = (to: number, fill: string): Item => ({
        kind: "poly",
        points: [P(0, T, 0), P(to, T, 0), P(to, T, height), P(0, T, height)],
        fill,
      });
      const plaster = Math.min(L, plastered);
      const paint = Math.min(L, painted);
      if (plaster > 0) items.push(face(plaster, PLASTER));
      if (paint > 0) items.push(face(paint, PAINT));
      for (let x = 3; x < plaster - 0.3; x += 3)
        items.push({
          kind: "line",
          from: P(x, T, 0.02),
          to: P(x, T, height),
          stroke: "rgba(23,23,20,.14)",
          width: 1,
        });
      const finish =
        painted >= L ? PAINT : plastered >= L ? PLASTER : undefined;
      items.push(
        {
          kind: "poly",
          points: f.right,
          fill: finish ? shade(finish, -0.18) : "#8f897e",
        },
        {
          kind: "poly",
          points: f.top,
          fill: finish ? shade(finish, 0.05) : "#c9c2b5",
        },
      );
    }
    items.push(
      ...person(P, k, -0.75, T + 0.95),
      ...dimensionAlong(P, 0, L, T + 1.3, metres(L)),
      ...dimensionUp(P, L + 0.45, T, 0, H, metres(H)),
    );
    return {
      items,
      patterns,
      handles:
        p >= 4
          ? [
              lengthHandle(P(L, T, H / 2), k),
              { key: "width", at: P(L / 2, T, H), axis: [0, -k] },
            ]
          : [],
    };
  },
};

const SOFFIT = 2.4;
const DECK_DEPTH = 0.2;

/** A suspended concrete slab, cast on deck plates carried by scaffolding. */
const deck: Scene = {
  stages: [
    "Scaffolding",
    "Deck plates",
    "Steel reinforcement",
    "Concrete pour",
  ],
  bounds: ({ length: L, width: W }) => {
    const top = SOFFIT + DECK_DEPTH;
    return [
      [-1, -0.8, 0],
      [L + 0.8, -0.8, 0],
      [L + 0.8, W + 1.4, 0],
      [-1, W + 1.4, 0],
      [0, 0, top],
      [L, 0, top],
      [L, W, top],
      [0, W, top],
      [0, W + 1.1, -0.6],
      [L + 1.1, W, -0.6],
      [L + 1.6, 0, top],
      [-0.5, W + 1, 1.9],
    ];
  },
  draw: ({ size: { length: L, width: W }, progress: p, camera, motion }) => {
    const P = projector(camera);
    const { k } = camera;
    const [h, d] = [SOFFIT, DECK_DEPTH];
    const plated = phase(p, 1, 0.9);
    const items: Item[] = [
      ground(P, -1, -0.8, L + 0.8, W + 1.4),
      {
        kind: "poly",
        points: rect(P, 0.25, 0.25, L + 0.4, W + 0.4),
        fill: "rgba(23,23,20,.08)",
        opacity: plated,
      },
    ];
    // Props rise in turn from the back corner, then ledgers tie them together.
    const xs = spread(0.15, L - 0.15, clamp(Math.ceil(L / 1.2) + 1, 2, 14));
    const ys = spread(0.15, W - 0.15, clamp(Math.ceil(W / 1.2) + 1, 2, 12));
    const tube = Math.max(1, k * 0.045);
    const props = xs.flatMap((x) => ys.map((y): P2 => [x, y]));
    props.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    props.forEach(([x, y], i) => {
      const t = ease(phase(p, (i / props.length) * 0.6, 0.4));
      if (t > 0)
        items.push({
          kind: "line",
          from: P(x, y, 0),
          to: P(x, y, (h - 0.04) * t),
          stroke: STEEL,
          width: tube,
        });
    });
    const tied = phase(p, 0.75, 0.25);
    if (tied > 0) {
      const ledgers: Item[] = [];
      const ledger = (a: P3, b: P3): Item => ({
        kind: "line",
        from: P(...a),
        to: P(...b),
        stroke: STEEL,
        width: tube * 0.7,
      });
      for (const z of [1.2, h - 0.08]) {
        for (const y of ys)
          ledgers.push(ledger([xs[0], y, z], [xs.at(-1)!, y, z]));
        for (const x of xs)
          ledgers.push(ledger([x, ys[0], z], [x, ys.at(-1)!, z]));
      }
      items.push({ kind: "group", opacity: tied, items: ledgers });
    }
    // Deck plates are laid in strips from the back, then the steel mesh on top.
    const strips = Math.max(2, Math.ceil(W / 0.9));
    for (let i = 0; i < strips; i++) {
      const t = phase(p, 1 + (i / strips) * 0.7, 0.3);
      if (t > 0)
        items.push({
          kind: "group",
          dy: -fall(t, 12, motion),
          opacity: t,
          items: [
            {
              kind: "poly",
              points: rect(
                P,
                0,
                (i * W) / strips,
                L,
                ((i + 1) * W) / strips,
                h,
              ),
              fill: i % 2 ? "#a7b0b5" : "#aeb7bc",
              stroke: "rgba(23,23,20,.14)",
              width: 0.8,
            },
          ],
        });
    }
    const bar = Math.max(0.8, k * 0.018);
    const pitch = k * 0.3 >= 7 ? 0.3 : 0.6;
    const mesh = h + 0.07;
    const rebar = (from: P3, to: P3, t: number): Item => ({
      kind: "line",
      from: P(from[0], from[1], from[2] + fall(t, 0.5, motion)),
      to: P(to[0], to[1], to[2] + fall(t, 0.5, motion)),
      stroke: "#6f4b3a",
      width: bar,
      opacity: t,
    });
    const rows = spread(0.1, W - 0.1, Math.max(2, Math.round(W / pitch) + 1));
    const columns = spread(
      0.1,
      L - 0.1,
      Math.max(2, Math.round(L / pitch) + 1),
    );
    rows.forEach((y, i) => {
      const t = phase(p, 2 + (i / rows.length) * 0.4, 0.15);
      if (t > 0) items.push(rebar([0.05, y, mesh], [L - 0.05, y, mesh], t));
    });
    columns.forEach((x, i) => {
      const t = phase(p, 2.45 + (i / columns.length) * 0.4, 0.15);
      if (t > 0) items.push(rebar([x, 0.05, mesh], [x, W - 0.05, mesh], t));
    });
    // Concrete is poured from the back edge forward to its full depth.
    const poured = ease(phase(p, 3, 0.8));
    if (poured > 0) items.push(box(P, [0, 0, h], [L * poured, W, d], CONCRETE));
    const depth = phase(p, 3.75, 0.25);
    if (depth > 0)
      items.push({
        kind: "group",
        opacity: depth,
        items: dimensionUp(P, L + 0.15, 0, h, h + d, "200 mm"),
      });
    items.push(
      ...person(P, k, -0.5, W + 1),
      ...dimensionAlong(P, 0, L, W + 0.85, metres(L)),
      ...dimensionAcross(P, 0, W, L + 0.75, metres(W)),
    );
    return {
      items,
      handles:
        p >= 4
          ? [
              lengthHandle(P(L, W / 2, h + d), k),
              widthHandle(P(L / 2, W, h + d), k),
            ]
          : [],
    };
  },
};

const SURROUND = 1.1;
const RIM = 0.15;
const POOL_DEPTH = 1.3;

/** A gunite pool: dug, sprayed, marble plastered, then fitted with a pump and filled. */
const pool: Scene = {
  stages: ["Excavation", "Gunite shell", "Marble plaster", "Pump & fill"],
  bounds: ({ length: L, width: W }) => {
    const o = SURROUND;
    return [
      [-o - 0.3, -o - 0.2, 0],
      [L + o + 0.2, -o - 0.2, 0],
      [L + o + 0.2, W + o + 0.2, 0],
      [-o - 0.3, W + o + 0.2, 0],
      [0, 0, -POOL_DEPTH],
      [0, W + o + 0.5, -0.6],
      [L + o + 0.6, W, -0.6],
      [-o + 0.15, W + o - 0.25, 1.9],
    ];
  },
  draw: ({ size: { length: L, width: W }, progress: p, camera, motion }) => {
    const P = projector(camera);
    const { k } = camera;
    const [o, r, D] = [SURROUND, RIM, POOL_DEPTH];
    const walls = (z: number, floor: string, back: string, side: string) =>
      [
        { kind: "poly", points: rect(P, 0, 0, L, W, -D), fill: floor },
        {
          kind: "poly",
          points: [P(0, 0, z), P(0, W, z), P(0, W, -D), P(0, 0, -D)],
          fill: back,
        },
        {
          kind: "poly",
          points: [P(0, 0, z), P(L, 0, z), P(L, 0, -D), P(0, 0, -D)],
          fill: side,
        },
      ] satisfies Item[];
    // The pit is dug, sprayed with gunite, plastered, then filled; the
    // surrounds are drawn over its edges.
    const dug = D * ease(phase(p, 0));
    const items: Item[] = [
      { kind: "poly", points: rect(P, 0, 0, L, W, -dug), fill: "#9b7f62" },
      {
        kind: "poly",
        points: [P(0, 0, 0), P(0, W, 0), P(0, W, -dug), P(0, 0, -dug)],
        fill: "#a88b6c",
      },
      {
        kind: "poly",
        points: [P(0, 0, 0), P(L, 0, 0), P(L, 0, -dug), P(0, 0, -dug)],
        fill: "#b39678",
      },
    ];
    const shell = ease(phase(p, 1));
    if (shell > 0)
      items.push({
        kind: "group",
        opacity: Math.min(1, shell * 3),
        items: walls(-D + D * shell, "#b9b4ab", "#a9a49b", "#c3beb5"),
      });
    const plaster = ease(phase(p, 2, 0.9));
    if (plaster > 0)
      items.push({
        kind: "group",
        opacity: plaster,
        items: walls(0, "#e4eef1", "#d2e1e6", "#e9f1f3"),
      });
    const fill = ease(phase(p, 3.25, 0.75));
    if (fill > 0) {
      const level = -D + (D - 0.12) * fill;
      items.push({
        kind: "poly",
        points: rect(P, 0, 0, L, W, level),
        fill: "#4f9db5",
        opacity: 0.86,
      });
      const ripple = phase(p, 3.7, 0.3);
      for (const share of [0.3, 0.6])
        if (ripple > 0)
          items.push({
            kind: "line",
            from: P(L * 0.18, W * share, level),
            to: P(L * 0.52, W * share, level),
            stroke: "rgba(255,255,255,.6)",
            width: 1.5,
            opacity: ripple,
          });
    }
    items.push({
      kind: "ring",
      outer: rect(P, -o - 0.3, -o - 0.2, L + o + 0.2, W + o + 0.2),
      inner: rect(P, 0, 0, L, W),
      fill: "#ece5d8",
    });
    // The top of the gunite shell finishes the edge.
    const rim = phase(p, 1.6, 0.4);
    if (rim > 0)
      items.push({
        kind: "ring",
        outer: rect(P, -r, -r, L + r, W + r),
        inner: rect(P, 0, 0, L, W),
        fill: "#cbc5bb",
        opacity: rim,
      });
    // The pump drops in beside the pool, piped to the shell.
    const pump = phase(p, 3, 0.3);
    if (pump > 0)
      items.push({
        kind: "group",
        dy: -fall(pump, 12, motion),
        opacity: pump,
        items: [
          {
            kind: "line",
            from: P(L + 0.4, 0.45),
            to: P(L + r, 0.45),
            stroke: "#4a5257",
            width: Math.max(1, k * 0.04),
          },
          box(P, [L + 0.4, 0.25, 0], [0.5, 0.4, 0.35], tone("#5f6b71")),
        ],
      });
    items.push(
      ...person(P, k, -o + 0.45, W + o - 0.3),
      ...dimensionAlong(P, 0, L, W + o + 0.3, metres(L)),
      ...dimensionAcross(P, 0, W, L + o + 0.3, metres(W)),
    );
    return {
      items,
      handles:
        p >= 4
          ? [
              lengthHandle(P(L + r / 2, W / 2), k),
              widthHandle(P(L / 2, W + r / 2), k),
            ]
          : [],
    };
  },
};

const SLAB = 0.15;
const ROOM_HEIGHT = 2.6;
const OVERHANG = 0.3;
const roofRise = (length: number) => clamp(length * 0.28, 0.8, 2);

const room: Scene = {
  stages: ["Foundations", "Walls", "Roof & ceiling", "Plaster & paint"],
  bounds: ({ length: L, width: W }) => [
    [-1, -3.2, 0],
    [L + 1, -3.2, 0],
    [L + 1, W + 1.3, 0],
    [-1, W + 1.3, 0],
    [-0.8, -3, 3],
    [L + 0.8, -3, 3],
    [L / 2, W + OVERHANG, SLAB + ROOM_HEIGHT + roofRise(L)],
    [0, W + 1.2, -0.6],
    [L + 1.2, W, -0.6],
    [-0.6, W + 0.9, 1.9],
  ],
  draw: ({
    size: { length: L, width: W },
    progress: p,
    camera,
    id,
    motion,
  }) => {
    const P = projector(camera);
    const { k } = camera;
    const [s, T, o] = [SLAB, WALL_THICKNESS, OVERHANG];
    const eave = s + ROOM_HEIGHT;
    const rise = roofRise(L);
    const apex = eave + rise;
    const roofZ = (x: number) => apex - Math.abs(x - L / 2) * (rise / (L / 2));
    const items: Item[] = [
      ground(P, -1, -3.2, L + 1, W + 1.3),
      box(P, [-0.8, -3, 0], [L + 1.6, 3, 3], tone("#dcd5ca", 0.08, -0.12)),
      {
        kind: "text",
        at: P(L + 0.8, -0.4, 2.55),
        text: "EXISTING",
        angle: -30,
        anchor: "start",
        role: "label",
      },
      box(
        P,
        [-0.05, 0, 0],
        [L + 0.1, W + 0.05, s],
        CONCRETE,
        ease(phase(p, 0)),
      ),
    ];
    const patterns: Pattern[] = [];
    const detailed = k * COURSE > 2.2;
    const front = detailed ? `url(#${id}-front)` : CLAY_BRICKS[0];
    if (detailed)
      patterns.push(
        brickwork(`${id}-front`, frontPlane(camera, W), CLAY_BRICKS, "#d8cbb8"),
        brickwork(`${id}-side`, sidePlane(camera, L), CLAY_BRICKS, "#d8cbb8"),
      );
    // Walls rise course by course; the door and window appear as they are reached.
    // Plaster and paint later cover the brickwork.
    const paint = ease(phase(p, 3, 0.9));
    const painted = (points: P2[], fill: string): Item => ({
      kind: "poly",
      points,
      fill,
      opacity: paint,
    });
    const height =
      p >= 2
        ? ROOM_HEIGHT
        : Math.floor((ROOM_HEIGHT * ease(phase(p, 1))) / COURSE) * COURSE;
    if (height > 0) {
      const top = "#c4825f";
      const left = faces(P, [0, 0, s], [T, W - T, height]);
      const right = faces(P, [L - T, 0, s], [T, W - T, height]);
      const ahead = faces(P, [0, W - T, s], [L, T, height]);
      items.push(
        { kind: "poly", points: left.right, fill: "#b97a5c" },
        painted(left.right, shade(PAINT, -0.12)),
        { kind: "poly", points: left.top, fill: top },
        {
          kind: "poly",
          points: right.right,
          fill: detailed ? `url(#${id}-side)` : CLAY_BRICKS[2],
        },
        painted(right.right, shade(PAINT, -0.16)),
        { kind: "poly", points: right.top, fill: top },
      );
      const doorTop = Math.min(s + 2.1, s + height);
      if (W >= 1.6 && doorTop > s + 0.2)
        items.push({
          kind: "poly",
          points: [
            P(L, W / 2 - 0.45, s),
            P(L, W / 2 + 0.45, s),
            P(L, W / 2 + 0.45, doorTop),
            P(L, W / 2 - 0.45, doorTop),
          ],
          fill: "#5b3a29",
          stroke: "#efe7da",
          width: 1.5,
        });
      items.push(
        { kind: "poly", points: ahead.left, fill: front },
        painted(ahead.left, PAINT),
        { kind: "poly", points: ahead.right, fill: "#8e4a33" },
        painted(ahead.right, shade(PAINT, -0.16)),
        { kind: "poly", points: ahead.top, fill: top },
      );
      const half = Math.min(0.8, L * 0.2);
      const sill = s + 0.9;
      const head = Math.min(s + 2, s + height);
      if (L >= 2.2 && head > sill)
        items.push({
          kind: "poly",
          points: [
            P(L / 2 - half, W, sill),
            P(L / 2 + half, W, sill),
            P(L / 2 + half, W, head),
            P(L / 2 - half, W, head),
          ],
          fill: "#a9cbd6",
          stroke: "#efe7da",
          width: 2,
        });
    }
    // Trusses drop in from the back, then tiles are laid from eave to ridge.
    const spans = Math.max(2, Math.ceil(W / 0.6));
    const timber = Math.max(1, k * 0.035);
    for (let i = 0; i <= spans; i++) {
      const y = 0.05 + (i * (W - 0.1)) / spans;
      const t = phase(p, 2 + (i / spans) * 0.3, 0.15);
      const line = (a: P3, b: P3, width = timber): Item => ({
        kind: "line",
        from: P(...a),
        to: P(...b),
        stroke: TIMBER,
        width,
      });
      if (t > 0)
        items.push({
          kind: "group",
          dy: -fall(t, 10, motion),
          opacity: t,
          items: [
            line([-o, y, roofZ(-o)], [L / 2, y, apex]),
            line([L / 2, y, apex], [L + o, y, roofZ(L + o)]),
            line([0, y, eave], [L, y, eave]),
            line([L / 2, y, eave], [L / 2, y, apex], timber * 0.8),
          ],
        });
    }
    const gable = phase(p, 2, 0.3);
    if (gable > 0) {
      const points = [P(0, W, eave), P(L, W, eave), P(L / 2, W, apex)];
      items.push(
        { kind: "poly", points, fill: front, opacity: gable },
        painted(points, PAINT),
      );
    }
    const rows = Math.max(4, Math.round(Math.hypot(L / 2 + o, rise) / 0.32));
    const tiles = (from: number, start: number, colours: [string, string]) => {
      for (let r = 0; r < rows; r++) {
        const a = from + ((L / 2 - from) * r) / rows;
        const b = from + ((L / 2 - from) * (r + 1)) / rows;
        const t = phase(p, start + (r / rows) * 0.22, 0.08);
        if (t > 0)
          items.push({
            kind: "poly",
            points: [
              P(a, 0, roofZ(a)),
              P(b, 0, roofZ(b)),
              P(b, W + o, roofZ(b)),
              P(a, W + o, roofZ(a)),
            ],
            fill: colours[r % 2],
            opacity: t,
          });
      }
    };
    tiles(-o, 2.45, ["#963f28", "#a0462d"]);
    tiles(L + o, 2.7, ["#b4533a", "#bd5d42"]);
    const ridge = phase(p, 2.95, 0.05);
    if (ridge > 0)
      items.push({
        kind: "line",
        from: P(L / 2, 0, apex),
        to: P(L / 2, W + o, apex),
        stroke: "#7b3220",
        width: 2,
        opacity: ridge,
      });
    items.push(
      ...person(P, k, -0.6, W + 0.9),
      ...dimensionAlong(P, 0, L, W + 0.9, metres(L)),
      ...dimensionAcross(P, 0, W, L + 0.8, metres(W)),
    );
    return {
      items,
      patterns,
      handles:
        p >= 4
          ? [lengthHandle(P(L, W / 2, s), k), widthHandle(P(L / 2, W, s), k)]
          : [],
    };
  },
};

const brief: Scene = {
  stages: ["Your brief", "Site visit", "Measured scope", "Formal quotation"],
  bounds: () => [
    [-1, -1, 0],
    [5, -1, 0],
    [5, 4, 0],
    [-1, 4, 0],
    [0, 0, 3.6],
    [4, 0, 3.6],
    [2.6, 4.2, -0.4],
    [-0.6, 3.6, 1.9],
  ],
  draw: ({ progress: p, camera }) => {
    const P = projector(camera);
    const items: Item[] = [ground(P, -1, -1, 5, 4)];
    // A house outline sketches itself, as if measured up on site.
    const plan: P2[] = [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3],
    ];
    const [h, ridge] = [2.4, 3.5];
    const edges: [P3, P3, boolean?][] = [];
    plan.forEach(([x, y], i) => {
      const [nx, ny] = plan[(i + 1) % 4];
      edges.push(
        [[x, y, 0], [nx, ny, 0], true],
        [
          [x, y, h],
          [nx, ny, h],
        ],
        [
          [x, y, 0],
          [x, y, h],
        ],
      );
    });
    edges.push(
      [
        [0, 1.5, ridge],
        [4, 1.5, ridge],
      ],
      [
        [0, 0, h],
        [0, 1.5, ridge],
      ],
      [
        [0, 3, h],
        [0, 1.5, ridge],
      ],
      [
        [4, 0, h],
        [4, 1.5, ridge],
      ],
      [
        [4, 3, h],
        [4, 1.5, ridge],
      ],
      [
        [1.6, 3, 0],
        [1.6, 3, 2.05],
      ],
      [
        [2.5, 3, 0],
        [2.5, 3, 2.05],
      ],
      [
        [1.6, 3, 2.05],
        [2.5, 3, 2.05],
      ],
    );
    edges.forEach(([a, b, outline], i) => {
      const t = ease(phase(p, (i / edges.length) * 3, 0.5));
      if (t > 0)
        items.push({
          kind: "line",
          from: P(...a),
          to: P(
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
          ),
          stroke: "#b63d20",
          width: 1.6,
          dash: outline ? "5 5" : undefined,
        });
    });
    const tag = phase(p, 3.2, 0.5);
    if (tag > 0)
      items.push({
        kind: "group",
        opacity: tag,
        items: [
          {
            kind: "text",
            at: P(2.6, 3.6),
            text: "MEASURED ON SITE",
            dy: 18,
            anchor: "middle",
            role: "label",
          },
        ],
      });
    items.push(...person(P, camera.k, -0.6, 3.6));
    return { items };
  },
};

export const SCENES: Record<ProjectTypeId, Scene> = {
  "Boundary wall": wall,
  Deck: deck,
  Pool: pool,
  "Room addition": room,
  Other: brief,
};
