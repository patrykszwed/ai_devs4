import { hubUrlFromPathEnv, hubVerifyUrl } from "../../../../hub-paths.js";
import { apiKey } from "../config.js";

function categorizeHubCodes() {
  const ok = process.env.AI_DEVS_HUB_CATEGORIZE_CODE_OK?.trim();
  const wrong = process.env.AI_DEVS_HUB_CATEGORIZE_CODE_WRONG_CLASS?.trim();
  const budget = process.env.AI_DEVS_HUB_CATEGORIZE_CODE_BUDGET?.trim();
  if (!ok || !wrong || !budget) {
    throw new Error(
      "Set AI_DEVS_HUB_CATEGORIZE_CODE_OK, AI_DEVS_HUB_CATEGORIZE_CODE_WRONG_CLASS, AI_DEVS_HUB_CATEGORIZE_CODE_BUDGET in .env (hub response codes from private documentation)",
    );
  }
  return {
    ok: Number(ok),
    wrong: Number(wrong),
    budget: Number(budget),
  };
}

type CsvRow = { id: string; description: string };

function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        i += 1;
        let cell = "";
        while (i < line.length) {
          if (line[i] === '"') {
            i += 1;
            if (line[i] === '"') {
              cell += '"';
              i += 1;
            } else break;
          } else {
            cell += line[i];
            i += 1;
          }
        }
        out.push(cell);
      } else {
        const comma = line.indexOf(",", i);
        const end = comma === -1 ? line.length : comma;
        out.push(line.slice(i, end).replace(/^"|"$/g, "").trim());
        i = comma === -1 ? line.length : comma + 1;
      }
    }
    return out;
  };

  const header = parseRow(lines[0]);
  const idIdx = header.findIndex(
    (h) => h.toLowerCase() === "id" || h.toLowerCase() === "identifier",
  );
  const descIdx = header.findIndex(
    (h) =>
      h.toLowerCase() === "description" ||
      h.toLowerCase() === "desc" ||
      h.toLowerCase() === "opis",
  );
  const fallbackId = idIdx >= 0 ? idIdx : 0;
  const fallbackDesc = descIdx >= 0 ? descIdx : 1;

  const rows: CsvRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseRow(lines[r]);
    rows.push({
      id: (cells[idIdx] ?? cells[fallbackId] ?? "").trim(),
      description: (cells[descIdx] ?? cells[fallbackDesc] ?? "").trim(),
    });
  }
  return rows.filter((row) => row.id || row.description);
}

function extractFlag(text: string): string | null {
  const match = text.match(/\{FLG:[^}]+}/);
  return match ? match[0] : null;
}

async function hubPost(answer: { prompt?: string }): Promise<{ raw: string; json: unknown }> {
  const res = await fetch(hubVerifyUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: apiKey,
      task: "categorize",
      answer,
    }),
  });
  const raw = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = { raw };
  }
  return { raw, json };
}

export const createHandlers = () => {
  return {
    async run_categorize_cycle({
      prompt_template,
    }: {
      prompt_template: string;
    }) {
      const steps: string[] = [];
      const results: { id: string; response: string; ok?: boolean }[] = [];

      const resetRes = await hubPost({ prompt: "reset" });
      steps.push(`reset: ${resetRes.raw.slice(0, 200)}`);

      const csvUrl = hubUrlFromPathEnv(
        "AI_DEVS_HUB_PATH_CATEGORIZE_CSV",
        apiKey,
      );
      const csvRes = await fetch(csvUrl);
      if (!csvRes.ok) {
        return {
          ok: false,
          error: `Failed to fetch CSV: ${csvRes.status} ${csvRes.statusText}`,
          steps,
        };
      }
      const csvText = await csvRes.text();
      const rows = parseCsv(csvText);
      steps.push(`CSV rows: ${rows.length}`);

      if (rows.length === 0) {
        return {
          ok: false,
          error: "No rows in CSV or parse failed",
          steps,
          csvPreview: csvText.slice(0, 300),
        };
      }

      type HubBody = {
        code?: number;
        message?: string;
        debug?: { output?: string; result?: string; balance?: number };
      };

      let flag: string | null = null;
      let error: string | undefined;
      let budgetExceeded = false;
      let wrongClassification: { id: string; description: string; hubOutput: string; result: string } | undefined;
      let ok = true;

      const hubCodes = categorizeHubCodes();

      for (const row of rows) {
        const prompt = prompt_template
          .replace(/\{id\}/g, row.id)
          .replace(/\{description\}/g, row.description);
        const verify = await hubPost({ prompt });
        flag = extractFlag(verify.raw) ?? flag;
        const body = verify.json as HubBody;
        const code = body?.code;
        const accepted = code === hubCodes.ok;
        if (!accepted) ok = false;
        if (code === hubCodes.budget || body?.debug?.balance === 0) {
          budgetExceeded = true;
        }
        if (code === hubCodes.wrong && body?.debug && !wrongClassification) {
          wrongClassification = {
            id: row.id,
            description: row.description,
            hubOutput: body.debug.output ?? "",
            result: body.debug.result ?? "wrong classification",
          };
        }
        if (body?.message && !error) error = body.message;
        results.push({
          id: row.id,
          response: verify.raw.slice(0, 500),
          ok: accepted,
        });
      }

      const summary =
        wrongClassification
          ? `Wrong: ${wrongClassification.id} (${wrongClassification.description}) → ${wrongClassification.result}. Model output: ${wrongClassification.hubOutput.slice(0, 150)}...`
          : budgetExceeded
            ? "Budget exhausted (balance 0). Reset and retry with improved prompt."
            : error ?? undefined;

      return {
        ok: ok && flag != null,
        flag: flag ?? undefined,
        error: summary ?? error,
        wrongClassification,
        budgetExceeded,
        steps,
        results,
        rowsCount: rows.length,
      };
    },
  } as const;
};
