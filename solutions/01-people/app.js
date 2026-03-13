import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider,
} from "../../config.js";
import { personSchema } from "./schemas.js";
import { extractResponseText, loadCSV, ageOn, birthYear } from "./helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultModel = "mistralai/ministral-3b-2512";
const MODEL = resolveModelForProvider(process.env.DASHBOARD_MODEL || defaultModel);

function addUsage(acc, data) {
  const u = data?.usage;
  if (!u) return;
  acc.inputTokens += u.input_tokens ?? u.prompt_tokens ?? 0;
  acc.outputTokens += u.output_tokens ?? u.completion_tokens ?? 0;
}

async function tagJobWithAPI(jobDescription, usageAcc) {
  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS,
    },
    body: JSON.stringify({
      model: MODEL,
      cache_control: { type: "ephemeral" },
      input: `Opis stanowiska: "${jobDescription}". Przypisz tagi z listy: IT, transport, edukacja, medycyna, praca z ludźmi, praca z pojazdami, praca fizyczna. Zwróć tylko tablicę tags.`,
      text: { format: personSchema },
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    const msg = data?.error?.message ?? `Request failed: ${response.status}`;
    throw new Error(msg);
  }
  if (usageAcc) addUsage(usageAcc, data);

  const outputText = extractResponseText(data);
  if (!outputText) throw new Error("Missing text output in API response");
  return JSON.parse(outputText);
}

function run() {
  const csvPath = join(__dirname, "people.csv");
  const raw = readFileSync(csvPath, "utf-8");
  const { rows } = loadCSV(raw);

  const filtered = rows.filter((row) => {
    if (row.gender !== "M" || row.birthPlace !== "Grudziądz") return false;
    const age = ageOn(row.birthDate);
    return age != null && age >= 20 && age <= 40;
  });

  return { filtered };
}

async function main() {
  const { filtered } = run();
  console.log(`Po filtrze (M, 20–40 lat, Grudziądz): ${filtered.length} osób`);

  const usageAcc = { inputTokens: 0, outputTokens: 0 };
  const tagged = [];
  for (let i = 0; i < filtered.length; i++) {
    const row = filtered[i];
    const parsed = await tagJobWithAPI(row.job, usageAcc);
    const year = birthYear(row.birthDate);
    tagged.push({
      name: row.name,
      surname: row.surname,
      gender: row.gender,
      born: year,
      city: row.birthPlace,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    });
    if ((i + 1) % 10 === 0)
      console.log(`  otagowano ${i + 1}/${filtered.length}`);
  }

  const transportOnly = tagged.filter((p) => p.tags.includes("transport"));
  console.log(`Po filtrze tagu "transport": ${transportOnly.length} osób`);

  const outPath = join(__dirname, "filtered_people.json");
  writeFileSync(outPath, JSON.stringify(transportOnly, null, 2), "utf-8");
  console.log(`Zapisano: ${outPath}`);

  const apiKey = process.env.AI_DEVS_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "AI_DEVS_API_KEY nie ustawiony – pomijam wysyłkę do hub.ag3nts.org",
    );
    return;
  }
  const verifyRes = await fetch("https://hub.ag3nts.org/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: apiKey,
      task: "people",
      answer: transportOnly,
    }),
  });
  if (!verifyRes.ok) {
    throw new Error(
      `Verify failed: ${verifyRes.status} ${await verifyRes.text()}`,
    );
  }
  console.log("Wysłano do hub.ag3nts.org/verify");

  const result = await verifyRes.json();

  console.log(`🤖 Wynik: ${JSON.stringify(result, null, 2)}`);

  const usageFile = process.env.DASHBOARD_USAGE_FILE;
  if (usageFile && (usageAcc.inputTokens > 0 || usageAcc.outputTokens > 0)) {
    writeFileSync(usageFile, JSON.stringify({ inputTokens: usageAcc.inputTokens, outputTokens: usageAcc.outputTokens }), "utf-8");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
