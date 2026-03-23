import { writeFileSync } from "node:fs";

import { runAgent } from "./src/agent";
import { api } from "./src/config";
import { tools } from "./src/tools/definitions";
import { createHandlers } from "./src/tools/handlers";

const main = async () => {
  const handlers = createHandlers();
  const usageAcc = { inputTokens: 0, outputTokens: 0 };

  const initialInput = `Rozwiąż zadanie mailbox: znajdź date, password i confirmation_code w skrzynce mailowej i wyślij przez submit_answer.`;

  const { text, submitResult } = await runAgent({
    model: api.model,
    tools: [...tools],
    handlers,
    instructions: api.instructions,
    initialInput,
    usageAcc,
  });

  console.log("\nAgent result:", text ?? "<no text>");
  if (submitResult != null) {
    console.log("\n--- Last mailbox submit response ---");
    console.log(JSON.stringify(submitResult.response, null, 2));
    if (submitResult.flag) {
      console.log("\n🎉 Flag:", submitResult.flag);
    }
  }

  console.log(
    `\nToken usage (approx): input=${usageAcc.inputTokens}, output=${usageAcc.outputTokens}`,
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

main().catch((error: unknown) => {
  console.error("Error running mailbox agent:", error);
  process.exitCode = 1;
});
