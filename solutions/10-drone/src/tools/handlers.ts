import { hubVerifyUrl } from "../../../../hub-paths.js";
import { apiKey } from "../config.js";

const extractFlag = (text: string) => text.match(/\{FLG:[^}]+}/)?.[0] ?? null;

export const createHandlers = () => ({
  async call_drone_api({ instructions }: { instructions: string[] }) {
    console.log("🚁 Sending drone instructions:", JSON.stringify(instructions));

    const response = await fetch(hubVerifyUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        task: "drone",
        answer: { instructions },
      }),
    });

    const rawBody = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = { raw: rawBody };
    }

    const flag = extractFlag(rawBody);
    if (flag) console.log("🎉🚩 Flag found:", flag);

    return { ok: response.ok, status: response.status, body, flag };
  },
});
