import { writeFileSync } from "node:fs";
import {
  AI_API_KEY,
  RESPONSES_API_ENDPOINT,
  EXTRA_API_HEADERS,
  // @ts-ignore
} from "../../config.js";
// @ts-ignore — hub-paths at repo root (no local package.json / TS project root)
import { hubUrlFromPathEnv } from "../../hub-paths.js";
import { apiKey, MODELS, SYSTEM_PROMPT } from "./src/config.js";
import { tools } from "./src/tools/definitions.js";
import { createHandlers } from "./src/tools/handlers.js";
import { runAgent } from "./src/agent.js";
// @ts-ignore
import { logAgentEvent } from "../../agent-log.js";

const mapUrl = () => hubUrlFromPathEnv("AI_DEVS_HUB_PATH_DRONE_MAP", apiKey);

const analyzeMapSector = async (): Promise<{
  column: number;
  row: number;
  analysis: string;
}> => {
  const url = mapUrl();
  logAgentEvent({ type: "info", content: `Analyzing map: ${url}` });
  console.log(`🗺️ Analyzing map with ${MODELS.vision}: ${url}`);

  const prompt = process.env.DRONE_VISION_PROMPT?.trim();
  if (!prompt) {
    throw new Error(
      "DRONE_VISION_PROMPT is required (map analysis instructions from private course materials)",
    );
  }

  const body = {
    model: MODELS.vision,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: mapUrl() },
        ],
      },
    ],
  };

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok || (data as any)?.error) {
    throw new Error(
      `Vision failed: ${(data as any)?.error?.message ?? response.status}`,
    );
  }

  const text: string =
    (data as any)?.output_text?.trim() ||
    ((data as any)?.output ?? [])
      .filter((i: any) => i.type === "message")
      .flatMap((m: any) => m.content ?? [])
      .filter((p: any) => p.type === "output_text" || p.type === "text")
      .map((p: any) => p.text ?? "")
      .join("\n")
      .trim();

  logAgentEvent({ type: "info", content: `Vision response:\n${text}` });
  console.log("🗺️ Vision analysis:\n", text);

  // Parse the trailing JSON object
  const jsonMatch = text.match(/\{[^{}]*"column"[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.column === "number" && typeof parsed.row === "number") {
        logAgentEvent({
          type: "info",
          content: `Dam sector identified: column=${parsed.column}, row=${parsed.row} — ${parsed.reasoning ?? ""}`,
        });
        return { column: parsed.column, row: parsed.row, analysis: text };
      }
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: parse natural language
  const colMatch = text.match(/column[=:\s]+(\d+)/i);
  const rowMatch = text.match(/row[=:\s]+(\d+)/i);
  if (colMatch && rowMatch) {
    const column = parseInt(colMatch[1], 10);
    const row = parseInt(rowMatch[1], 10);
    logAgentEvent({
      type: "info",
      content: `Dam sector (fallback parse): column=${column}, row=${row}`,
    });
    return { column, row, analysis: text };
  }

  console.warn("⚠️ Could not parse dam sector from vision response");
  logAgentEvent({
    type: "info",
    content: "Could not parse dam sector — agent will decide based on analysis",
  });
  return { column: 0, row: 0, analysis: text };
};

const main = async () => {
  // Phase 1: Vision analysis (one-time, expensive model)
  const damSector = await analyzeMapSector();

  const sectorNote =
    damSector.column > 0
      ? `column=${damSector.column}, row=${damSector.row}`
      : "could not be determined automatically";

  // Phase 2: Agent loop (cheap text model)
  logAgentEvent({ type: "info", content: "Starting drone agent loop..." });

  const handlers = createHandlers();
  const usageAcc = { inputTokens: 0, outputTokens: 0 };

  const missionBrief =
    process.env.DRONE_AGENT_MISSION?.trim() ??
    (() => {
      throw new Error(
        "DRONE_AGENT_MISSION is required (mission brief from private course materials)",
      );
    })();

  const initialInput = [
    `Vision analysis (target sector): ${sectorNote}.`,
    `Full vision analysis:\n${damSector.analysis}`,
    "",
    missionBrief,
    `Use call_drone_api with the correct instruction sequence. Read error messages and adjust.`,
  ].join("\n");

  const { text, submitResult } = await runAgent({
    model: MODELS.text,
    tools: [...tools],
    handlers,
    instructions: SYSTEM_PROMPT,
    initialInput,
    usageAcc,
  });

  console.log("\nAgent result:", text ?? "<no text>");
  if (submitResult != null) {
    console.log("\n--- Last drone API response ---");
    console.log(JSON.stringify(submitResult.response, null, 2));
    if (submitResult.flag) {
      console.log("\n🎉 Flag:", submitResult.flag);
    }
  }
  console.log(
    `\nTokens used — input: ${usageAcc.inputTokens}, output: ${usageAcc.outputTokens}`,
  );

  const usageFile = process.env.DASHBOARD_USAGE_FILE;
  if (usageFile && (usageAcc.inputTokens > 0 || usageAcc.outputTokens > 0)) {
    writeFileSync(
      usageFile,
      JSON.stringify({
        inputTokens: usageAcc.inputTokens,
        outputTokens: usageAcc.outputTokens,
      }),
      "utf-8",
    );
  }
};

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
