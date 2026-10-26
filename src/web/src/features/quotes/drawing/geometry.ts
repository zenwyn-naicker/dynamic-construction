export type P2 = [number, number];
export type P3 = [number, number, number];
export type Camera = { k: number; ox: number; oy: number };
export type Project = (x: number, y: number, z?: number) => P2;
export type Tone = { top: string; left: string; right: string };

export type Item =
  | {
      kind: "poly";
      points: P2[];
      fill: string;
      stroke?: string;
      width?: number;
      opacity?: number;
    }
  | { kind: "ring"; outer: P2[]; inner: P2[]; fill: string; opacity?: number }
  | {
      kind: "line";
      from: P2;
      to: P2;
      stroke: string;
      width: number;
      opacity?: number;
      dash?: string;
    }
  | { kind: "ellipse"; at: P2; rx: number; ry: number; fill: string }
  | {
      kind: "text";
      at: P2;
      text: string;
      angle?: number;
      dy?: number;
      anchor?: "start" | "middle";
      role: "dim" | "label";
    }
  | {
      kind: "group";
      items: Item[];
      opacity?: number;
      dy?: number;
      clip?: string;
    };

export type Pattern = {
  id: string;
  transform: string;
  width: number;
  height: number;
  bricks: {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
  }[];
};

export type Clip = { id: string; points: P2[] };

// Isometric projection in metres: x runs down-right, y down-left, z up.
export const COS = Math.cos(Math.PI / 6);
export const SIN = 0.5;

export const projector =
  ({ k, ox, oy }: Camera): Project =>
  (x, y, z = 0) => [ox + (x - y) * COS * k, oy + (x + y) * SIN * k - z * k];

/** Scales and centres the points inside a board, padded [top, right, bottom, left]. */
export function fit(
  points: P3[],
  width: number,
  height: number,
  pad: [number, number, number, number],
  maxScale: number,
): Camera {
  const unit = projector({ k: 1, ox: 0, oy: 0 });
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const point of points) {
    const [x, y] = unit(...point);
    [x0, x1, y0, y1] = [
      Math.min(x0, x),
      Math.max(x1, x),
      Math.min(y0, y),
      Math.max(y1, y),
    ];
  }
  const k = Math.min(
    (width - pad[1] - pad[3]) / (x1 - x0),
    (height - pad[0] - pad[2]) / (y1 - y0),
    maxScale,
  );
  return {
    k,
    ox: pad[3] + (width - pad[1] - pad[3]) / 2 - (k * (x0 + x1)) / 2,
    oy: pad[0] + (height - pad[0] - pad[2]) / 2 - (k * (y0 + y1)) / 2,
  };
}

export const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
export const ease = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;

/** Progress of one step inside the 0–4 build, starting at `start`. */
export const phase = (progress: number, start: number, length = 1) =>
  clamp((progress - start) / length, 0, 1);

export function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function shade(hex: string, amount: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16))
      .map((v) => (amount >= 0 ? v + (255 - v) * amount : v * (1 + amount)))
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

export const tone = (base: string, top = 0.1, right = -0.2): Tone => ({
  top: shade(base, top),
  left: base,
  right: shade(base, right),
});

/** The three visible faces of a box: left is the y-far face, right the x-far face. */
export function faces(P: Project, [x, y, z]: P3, [dx, dy, dz]: P3) {
  const [x1, y1, z1] = [x + dx, y + dy, z + dz];
  return {
    left: [P(x, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x, y1, z1)],
    right: [P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1)],
    top: [P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)],
  };
}

export function box(
  P: Project,
  origin: P3,
  extent: P3,
  colours: Tone,
  opacity?: number,
): Item {
  if (extent.some((n) => n <= 0)) return { kind: "group", items: [] };
  const f = faces(P, origin, extent);
  return {
    kind: "group",
    opacity,
    items: [
      { kind: "poly", points: f.left, fill: colours.left },
      { kind: "poly", points: f.right, fill: colours.right },
      { kind: "poly", points: f.top, fill: colours.top },
    ],
  };
}

export const rect = (
  P: Project,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z = 0,
): P2[] => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];

