// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveModelForProvider } from "../../../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const electricityRoot = join(__dirname, "..", "..");

const apiKey = process.env.AI_DEVS_API_KEY?.trim();

if (!apiKey) {
  throw new Error("AI_DEVS_API_KEY is required for electricity");
}

const defaultModel = "google/gemini-2.5-flash-lite";

export const api = {
  model: resolveModelForProvider(process.env.DASHBOARD_MODEL || defaultModel),
  instructions: `Jesteś agentem rozwiązującym zadanie "electricity".

## CEL
- Doprowadź prąd do wszystkich trzech elektrowni.
- Jedyną dozwoloną akcją w hubie jest obrót jednego pola o 90 stopni w prawo.
- Gdy konfiguracja będzie poprawna, odpowiedź z huba zawiera flagę {FLG:...}.

## DOSTĘPNE NARZĘDZIA
- inspect_board:
  - opcjonalnie resetuje planszę,
  - pobiera aktualny obraz planszy,
  - zamienia go na tekstową reprezentację 3x3,
  - porównuje z docelowym układem,
  - zwraca recommended_rotations.
- rotate_tile:
  - wykonuje dokładnie jeden obrót wskazanego pola,
  - zwraca odpowiedź huba i ewentualną flagę.

## STRATEGIA
1. Zawsze zacznij od inspect_board z reset=true.
2. Korzystaj z recommended_rotations zamiast samodzielnie zgadywać obroty.
3. Jeśli pozycja ma rotations=3, wywołaj rotate_tile trzy razy dla tego samego pola.
4. Po wykonaniu całej partii obrotów ponownie użyj inspect_board, aby potwierdzić stan.
5. Jeśli rotate_tile zwróci flagę, zakończ pracę.

## OGRANICZENIA
- Nie zgaduj układu obrazka.
- Nie wykonuj zbędnych obrotów.
- Odpowiadaj zwięźle.
`,
} as const;

export function resolveElectricityTargetImagePath() {
  const raw = process.env.ELECTRICITY_TARGET_IMAGE?.trim();
  if (!raw) {
    throw new Error(
      "ELECTRICITY_TARGET_IMAGE is required (path to target board PNG from private course materials; absolute or relative to solutions/07-electricity)",
    );
  }
  return isAbsolute(raw) ? raw : join(electricityRoot, raw);
}

export { apiKey };
