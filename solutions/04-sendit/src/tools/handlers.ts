import { join } from "node:path";
import { api, apiKey } from "../config";
import { readRoutesFromPng } from "../vision";

const HUB_VERIFY_URL = "https://hub.ag3nts.org/verify";

const getTodayIsoDate = (): string => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

const buildSenditDeclaration = (date: string): string => {
  const senderId = "450202122";
  const origin = "Gdańsk";
  const destination = "Żarnowiec";
  const routeCode = "X-01"; // Gdańsk - Żarnowiec (trasa wyłączona, dla kat. A/B)

  const category = "A"; // Strategiczna – paliwo/reaktor, opłacana przez System
  const weightKg = 2800;

  // Standardowy skład: 2 wagony po 500 kg = 1000 kg.
  // 2800 kg → 6 wagonów (6 * 500 = 3000 kg) → 4 dodatkowe (WDP = 4)
  const additionalWagons = 4;

  const description = "kasety z paliwem do reaktora";
  const notes = "brak";

  // Kategoria A – OB = 0, wszystkie opłaty pokrywa System ⇒ kwota do zapłaty 0 PP.
  const amount = "0 PP";

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

      const response = await fetch(HUB_VERIFY_URL, {
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
