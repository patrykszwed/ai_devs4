import { chat, extractText, extractToolCalls } from "./api.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { logAgentEvent } from "../../../agent-log.js";

type UsageAcc = {
  inputTokens: number;
  outputTokens: number;
};

type RunAgentArgs = {
  model: string;
  tools: readonly unknown[];
  handlers: Record<string, (args: any) => Promise<any>>;
  instructions: string;
  initialInput: string;
  usageAcc?: UsageAcc;
};

export type SubmitResult = {
  response: unknown;
  flag?: string;
};

const MAX_TOOL_ROUNDS = 30;

const addUsage = (
  acc: UsageAcc | undefined,
  data: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  },
) => {
  if (!acc || !data.usage) return;
  acc.inputTokens += data.usage.input_tokens ?? data.usage.prompt_tokens ?? 0;
  acc.outputTokens +=
    data.usage.output_tokens ?? data.usage.completion_tokens ?? 0;
};

const executeToolCalls = async (
  toolCalls: Array<{ call_id: string; name: string; arguments: string }>,
  handlers: Record<string, (args: any) => Promise<any>>,
): Promise<{ toolResults: unknown[]; submitResult: SubmitResult | null }> => {
  let submitResult: SubmitResult | null = null;

  const toolResults = await Promise.all(
    toolCalls.map(async (call) => {
      const args = JSON.parse(call.arguments);
      const handler = handlers[call.name];

      if (!handler) {
        const payload = { error: `Unknown tool: ${call.name}` };
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

      try {
        const result = await handler(args);
        const flag =
          typeof (result as { flag?: unknown })?.flag === "string"
            ? ((result as { flag?: string }).flag ?? undefined)
            : undefined;

        if (call.name === "submit_answer" && flag) {
          submitResult = { response: result, flag };
          console.log("🎉🚩 mailbox flag detected:", flag);
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

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
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
    const toolCalls = extractToolCalls(response) as unknown as Array<{
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
      calls: toolCalls.map((call) => ({
        call_id: call.call_id,
        name: call.name,
        arguments:
          typeof call.arguments === "string"
            ? call.arguments
            : JSON.stringify(call.arguments ?? {}),
      })),
    });

    console.log(`\n[round ${round + 1}] Tool calls: ${toolCalls.length}`);

    const { toolResults, submitResult } = await executeToolCalls(
      toolCalls,
      handlers,
    );

    if (submitResult) {
      lastSubmitResult = submitResult;
    }

    conversation = [...conversation, ...toolCalls, ...toolResults];

    // Early exit when flag is obtained
    if (lastSubmitResult?.flag) {
      return { text: null, submitResult: lastSubmitResult };
    }
  }

  console.warn("Max tool rounds reached");
  return { text: null, submitResult: lastSubmitResult };
};