export const ground = (
  P: Project,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Item => ({
  kind: "poly",
  points: rect(P, x0, y0, x1, y1),
  fill: "#ece5d8",
  stroke: "#ddd3c4",
  width: 1,
});

// Pattern transforms map face coordinates (along, up) in metres onto a plane.
export const frontPlane = ({ k, ox, oy }: Camera, y: number) =>
  `matrix(${COS * k} ${SIN * k} 0 ${-k} ${ox - y * COS * k} ${oy + y * SIN * k})`;
export const sidePlane = ({ k, ox, oy }: Camera, x: number) =>
  `matrix(${-COS * k} ${SIN * k} 0 ${-k} ${ox + x * COS * k} ${oy + x * SIN * k})`;

export const COURSE = 0.086;
const BRICK = 0.232;

/** Running-bond brickwork: 222 mm bricks in 86 mm courses with 10 mm joints. */
export function brickwork(
  id: string,
  transform: string,
  colours: string[],
  mortar: string,
): Pattern {
  const brick = (x: number, row: number, fill: string) => ({
    x: x + 0.005,
    y: row * COURSE + 0.005,
    width: BRICK - 0.01,
    height: COURSE - 0.01,
    fill,
  });
  return {
    id,
    transform,
    width: BRICK * 2,
    height: COURSE * 2,
    bricks: [
      { x: 0, y: 0, width: BRICK * 2, height: COURSE * 2, fill: mortar },
      brick(0, 0, colours[0]),
      brick(BRICK, 0, colours[1]),
      brick(-BRICK / 2, 1, colours[2]),
      brick(BRICK / 2, 1, colours[3]),
      brick(BRICK * 1.5, 1, colours[2]),
    ],
  };
}

/** A 1.78 m person for scale. */
export function person(P: Project, k: number, x: number, y: number): Item[] {
  const [bx, by] = P(x, y);
  const outline: P2[] = [
    [-0.2, -1.48],
    [0.2, -1.48],
    [0.23, -0.76],
    [0.13, -0.76],
    [0.11, 0],
    [-0.01, 0],
    [-0.04, -0.6],
    [-0.07, 0],
    [-0.19, 0],
    [-0.21, -0.76],
    [-0.31, -0.76],
  ];
  return [
    {
      kind: "ellipse",
      at: [bx, by],
      rx: 0.28 * k,
      ry: 0.12 * k,
      fill: "rgba(23,23,20,.12)",
    },
    {
      kind: "group",
      opacity: 0.82,
      items: [
        {
          kind: "ellipse",
          at: [bx - 0.04 * k, by - 1.66 * k],
          rx: 0.12 * k,
          ry: 0.12 * k,
          fill: "#2d302c",
        },
        {
          kind: "poly",
          points: outline.map(([u, v]) => [bx + u * k, by + v * k]),
          fill: "#2d302c",
        },
      ],
    },
  ];
}

const DIM = "#b63d20";
const tick = (from: P2, to: P2): Item => ({
  kind: "line",
  from,
  to,
  stroke: DIM,
  width: 1,
});

/** Dimension along x at depth y, labelled below the line. */
export function dimensionAlong(
  P: Project,
  x0: number,
  x1: number,
  y: number,
  label: string,
): Item[] {
  return [
    tick(P(x0, y), P(x1, y)),
    tick(P(x0, y - 0.16), P(x0, y + 0.16)),
    tick(P(x1, y - 0.16), P(x1, y + 0.16)),
    {
      kind: "text",
      at: P((x0 + x1) / 2, y + 0.05),
      text: label,
      angle: 30,
      dy: 16,
      anchor: "middle",
      role: "dim",
    },
  ];
}

/** Dimension along y at x, labelled below the line. */
export function dimensionAcross(
  P: Project,
  y0: number,
  y1: number,
  x: number,
  label: string,
): Item[] {
  return [
    tick(P(x, y0), P(x, y1)),
    tick(P(x - 0.16, y0), P(x + 0.16, y0)),
    tick(P(x - 0.16, y1), P(x + 0.16, y1)),
    {
      kind: "text",
      at: P(x + 0.05, (y0 + y1) / 2),
      text: label,
      angle: -30,
      dy: 16,
      anchor: "middle",
      role: "dim",
    },
  ];
}

/** Vertical dimension at (x, y), labelled to the right. */
export function dimensionUp(
  P: Project,
  x: number,
  y: number,
  z0: number,
  z1: number,
  label: string,
): Item[] {
  const [a, b] = [P(x, y, z0), P(x, y, z1)];
  return [
    tick(a, b),
    tick([a[0] - 5, a[1]], [a[0] + 5, a[1]]),
    tick([b[0] - 5, b[1]], [b[0] + 5, b[1]]),
    {
      kind: "text",
      at: [a[0] + 9, (a[1] + b[1]) / 2],
      text: label,
      dy: 4,
      anchor: "start",
      role: "dim",
    },
  ];
}
