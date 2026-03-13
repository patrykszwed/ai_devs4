import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { api, apiKey } from "./src/config.js";
import { processFindhim } from "./src/executor.js";
import { tools, createHandlers } from "./src/tools/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CITY_COORDS = {
  Zabrze: { lat: 50.325, lng: 18.786 },
  "Piotrków Trybunalski": { lat: 51.405, lng: 19.703 },
  Grudziądz: { lat: 53.484, lng: 18.754 },
  Tczew: { lat: 54.092, lng: 18.778 },
  Radom: { lat: 51.402, lng: 21.147 },
  Chelmno: { lat: 53.348, lng: 18.425 },
  Żarnowiec: { lat: 54.75, lng: 18.08 }
};

function loadPowerPlants() {
  const path = join(__dirname, "findhim_locations.json");
  const data = JSON.parse(readFileSync(path, "utf-8"));
  const plants = [];
  for (const [city, info] of Object.entries(data.power_plants || {})) {
    const coords = CITY_COORDS[city];
    if (coords && info.code) {
      plants.push({ city, code: info.code, lat: coords.lat, lng: coords.lng });
    }
  }
  return plants;
}

function loadSuspects() {
  const path = join(__dirname, "..", "01-people", "filtered_people.json");
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
