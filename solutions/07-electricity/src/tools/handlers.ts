import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRotationPlan,
  formatBoard,
  parseBoardState,
} from "../board.js";
import { hubUrlFromPathEnv, hubVerifyUrl } from "../../../../hub-paths.js";
import { apiKey, resolveElectricityTargetImagePath } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..", "..");
const ARTIFACTS_DIR = join(ROOT_DIR, "artifacts");
const hubImageUrl = () =>
  hubUrlFromPathEnv("AI_DEVS_HUB_PATH_ELECTRICITY_ASSET", apiKey);

type CellAddress =
  | "1x1"
  | "1x2"
  | "1x3"
  | "2x1"
  | "2x2"
  | "2x3"
  | "3x1"
  | "3x2"
  | "3x3";

type HubResponse = {
  status: number;
  rawBody: string;
  jsonBody: unknown | null;
  flag?: string;
};

let cachedTargetBoard: ReturnType<typeof parseBoardState> | null = null;

const extractFlag = (text: string) => {
  const match = text.match(/\{FLG:[^}]+}/);
  return match?.[0];
};

const ensureArtifactsDir = async () => {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
};

const readTargetBoard = async () => {
  if (cachedTargetBoard) {
    return cachedTargetBoard;
  }

  const buffer = await readFile(resolveElectricityTargetImagePath());
  cachedTargetBoard = parseBoardState(buffer);
  return cachedTargetBoard;
};

const fetchCurrentBoard = async (reset = false) => {
  const base = hubImageUrl();
  const url = reset ? `${base}?reset=1` : base;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch electricity board image: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await ensureArtifactsDir();
  await writeFile(join(ARTIFACTS_DIR, "current-board.png"), buffer);

  return {
    url,
    buffer,
  };
};

const rotateTile = async (cell: CellAddress): Promise<HubResponse> => {
  const response = await fetch(hubVerifyUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: apiKey,
      task: "electricity",
      answer: {
        rotate: cell,
      },
    }),
  });

  const rawBody = await response.text();
  let jsonBody: unknown | null = null;

  try {
    jsonBody = JSON.parse(rawBody);
  } catch {
    jsonBody = null;
  }

  return {
    status: response.status,
    rawBody,
    jsonBody,
    flag: extractFlag(rawBody),
  };
};

export const createHandlers = () => {
  return {
    async inspect_board({ reset = false }: { reset?: boolean }) {
      const [targetBoardData, currentBoardData] = await Promise.all([
        readTargetBoard(),
        fetchCurrentBoard(reset),
      ]);

      const current = parseBoardState(currentBoardData.buffer);
      const target = targetBoardData;
      const recommendedRotations = buildRotationPlan(current.board, target.board);

      return {
        ok: true,
        reset,
        imageUrl: currentBoardData.url,
        imageSavedTo: "artifacts/current-board.png",
        imageSize: current.size,
        current_board: current.board,
        current_board_text: formatBoard(current.board),
        target_board: target.board,
        target_board_text: formatBoard(target.board),
        recommended_rotations: recommendedRotations,
        total_rotations: recommendedRotations.reduce(
          (sum, item) => sum + item.rotations,
          0,
        ),
        solved: recommendedRotations.length === 0,
      };
    },

    async rotate_tile({ cell }: { cell: CellAddress }) {
      const result = await rotateTile(cell);

      return {
        ok: result.status >= 200 && result.status < 300,
        cell,
        status: result.status,
        body: result.jsonBody ?? { raw: result.rawBody },
        rawBodyPreview: result.rawBody.slice(0, 500),
        flag: result.flag,
      };
    },
  } as const;
};
