import { chat, extractText, extractToolCalls } from "./api.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { logAgentEvent } from "../../../agent-log.js";

type UsageAcc = { inputTokens: number; outputTokens: number };

type RunAgentArgs = {
  model: string;
  tools: any[];
  handlers: Record<string, (args: any) => Promise<any> | any>;
  instructions: string;
  initialInput: string;
  usageAcc?: UsageAcc;
};

const MAX_TOOL_ROUNDS = 20;

const addUsage = (acc: UsageAcc | undefined, data: any) => {
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
  toolCalls: any[],
  handlers: Record<string, (args: any) => Promise<any> | any>,
): Promise<{ toolResults: any[]; submitResult: SubmitResult | null }> => {
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
        const result = await handler(args);
        if (call.name === "submit_sendit_declaration") {
          const response = result?.response ?? result;
          const flag =
            typeof response?.flag === "string" ? response.flag : undefined;
          submitResult = { response, flag };
          console.log(
            "🎉🚩 sendit submitted:",
            JSON.stringify(result, null, 2),
          );
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
      } catch (error: any) {
        const payload = { error: error?.message ?? String(error) };
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
  submitResult?: SubmitResult | null;
}> => {
  logAgentEvent?.({ type: "instructions", content: instructions });

  let conversation: any[] = [{ role: "user", content: initialInput }];
  let lastSubmitResult: SubmitResult | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    logAgentEvent?.({
      type: "request",
      round: round + 1,
      messages: conversation.map((item) => {
        if (item.role === "user" || item.role === "assistant") {
          return {
            role: item.role,
            content:
              typeof item.content === "string" ? item.content : item.content,
          };
        }
        if (item.type === "function_call") {
          return {
            type: "function_call",
            call_id: item.call_id,
            name: item.name,
            arguments: item.arguments,
          };
        }
        if (item.type === "function_call_output") {
          return {
            type: "function_call_output",
            call_id: item.call_id,
            output: item.output,
          };
        }
        return item;
      }),
    });

    const response = await chat({
      model,
      input: conversation,
      tools,
      instructions,
    });

    addUsage(usageAcc, response);
    const toolCalls = extractToolCalls(response);

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
      calls: toolCalls.map((c: any) => ({
        call_id: c.call_id,
        name: c.name,
        arguments:
          typeof c.arguments === "string"
            ? c.arguments
            : JSON.stringify(c.arguments ?? {}),
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
