import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { api, apiKey } from "./src/config.js";
import { processFindhim } from "./src/executor.js";
import { tools, createHandlers } from "./src/tools/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPowerPlants() {
  const path = join(__dirname, "findhim_locations.json");
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path} — copy findhim_locations.example.json, rename, and fill from your course run.`,
    );
  }
  const data = JSON.parse(readFileSync(path, "utf-8"));
  const coordsByCity = data.city_coordinates || {};
  const plants = [];
  for (const [city, info] of Object.entries(data.power_plants || {})) {
    const coords = coordsByCity[city];
    if (coords?.lat != null && coords?.lng != null && info.code) {
      plants.push({
        city,
        code: info.code,
        lat: coords.lat,
        lng: coords.lng,
      });
    }
  }
  return plants;
}

function loadSuspects() {
  const path = join(__dirname, "..", "01-people", "filtered_people.json");
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path} — copy filtered_people.example.json, rename, and fill (or generate via 01-people).`,
    );
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

async function main() {
  const suspects = loadSuspects();
  const powerPlants = loadPowerPlants();
  const handlers = createHandlers(apiKey, powerPlants);

  const initialInput = `Lista podejrzanych osób (name, surname, born):\n${JSON.stringify(
    suspects.map((p) => ({ name: p.name, surname: p.surname, born: p.born })),
    null,
    2
  )}\n\nZnajdź osobę, która była blisko jednej z elektrowni, pobierz jej accessLevel i wyślij odpowiedź przez submit_findhim_answer.`;

  console.log("Suspects:", suspects.length, "| Power plants:", powerPlants.length);
  const usageAcc = { inputTokens: 0, outputTokens: 0 };
  await processFindhim({
    model: api.model,
    tools,
    handlers,
    instructions: api.instructions,
    initialInput,
    usageAcc,
  });
  const usageFile = process.env.DASHBOARD_USAGE_FILE;
  if (usageFile && (usageAcc.inputTokens > 0 || usageAcc.outputTokens > 0)) {
    writeFileSync(usageFile, JSON.stringify({ inputTokens: usageAcc.inputTokens, outputTokens: usageAcc.outputTokens }), "utf-8");
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
