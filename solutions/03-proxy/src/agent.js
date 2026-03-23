import { chat, extractToolCalls, extractText } from "./api.js";

const MAX_TOOL_ROUNDS = 5;

const executeToolCalls = async (toolCalls, handlers) =>
  Promise.all(
    toolCalls.map(async (call) => {
      const args = JSON.parse(call.arguments ?? "{}");
      try {
        const handler = handlers[call.name];
        if (!handler) throw new Error(`Unknown tool: ${call.name}`);
        const result = await handler(args);
        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        };
      } catch (err) {
        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ error: err.message }),
        };
      }
    })
  );

export const processMessage = async (
  sessionMessages,
  userMessage,
  { model, tools, handlers, instructions }
) => {
  const conversation = [
    ...sessionMessages,
    { role: "user", content: userMessage },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chat({
      model,
      tools,
      instructions,
      input: conversation,
    });

    const toolCalls = extractToolCalls(response);

    if (toolCalls.length === 0) {
      const text = extractText(response) ?? "";
      return {
        text,
        messages: [...conversation, ...response.output],
      };
    }

    const toolResults = await executeToolCalls(toolCalls, handlers);
    conversation.push(...response.output, ...toolResults);
  }

  const text = "Przepraszam, coś poszło nie tak. Spróbuj jeszcze raz.";
  return { text, messages: conversation };
};
