import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  // @ts-ignore
} from "../../../config.js";

type ChatArgs = {
  model: string;
  input: unknown;
  tools?: unknown[];
  toolChoice?: "auto" | "none";
  instructions?: string;
};

export const chat = async ({
  model,
  input,
  tools,
  toolChoice = "auto",
  instructions,
}: ChatArgs) => {
  const body: Record<string, unknown> = { model, input };
  if (tools && (tools as unknown[]).length) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }
  if (instructions) {
    body.instructions = instructions;
  }

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
    const message =
      (data as any)?.error?.message ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data;
};

export const extractToolCalls = (response: any) =>
  (response.output ?? []).filter((item: any) => item.type === "function_call");

export const extractText = (response: any): string | null => {
  if (
    typeof response?.output_text === "string" &&
    response.output_text.trim()
  ) {
    return response.output_text;
  }
  const message = (response.output ?? []).find(
    (item: any) => item.type === "message",
  );
  return message?.content?.[0]?.text ?? null;
};
