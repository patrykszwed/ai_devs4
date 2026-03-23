// @ts-ignore
import { resolveModelForProvider } from "../../../config.js";

export const apiKey = process.env.AI_DEVS_API_KEY?.trim();
if (!apiKey) throw new Error("AI_DEVS_API_KEY is required for drone");

export const MODELS = {
  text: resolveModelForProvider(
    process.env.DASHBOARD_MODEL || "mistralai/ministral-3b-2512",
  ),
  vision: resolveModelForProvider(
    process.env.DRONE_VISION_MODEL || "openai/gpt-4o",
  ),
};

// Keep high-level only — concrete drone command grammar comes from hub responses via call_drone_api.
export const SYSTEM_PROMPT = `You operate a drone via the call_drone_api tool (instructions string array).

Rules:
- Follow error messages from the hub and adjust the next request; use hardReset if state seems corrupted.
- Stop when the hub response indicates successful completion (completion token pattern).
- Do not invent completion tokens or success — only what call_drone_api returns counts.
- Be concise.`;
