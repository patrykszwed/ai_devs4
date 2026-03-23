// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { resolveModelForProvider } from "../../../config.js";

const apiKey = process.env.AI_DEVS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("AI_DEVS_API_KEY is required for sendit");
}

const defaultModel = "mistralai/ministral-3b-2512";

export const api = {
  model: resolveModelForProvider(process.env.DASHBOARD_MODEL || defaultModel),
  visionModel: resolveModelForProvider(defaultModel),
  apiKey,
  instructions: `Jesteś agentem pomocniczym do wypełniania deklaracji Systemu Przesyłek Konduktorskich (SPK).

## CEL
- Na podstawie lokalnej dokumentacji SPK (pliki skopiowane z prywatnych materiałów kursu do katalogu tego rozwiązania) oraz danych z briefu misji przygotuj poprawną deklarację.
- Nie generujesz samodzielnie pełnego tekstu deklaracji – gdy masz pewność co do wszystkich danych, wywołujesz narzędzie do wysłania deklaracji (zbuduje i wyśle dokument do endpointu weryfikacji huba).

## ZASADY
1. Czytaj dokumentację SPK z katalogu rozwiązania (teksty i ewentualny obraz tabeli tras). Nazwy plików zależą od materiałów kursu — użyj narzędzi do odczytu.
2. Gdy potrzebujesz informacji z tabeli tras wyłączonych – użyj narzędzia vision na odpowiednim PNG.
3. Z dokumentacji ustal: kategorię, kod trasy, opłaty, WDP itd. zgodnie z briefem.
4. Gdy deklaracja jest gotowa – wywołaj submit_sendit_declaration dokładnie raz.
5. Działaj oszczędnie: nie czytaj wielokrotnie tych samych plików.

Zwracaj uwagę na zgodność z regulaminem SPK. Jedyna właściwa akcja po zebraniu danych to wywołanie submit_sendit_declaration.`,
} as const;

export { apiKey };
