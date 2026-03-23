import { chat, extractText, extractToolCalls } from "./api.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { logAgentEvent } from "../../../agent-log.js";

type UsageAcc = { inputTokens: number; outputTokens: number };

type RunAgentArgs = {
  model: string;
  tools: readonly unknown[];
  handlers: Record<string, (args: unknown) => Promise<unknown>>;
  instructions: string;
  initialInput: string;
  usageAcc?: UsageAcc;
};

const MAX_TOOL_ROUNDS = 25;

const addUsage = (acc: UsageAcc | undefined, data: { usage?: { input_tokens?: number; output_tokens?: number; prompt_tokens?: number; completion_tokens?: number } }) => {
  if (!acc) return;
  const u = data?.usage;
  if (!u) return;
  acc.inputTokens += u.input_tokens ?? u.prompt_tokens ?? 0;
  acc.outputTokens += u.output_tokens ?? u.completion_tokens ?? 0;
};

export type SubmitResult = {
  response: unknown;
  flag?: string;
};

const executeToolCalls = async (
  toolCalls: Array<{ call_id: string; name: string; arguments: string }>,
  handlers: Record<string, (args: unknown) => Promise<unknown>>,
): Promise<{ toolResults: unknown[]; submitResult: SubmitResult | null }> => {
  let submitResult: SubmitResult | null = null;

  const toolResults = await Promise.all(
    toolCalls.map(async (call) => {
      const args = JSON.parse(call.arguments);
      const handler = handlers[call.name];
      if (!handler) {
        const errorPayload = { error: `Unknown tool: ${call.name}` };
        logAgentEvent?.({
          type: "tool_result",
          call_id: call.call_id,
          name: call.name,
          output: errorPayload,
          error: true,
        });
        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(errorPayload),
        };
      }

      try {
        const result = await handler(args) as { ok?: boolean; flag?: string; error?: string; wrong?: unknown; results?: unknown[]; steps?: string[] };

        if (call.name === "run_categorize_cycle" && result?.flag) {
          submitResult = { response: result, flag: result.flag };
          console.log("🎉🚩 categorize flag detected:", result.flag);
        }

        logAgentEvent?.({
          type: "tool_result",
          call_id: call.call_id,
          name: call.name,
          output: result,
          error: false,
        });

        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        };
      } catch (error: unknown) {
        const payload = {
          error: error instanceof Error ? error.message : String(error),
        };
        logAgentEvent?.({
          type: "tool_result",
          call_id: call.call_id,
          name: call.name,
          output: payload,
          error: true,
        });
        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(payload),
        };
      }
    }),
  );

  return { toolResults, submitResult };
};

export const runAgent = async ({
  model,
  tools,
  handlers,
  instructions,
  initialInput,
  usageAcc,
}: RunAgentArgs): Promise<{
  text: string | null;
  submitResult: SubmitResult | null;
}> => {
  logAgentEvent?.({ type: "instructions", content: instructions });

  let conversation: unknown[] = [{ role: "user", content: initialInput }];
  let lastSubmitResult: SubmitResult | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    logAgentEvent?.({
      type: "request",
      round: round + 1,
      messages: conversation,
    });

    const response = await chat({
      model,
      input: conversation,
      tools: [...tools],
      instructions,
    });

    addUsage(usageAcc, response);
    const toolCalls = extractToolCalls(response) as Array<{
      call_id: string;
      name: string;
      arguments: string;
    }>;

    if (!toolCalls.length) {
      const text = extractText(response);
      if (text != null) {
        logAgentEvent?.({ type: "text", round: round + 1, content: text });
      }
      return { text: text ?? null, submitResult: lastSubmitResult };
    }

    logAgentEvent?.({
      type: "tool_calls",
      round: round + 1,
      calls: toolCalls.map((c) => ({
        call_id: c.call_id,
        name: c.name,
        arguments: typeof c.arguments === "string" ? c.arguments : JSON.stringify(c.arguments ?? {}),
      })),
    });

    console.log(`\n[round ${round + 1}] Tool calls: ${toolCalls.length}`);

    const { toolResults, submitResult: roundSubmit } = await executeToolCalls(
      toolCalls,
      handlers,
    );
    if (roundSubmit) lastSubmitResult = roundSubmit;
    conversation = [...conversation, ...toolCalls, ...toolResults];
  }

  console.warn("Max tool rounds reached");
  return { text: null, submitResult: lastSubmitResult };
};
