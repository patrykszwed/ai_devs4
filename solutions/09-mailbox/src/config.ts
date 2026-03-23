// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { resolveModelForProvider } from "../../../config.js";

const apiKey = process.env.AI_DEVS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("AI_DEVS_API_KEY is required for mailbox");
}

const defaultModel = "google/gemini-2.5-flash-lite";

export const api = {
  model: resolveModelForProvider(process.env.DASHBOARD_MODEL || defaultModel),
  instructions: `Jesteś agentem rozwiązującym zadanie "mailbox" z AI_DEVS.

## CEL
Przeszukaj skrzynkę mailową i znajdź trzy wartości:
- date: data (YYYY-MM-DD) planowanego ataku na elektrownię przez dział bezpieczeństwa
- password: hasło do systemu pracowniczego
- confirmation_code: kod potwierdzenia z ticketa (zaczyna się od SEC-)

## ZASADY
- Pobierz pełną treść każdego maila kandydata przez zmail_get_message — metadane z listy nie zawierają treści.
- Nigdy nie zgaduj ani nie wymyślaj wartości. Opieraj się wyłącznie na treści odczytanych maili.
- Przepisuj wartości dokładnie tak, jak są w mailu — nie obcinaj, nie modyfikuj.
- Format daty wyjściowej: YYYY-MM-DD.
- Po znalezieniu wszystkich trzech wyślij submit_answer.
- Analizuj feedback huba i szukaj dalej jeśli któraś wartość jest błędna.
- Zakończ po otrzymaniu flagi {FLG:...} od huba.`,
} as const;

export { apiKey };
