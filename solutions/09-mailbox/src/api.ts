import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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

  if (tools && tools.length > 0) {
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
    body: JSON.stringify({
      ...body,
      cache_control: { type: "ephemeral" },
    }),
  });

  const data = await response.json();
  if (!response.ok || (data as { error?: unknown }).error) {
    const message =
      (data as { error?: { message?: string } }).error?.message ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
};

export const extractToolCalls = (response: {
  output?: Array<{ type: string }>;
}) => (response.output ?? []).filter((item) => item.type === "function_call");

export const extractText = (response: {
  output_text?: string;
  output?: Array<{ type: string; content?: Array<{ text?: string }> }>;
}): string | null => {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const message = (response.output ?? []).find(
    (item) => item.type === "message",
  );
  return message?.content?.[0]?.text ?? null;
};
