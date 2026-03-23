import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { api } from "./src/config.js";
import { tools } from "./src/tools/definitions.js";
import { createHandlers } from "./src/tools/handlers.js";
import { runAgent } from "./src/agent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const main = async () => {
  const handlers = createHandlers();

  const initialInput = `
Zadanie "categorize": doprowadź do poprawnej klasyfikacji wszystkich towarów z CSV przez mechanizm opisany w prywatnych materiałach kursu.

Użyj narzędzia run_categorize_cycle(prompt_template) z placeholderami {id} i {description}. Szczegóły limitów, etykiet klas i interpretacji wyników narzędzia — wyłącznie z materiałów kursu.
`.trim();

  const usageAcc = { inputTokens: 0, outputTokens: 0 };

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
    console.log("\n--- Last run_categorize_cycle response ---");
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

main().catch((error) => {
  console.error("Error running categorize agent:", error);
  process.exitCode = 1;
});
