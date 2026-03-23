import { writeFileSync } from "node:fs";

import { runAgent } from "./src/agent.js";
import { api } from "./src/config.js";
import { tools } from "./src/tools/definitions.js";
import { createHandlers } from "./src/tools/handlers.js";

const main = async () => {
  const handlers = createHandlers();
  const usageAcc = { inputTokens: 0, outputTokens: 0 };

  const initialInput = `
Rozwiąż zadanie "electricity".

Zasady:
- Najpierw wywołaj inspect_board z reset=true.
- Narzędzie zwróci aktualną planszę, docelową planszę i recommended_rotations.
- Używaj recommended_rotations zamiast zgadywać.
- Dla każdej pozycji wykonaj rotate_tile dokładnie tyle razy, ile wskazuje rotations.
- Po wykonaniu wszystkich obrotów sprawdź planszę jeszcze raz przez inspect_board.
- Jeśli flaga pojawi się w odpowiedzi rotate_tile, zakończ pracę.
- Odpowiadaj zwięźle.
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
  if (submitResult) {
    console.log("\n--- Last electricity tool result ---");
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
  console.error("Error running electricity agent:", error);
  process.exitCode = 1;
});
