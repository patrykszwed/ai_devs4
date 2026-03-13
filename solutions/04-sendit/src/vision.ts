import { readFile } from "node:fs/promises";

import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
} from "../../../config.js";
import { api } from "./config";

export const readRoutesFromPng = async (pngPath: string) => {
  const file = await readFile(pngPath);
  const imageBase64 = file.toString("base64");
  const imageUrl = `data:image/png;base64,${imageBase64}`;

  const question = `
Odczytaj z obrazu tabelę tras wyłączonych w Systemie Przesyłek Konduktorskich.

Zwróć wynik jako czysty JSON (bez komentarzy, tekstu poza JSON):
{
  "routes": [
    {
      "code": "X-01",
      "origin": "Gdańsk",
      "destination": "Żarnowiec",
      "reason": "NIEJAWNY (Dyrektywa Specjalna 7.7)",
      "deactivation": "Rok Systemu 0",
      "reactivation": "(oczekuje na testy – 80 km trasy) | BRAK | Nieokreślona | ..."
    }
  ]
}

Upewnij się, że każdy wiersz tabeli jest osobnym elementem w tablicy "routes".
`.trim();

  const body = {
    model: api.visionModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: question },
          { type: "input_image", image_url: imageUrl },
        ],
      },
    ],
  };

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok || (data as any)?.error) {
    throw new Error(
      (data as any)?.error?.message ||
        `Vision request failed (${response.status})`,
    );
  }

  const outputText: string | undefined =
    typeof data?.output_text === "string" && data.output_text.trim()
      ? data.output_text
      : undefined;

  const text =
    outputText ??
    (data.output ?? [])
      .filter((item: any) => item.type === "message")
      .flatMap((msg: any) => (Array.isArray(msg.content) ? msg.content : []))
      .find(
        (part: any) =>
          part?.type === "output_text" && typeof part.text === "string",
      )?.text ??
    "";

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // fall through – return raw text as well
  }

  return {
    raw: text,
    json: parsed,
  };
};
