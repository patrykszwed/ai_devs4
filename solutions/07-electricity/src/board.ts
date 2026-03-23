import { PNG } from "pngjs";

export type CellState = "U" | "R" | "D" | "L" | "UR" | "UD" | "UL" | "RD" | "RL" | "DL" | "URD" | "URL" | "UDL" | "RDL";
export type BoardState = CellState[][];

type PngImage = PNG & {
  width: number;
  height: number;
  data: Buffer;
};

type Grid = {
  xs: number[];
  ys: number[];
};

type RotationPlanItem = {
  cell: `${1 | 2 | 3}x${1 | 2 | 3}`;
  current: CellState;
  target: CellState;
  rotations: number;
};

const DIRECTIONS = ["U", "R", "D", "L"] as const;
const ROTATE_RIGHT: Record<(typeof DIRECTIONS)[number], (typeof DIRECTIONS)[number]> = {
  U: "R",
  R: "D",
  D: "L",
  L: "U",
};

const DARK_THRESHOLD = 110;

const isDark = (png: PngImage, x: number, y: number) => {
  const safeX = Math.max(0, Math.min(png.width - 1, Math.round(x)));
  const safeY = Math.max(0, Math.min(png.height - 1, Math.round(y)));
  const idx = (png.width * safeY + safeX) << 2;
  const r = png.data[idx];
  const g = png.data[idx + 1];
  const b = png.data[idx + 2];
  const a = png.data[idx + 3];
  const luminance = (r + g + b) / 3;

  return a > 0 && luminance < DARK_THRESHOLD;
};

const longestDarkRunByRow = (png: PngImage) => {
  const rows: number[] = [];

  for (let y = 0; y < png.height; y += 1) {
    let current = 0;
    let best = 0;

    for (let x = 0; x < png.width; x += 1) {
      if (isDark(png, x, y)) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }

    rows.push(best);
  }

  return rows;
};

const longestDarkRunByColumn = (png: PngImage) => {
  const cols: number[] = [];

  for (let x = 0; x < png.width; x += 1) {
    let current = 0;
    let best = 0;

    for (let y = 0; y < png.height; y += 1) {
      if (isDark(png, x, y)) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }

    cols.push(best);
  }

  return cols;
};

const toCenters = (values: number[], threshold: number) => {
  const centers: number[] = [];
  let start: number | null = null;

  for (let i = 0; i < values.length; i += 1) {
    if (values[i] >= threshold) {
      if (start == null) start = i;
      continue;
    }

    if (start != null) {
      centers.push(Math.round((start + i - 1) / 2));
      start = null;
    }
  }

  if (start != null) {
    centers.push(Math.round((start + values.length - 1) / 2));
  }

  return centers;
};

const detectGrid = (png: PngImage): Grid => {
  const rowThreshold = Math.max(120, Math.round(png.width * 0.25));
  const colThreshold = Math.max(120, Math.round(png.height * 0.25));

  const ys = toCenters(longestDarkRunByRow(png), rowThreshold);
  const xs = toCenters(longestDarkRunByColumn(png), colThreshold);

  if (xs.length !== 4 || ys.length !== 4) {
    throw new Error(
      `Could not detect 3x3 grid reliably (xs=${xs.length}, ys=${ys.length})`,
    );
  }

  return { xs, ys };
};

const sampleDensity = (
  png: PngImage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  let dark = 0;
  let total = 0;

  for (let y = Math.round(y1); y <= Math.round(y2); y += 1) {
    for (let x = Math.round(x1); x <= Math.round(x2); x += 1) {
      total += 1;
      if (isDark(png, x, y)) dark += 1;
    }
  }

  return total === 0 ? 0 : dark / total;
};

const canonicalize = (dirs: string) =>
  DIRECTIONS.filter((dir) => dirs.includes(dir)).join("") as CellState;

const detectCellState = (
  png: PngImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
) => {
  const width = right - left;
  const height = bottom - top;
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;

  const topDensity = sampleDensity(
    png,
    midX - width * 0.13,
    top + height * 0.06,
    midX + width * 0.13,
    top + height * 0.24,
  );
  const rightDensity = sampleDensity(
    png,
    right - width * 0.24,
    midY - height * 0.13,
    right - width * 0.06,
    midY + height * 0.13,
  );
  const bottomDensity = sampleDensity(
    png,
    midX - width * 0.13,
    bottom - height * 0.24,
    midX + width * 0.13,
    bottom - height * 0.06,
  );
  const leftDensity = sampleDensity(
    png,
    left + width * 0.06,
    midY - height * 0.13,
    left + width * 0.24,
    midY + height * 0.13,
  );

  const dirs = [
    topDensity > 0.25 ? "U" : "",
    rightDensity > 0.25 ? "R" : "",
    bottomDensity > 0.25 ? "D" : "",
    leftDensity > 0.25 ? "L" : "",
  ].join("");

  if (!dirs) {
    throw new Error(
      `Could not detect tile connectors for cell bounds ${left},${top},${right},${bottom}`,
    );
  }

  return canonicalize(dirs);
};

export const parseBoardState = (buffer: Buffer) => {
  const png = PNG.sync.read(buffer) as PngImage;
  const grid = detectGrid(png);

  const board = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, col) =>
      detectCellState(
        png,
        grid.xs[col],
        grid.ys[row],
        grid.xs[col + 1],
        grid.ys[row + 1],
      ),
    ),
  ) as BoardState;

  return {
    board,
    grid,
    size: {
      width: png.width,
      height: png.height,
    },
  };
};

export const rotateCellState = (state: CellState) =>
  canonicalize(
    [...state]
      .map((dir) => ROTATE_RIGHT[dir as keyof typeof ROTATE_RIGHT])
      .join(""),
  );

export const getRotationCount = (current: CellState, target: CellState) => {
  let candidate = current;

  for (let rotations = 0; rotations < 4; rotations += 1) {
    if (candidate === target) {
      return rotations;
    }

    candidate = rotateCellState(candidate);
  }

  throw new Error(`Tile ${current} cannot be rotated into ${target}`);
};

export const buildRotationPlan = (
  currentBoard: BoardState,
  targetBoard: BoardState,
) => {
  const plan: RotationPlanItem[] = [];

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const current = currentBoard[row][col];
      const target = targetBoard[row][col];
      const rotations = getRotationCount(current, target);

      if (rotations > 0) {
        plan.push({
          cell: `${row + 1}x${col + 1}` as RotationPlanItem["cell"],
          current,
          target,
          rotations,
        });
      }
    }
  }

  return plan;
};

export const formatBoard = (board: BoardState) =>
  board.map((row) => row.join(" | ")).join("\n");
