import { join } from "node:path";
import { hubVerifyUrl } from "../../../../hub-paths.js";
import { api, apiKey } from "../config";
import { readRoutesFromPng } from "../vision";

const getTodayIsoDate = (): string => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

const req = (key: string) => {
  const v = process.env[key]?.trim();
  if (!v) {
    throw new Error(
      `${key} is required for sendit declaration (set in .env — see .env.example)`,
    );
  }
  return v;
};

const buildSenditDeclaration = (date: string): string => {
  const senderId = req("SENDIT_SENDER_ID");
  const origin = req("SENDIT_ORIGIN");
  const destination = req("SENDIT_DESTINATION");
  const routeCode = req("SENDIT_ROUTE_CODE");
  const category = req("SENDIT_CATEGORY");
  const weightKg = Number.parseInt(req("SENDIT_WEIGHT_KG"), 10);
  const additionalWagons = Number.parseInt(req("SENDIT_ADDITIONAL_WAGONS"), 10);
  const description = req("SENDIT_DESCRIPTION");
  const notes = process.env.SENDIT_NOTES?.trim() ?? "brak";
  const amount = req("SENDIT_AMOUNT_LABEL");

  if (!Number.isFinite(weightKg) || !Number.isFinite(additionalWagons)) {
    throw new Error("SENDIT_WEIGHT_KG and SENDIT_ADDITIONAL_WAGONS must be integers");
  }

  return [
    "SYSTEM PRZESYŁEK KONDUKTORSKICH - DEKLARACJA ZAWARTOŚCI",
    "======================================================",
    `DATA: ${date}`,
    `PUNKT NADAWCZY: ${origin}`,
    "------------------------------------------------------",
    `NADAWCA: ${senderId}`,
    `PUNKT DOCELOWY: ${destination}`,
    `TRASA: ${routeCode}`,
    "------------------------------------------------------",
    `KATEGORIA PRZESYŁKI: ${category}`,
    "------------------------------------------------------",
    `OPIS ZAWARTOŚCI (max 200 znaków): ${description}`,
    "------------------------------------------------------",
    `DEKLAROWANA MASA (kg): ${weightKg}`,
    "------------------------------------------------------",
    `WDP: ${additionalWagons}`,
    "------------------------------------------------------",
    `UWAGI SPECJALNE: ${notes}`,
    "------------------------------------------------------",
    `KWOTA DO ZAPŁATY: ${amount}`,
    "------------------------------------------------------",
    "OŚWIADCZAM, ŻE PODANE INFORMACJE SĄ PRAWDZIWE.",
    "BIORĘ NA SIEBIE KONSEKWENCJĘ ZA FAŁSZYWE OŚWIADCZENIE.",
    "======================================================",
  ].join("\n");
};

type HandlersOptions = {
  docsDir: string;
};

export const createHandlers = ({ docsDir }: HandlersOptions) => {
  const defaultPngPath = join(docsDir, "trasy-wylaczone.png");

  return {
    async read_trasy_wylaczone_vision({ path }: { path?: string }) {
      const pngPath = path || defaultPngPath;
      const result = await readRoutesFromPng(pngPath);
      return {
        visionModel: api.visionModel,
        pngPath,
        raw: result.raw,
        json: result.json,
      };
    },

    async submit_sendit_declaration() {
      const date = getTodayIsoDate();
      const declaration = buildSenditDeclaration(date);

      const body = {
        apikey: apiKey,
        task: "sendit" as const,
        answer: { declaration },
      };

      const response = await fetch(hubVerifyUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          `verify failed (${response.status}): ${text.slice(0, 500)}`,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }

      return {
        success: true,
        declarationPreview: declaration.split("\n").slice(0, 6).join("\\n"),
        response: parsed,
      };
    },
  } as const;
};
