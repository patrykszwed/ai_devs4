// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { resolveModelForProvider } from "../../../config.js";

const apiKey = process.env.AI_DEVS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("AI_DEVS_API_KEY is required for sendit (hub.ag3nts.org)");
}

const defaultModel = "mistralai/ministral-3b-2512";

export const api = {
  model: resolveModelForProvider(process.env.DASHBOARD_MODEL || defaultModel),
  visionModel: resolveModelForProvider(defaultModel),
  apiKey,
  instructions: `Jesteś agentem pomocniczym do wypełniania deklaracji Systemu Przesyłek Konduktorskich (SPK).

## CEL
- Na podstawie lokalnej dokumentacji SPK oraz danych wejściowych przygotuj poprawną deklarację zawartości dla konkretnej przesyłki "sendit".
- Nie generujesz samodzielnie pełnego tekstu deklaracji – gdy masz pewność co do wszystkich danych, wywołujesz narzędzie do wysłania deklaracji (zbuduje i wyśle dokument do /verify).

## ZASADY
1. Czytaj dokumentację z katalogu solutions/04-sendit: index.md, załączniki (A–H), dodatkowe-wagony, poziomy. Część danych jest w pliku graficznym (tabela tras wyłączonych).
2. Gdy potrzebujesz informacji z tabeli tras wyłączonych – użyj narzędzia do odczytu tej tabeli z obrazu PNG (vision).
3. Z dokumentacji ustal: kategorię przesyłki (A–E) dla kaset z paliwem do reaktora, kod trasy Gdańsk–Żarnowiec, sposób liczenia opłat (OB, OW, OT), wagony dodatkowe (WDP), kiedy System przejmuje koszt (0 PP).
4. Gdy deklaracja jest gotowa do wysłania – wywołaj narzędzie submit_sendit_declaration dokładnie raz. Nie wypisuj podsumowania ani nie pytaj użytkownika o potwierdzenie – gdy masz kategorię, kod trasy, metodę opłat i 0 PP, od razu wywołaj narzędzie.
5. Działaj oszczędnie: nie czytaj wielokrotnie tych samych plików; narzędzie vision używaj tylko gdy potrzebne (np. do potwierdzenia kodu trasy).

Zwracaj uwagę na: zgodność z regulaminem (kategorie, opłaty, trasy wyłączone), brak uwag specjalnych, kwotę 0 PP. Nie odpowiadaj długim tekstem zamiast wywołania narzędzia – jedyna właściwa akcja po zebraniu danych to wywołanie submit_sendit_declaration.`,
} as const;

export { apiKey };
