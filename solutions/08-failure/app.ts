import { writeFileSync } from "node:fs";

import { runAgent } from "./src/agent.js";
import { api } from "./src/config.js";
import { tools } from "./src/tools/definitions.js";
import { createHandlers } from "./src/tools/handlers.js";

const main = async () => {
  const handlers = createHandlers();
  const usageAcc = { inputTokens: 0, outputTokens: 0 };

  const initialInput = `
Rozwiąż zadanie "failure".

Wymagania:
- najpierw sprawdź overview logu,
- potem przeanalizuj główne komponenty awarii,
- zbuduj kandydat logów pod limit 1500 tokenów,
- wyślij do huba,
- jeśli dostaniesz feedback o brakach, uwzględnij wskazane podzespoły i wyślij poprawioną wersję,
- zakończ po otrzymaniu flagi.

Odpowiadaj zwięźle i pozwól narzędziom wykonać większość pracy.
  `.trim();

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
    console.log("\n--- Last failure submit response ---");
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
  console.error("Error running failure agent:", error);
  process.exitCode = 1;
});
