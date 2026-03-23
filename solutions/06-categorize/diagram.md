# Działanie rozwiązania 06-categorize

```mermaid
flowchart TB
  subgraph app["app.ts"]
    A[Start] --> B[runAgent: instructions + initialInput]
  end

  subgraph agent_loop["Pętla agenta (agent.ts)"]
    B --> C[Model LLM / Ministral]
    C --> D{Wywołanie narzędzia?}
    D -->|Nie| E[Odpowiedź tekstowa → koniec]
    D -->|Tak: run_categorize_cycle| F[Handler z prompt_template]
  end

  subgraph handler["handlers.ts: run_categorize_cycle"]
    F --> G[POST reset do huba kursu]
    G --> H[GET CSV z huba]
    H --> I[Dla każdego wiersza CSV:]
    I --> J["prompt = template.replace({id}, {description})"]
    J --> K[POST weryfikacja: answer.prompt]
    K --> L[Hub zwraca kody statusu (interpretacja wg kursu)]
    L --> M[Zbierz wynik, wrongClassification, budgetExceeded]
    M --> N[Zwrot: ok, flag, error, wrongClassification, results]
  end

  N --> C
  C --> D

  subgraph hub["Hub kursu"]
    G -.-> hub_api[endpoint weryfikacji]
    K -.-> hub_api
    hub_api --> classifier["Wewnętrzny model (limity z zadania)"]
    classifier --> hub_resp["Kody i znaczenie odpowiedzi — wg materiałów prywatnych kursu"]
  end
```

## Skrót przepływu

| Krok | Gdzie | Co się dzieje |
|------|--------|----------------|
| 1 | app.ts | Uruchomienie agenta z instrukcjami i initialInput. |
| 2 | agent.ts | Model dostaje kontekst i decyduje o wywołaniu narzędzia. |
| 3 | Agent → tool | Wywołanie `run_categorize_cycle` z **prompt_template** (agent go generuje). |
| 4 | handlers.ts | Reset na hubie → pobranie CSV → dla każdego wiersza: złożenie promptu z szablonu + id + description. |
| 5 | handlers.ts → hub | **Ten prompt** (w ramach limitów z zadania) jest wysyłany do huba; wewnętrzny model zwraca etykiety zgodnie z materiałami kursu. |
| 6 | handlers.ts | Z odpowiedzi huba: wyciąganie wyniku, wrongClassification, budgetExceeded; zwrot do agenta. |
| 7 | agent.ts | Jeśli sukces → koniec. Jeśli błąd → agent poprawia prompt_template i znowu wywołuje `run_categorize_cycle`. |

Limity długości promptu do wewnętrznego modelu huba — zgodnie z prywatną treścią zadania.
