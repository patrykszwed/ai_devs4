import { chat, extractToolCalls, extractText } from "./api.js";
import { logAgentEvent } from "../../../agent-log.js";

const MAX_TOOL_ROUNDS = 30;

function addUsage(acc, data) {
  const u = data?.usage;
  if (!u) return;
  acc.inputTokens += u.input_tokens ?? u.prompt_tokens ?? 0;
  acc.outputTokens += u.output_tokens ?? u.completion_tokens ?? 0;
}

const executeToolCalls = async (toolCalls, handlers) => {
  return Promise.all(
    toolCalls.map(async (call) => {
      const args = JSON.parse(call.arguments);
      console.log(`  🔍 ${call.name}(${JSON.stringify(args)})`);
      try {
        const handler = handlers[call.name];
        if (!handler) throw new Error(`Unknown tool: ${call.name}`);
        const result = await handler(args);
        console.log(`    ✅`);

        if (call.name === "submit_findhim_answer") {
          console.log(`🎉🚩 Success: ${JSON.stringify(result)} 🎉🚩`);
        }

        logAgentEvent({
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
      } catch (err) {
        console.log(`    ❌ ${err.message}`);
        logAgentEvent({
          type: "tool_result",
          call_id: call.call_id,
          name: call.name,
          output: err.message,
          error: true,
        });
        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ error: err.message }),
        };
      }
    }),
  );
};

function conversationToMessages(conversation) {
  return conversation.map((item) => {
    if (item.role === "user" || item.role === "assistant") {
      return { role: item.role, content: typeof item.content === "string" ? item.content : item.content };
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
      return { type: "function_call_output", call_id: item.call_id, output: item.output };
    }
    return item;
  });
}

export const processFindhim = async ({
  model,
  tools,
  handlers,
  instructions,
  initialInput,
  usageAcc = null,
}) => {
  logAgentEvent({ type: "instructions", content: instructions });

  let conversation = [{ role: "user", content: initialInput }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    logAgentEvent({
      type: "request",
      round: round + 1,
      messages: conversationToMessages(conversation),
    });

    const response = await chat({
      model,
      tools,
      instructions,
      input: conversation,
    });
    if (usageAcc) addUsage(usageAcc, response);
    const toolCalls = extractToolCalls(response);

    if (toolCalls.length === 0) {
      const text = extractText(response);
      if (text != null) {
        logAgentEvent({ type: "text", round: round + 1, content: text });
      }
      return text ?? null;
    }

    logAgentEvent({
      type: "tool_calls",
      round: round + 1,
      calls: toolCalls.map((c) => ({
        call_id: c.call_id,
        name: c.name,
        arguments: typeof c.arguments === "string" ? c.arguments : JSON.stringify(c.arguments ?? {}),
      })),
    });

    console.log(`\n[round ${round + 1}] Tool calls: ${toolCalls.length}`);
    const toolResults = await executeToolCalls(toolCalls, handlers);
    conversation = [...conversation, ...toolCalls, ...toolResults];
  }

  console.warn("Max tool rounds reached");
  return null;
};
