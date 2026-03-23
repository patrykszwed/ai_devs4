export const tools = [
  {
    type: "function" as const,
    name: "get_log_overview",
    description:
      "Zwraca statystyki pliku failure.log: liczbę linii, przybliżoną liczbę tokenów, rozkład poziomów ważności, główne podzespoły i reprezentatywne alerty.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "get_component_story",
    description:
      "Zwraca skondensowaną historię jednego podzespołu z logów failure: pierwsze alerty, pierwszy błąd/krytyk, ostatnie alerty i powiązane podzespoły.",
    parameters: {
      type: "object",
      properties: {
        component: {
          type: "string",
          description:
            'Identyfikator podzespołu, np. "ECCS8", "WTANK07", "WTRPMP", "WSTPOOL2", "PWR01", "STMTURB12", "FIRMWARE".',
        },
      },
      required: ["component"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "search_events",
    description:
      "Przeszukuje logi i zwraca krótką listę pasujących zdarzeń. Można filtrować po komponencie, poziomie ważności i fragmencie tekstu.",
    parameters: {
      type: "object",
      properties: {
        component: {
          type: "string",
          description: 'Opcjonalny podzespół, np. "ECCS8".',
        },
        severity: {
          type: "string",
          enum: ["INFO", "WARN", "ERRO", "CRIT"],
          description: "Opcjonalny poziom ważności.",
        },
        query: {
          type: "string",
          description: "Opcjonalna fraza do wyszukania w surowej treści linii.",
        },
        limit: {
          type: "number",
          description: "Liczba wyników 1-50. Domyślnie 20.",
        },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "build_candidate_logs",
    description:
      "Buduje gotowy string logs do wysłania na hub. Sam pilnuje skracania wpisów i dopasowania do limitu tokenów. Zwraca także candidate_id do bezpiecznego wysłania bez ręcznego przepisywania.",
    parameters: {
      type: "object",
      properties: {
        strategy: {
          type: "string",
          enum: ["balanced", "broad", "focused", "tail-heavy"],
          description:
            'balanced = szeroki, ale oszczędny; broad = maksymalna pokrywalność; focused = preferuje focus_components; tail-heavy = mocniej eksponuje końcową sekwencję awarii.',
        },
        focus_components: {
          type: "array",
          items: { type: "string" },
          description:
            'Opcjonalna lista podzespołów, które mają dostać dodatkowy priorytet, np. ["WTANK07","ECCS8"].',
        },
        max_tokens: {
          type: "number",
          description:
            "Konserwatywny limit tokenów dla wygenerowanego stringa. Domyślnie 1400.",
        },
        final_window_alerts: {
          type: "number",
          description:
            "Ile ostatnich alertów zawsze uwzględnić jako końcowe okno incydentu. Domyślnie 20.",
        },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "submit_logs",
    description:
      'Wysyła gotowy string logs do zadania "failure" na hub i zwraca feedback techników lub flagę. Preferuj candidate_id z build_candidate_logs zamiast ręcznego przekazywania logs.',
    parameters: {
      type: "object",
      properties: {
        candidate_id: {
          type: "string",
          description:
            "Id kandydata zwrócone przez build_candidate_logs. Gdy podane, narzędzie samo pobiera dokładny string logs z cache.",
        },
        logs: {
          type: "string",
          description:
            "String z wieloliniowymi logami. Każda linia to jedno zdarzenie, linie oddzielone znakiem \\n. Używaj tylko jeśli naprawdę musisz poprawić tekst ręcznie.",
        },
      },
      additionalProperties: false,
    },
    strict: true,
  },
] as const;
