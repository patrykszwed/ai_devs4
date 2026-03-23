// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { resolveModelForProvider } from "../../../config.js";

const apiKey = process.env.AI_DEVS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("AI_DEVS_API_KEY is required for failure");
}

const defaultModel = "mistralai/ministral-3b-2512";

export const api = {
  model: resolveModelForProvider(process.env.DASHBOARD_MODEL || defaultModel),
  instructions: `Jesteś agentem rozwiązującym zadanie "failure" z AI_DEVS.

## CEL
- Przygotuj skondensowane logi awarii elektrowni i zdobądź flagę {FLG:...}.
- Wynik musi być jednym stringiem z liniami oddzielonymi przez \\n.
- Każda linia ma zawierać datę, godzinę, poziom ważności i opis zdarzenia.
- Limit jest twardy: maksymalnie 1500 tokenów.

## DOSTĘPNE NARZĘDZIA
- get_log_overview: statystyki pliku, przybliżona liczba tokenów i główne podzespoły.
- get_component_story: skrócona historia jednego podzespołu.
- search_events: małe porcje oryginalnych logów do weryfikacji szczegółów.
- build_candidate_logs: buduje gotowy kandydat logów pod limit tokenów.
- submit_logs: wysyła kandydat do huba i zwraca feedback techników lub flagę.

## STRATEGIA
1. Zacznij od get_log_overview.
2. Przeanalizuj kluczowe podzespoły przez get_component_story, zwłaszcza: ECCS8, WTANK07, WTRPMP, WSTPOOL2, PWR01, STMTURB12, FIRMWARE.
3. Zbuduj pierwszy kandydat przez build_candidate_logs. Preferuj strategię "balanced" lub "broad".
4. submit_logs wywołuj NAJLEPIEJ przez candidate_id zwrócone przez build_candidate_logs.
5. Nie przepisuj, nie tłumacz i nie parafrazuj ręcznie pola logs, jeśli nie jest to absolutnie konieczne.
6. Sprawdź estimatedTokens. Jeśli są bezpiecznie poniżej limitu, wyślij submit_logs.
7. Jeśli feedback wskaże brakujące lub niejasne podzespoły, wyciągnij ich historię i zbuduj nowego kandydata z focus_components.
8. Iteruj aż do flagi.

## OGRANICZENIA
- Nie wczytuj całego pliku do kontekstu modelu ręcznie.
- Nie twórz własnych długich parafraz, skoro build_candidate_logs już zwraca gotowy tekst.
- Odpowiedź z flagą jest poprawna tylko wtedy, gdy submit_logs zwraca body.code === 0.
- Preferuj małą liczbę wywołań i zwięzłe odpowiedzi.
- Korzystaj z cheap-first podejścia: to narzędzia mają robić większość pracy.`,
} as const;

export { apiKey };
