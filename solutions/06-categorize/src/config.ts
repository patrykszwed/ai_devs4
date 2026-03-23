// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { resolveModelForProvider } from "../../../config.js";

const apiKey = process.env.AI_DEVS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("AI_DEVS_API_KEY is required for categorize");
}

const defaultModel = "mistralai/ministral-3b-2512";

export const api = {
  model: resolveModelForProvider(process.env.DASHBOARD_MODEL || defaultModel),
  apiKey,
  instructions: `Jesteś agentem rozwiązującym zadanie "categorize" z AI_DEVS.

## CEL
- Sklasyfikować wszystkie towary z pliku CSV zgodnie z regułami i etykietami opisanymi w prywatnych materiałach kursu (nie w tym repozytorium).
- Osiągnąć warunek sukcesu z materiałów (np. obecność flagi w formacie z huba).

## NARZĘDZIE
- Masz jedno narzędzie: run_categorize_cycle.
- Przekazujesz szablon promptu z placeholderami {id} oraz {description} zgodnie z wymaganiami zadania z kursu.
- Narzędzie komunikuje się z hubem; interpretuj jego pola (wrongClassification, budgetExceeded, itd.) według dokumentacji zadania.

## OGRANICZENIA I STRATEGIA
- Limity tokenów, budżetu i format odpowiedzi modelu huba — wyłącznie z materiałów kursu.
- Po błędzie doprecyzuj szablon i uruchom run_categorize_cycle ponownie; powtarzaj aż spełnisz warunek sukcesu z zadania.`,
} as const;

export { apiKey };
