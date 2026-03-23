import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { api } from "./src/config";
import { tools } from "./src/tools/definitions";
import { createHandlers } from "./src/tools/handlers";
import { runAgent } from "./src/agent";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSenditInitialInput(): string {
  const file = process.env.SENDIT_INITIAL_INPUT_FILE?.trim();
  if (!file) {
    throw new Error(
      "SENDIT_INITIAL_INPUT_FILE is required (path to a local file with the mission brief from course materials — see sendit-mission.example.txt)",
    );
  }
  const abs = resolve(file);
  if (!existsSync(abs)) {
    throw new Error(`SENDIT_INITIAL_INPUT_FILE not found: ${abs}`);
  }
  return readFileSync(abs, "utf-8");
}

const main = async () => {
  const handlers = createHandlers({
    docsDir: join(__dirname, "."),
  });

  const initialInput = loadSenditInitialInput().trim();

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
    console.log("\n--- Verify response ---");
    console.log(JSON.stringify(submitResult.response, null, 2));
    if (submitResult.flag) {
      console.log("\n🎉 Flag:", submitResult.flag);
    }
  }
  console.log(
    `\nToken usage (approx): input=${usageAcc.inputTokens}, output=${usageAcc.outputTokens}`,
  );
};

main().catch((error) => {
  console.error("Error running sendit agent:", error);
  process.exitCode = 1;
});
