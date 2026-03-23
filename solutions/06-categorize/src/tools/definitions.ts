export const tools = [
  {
    type: "function" as const,
    name: "run_categorize_cycle",
    description:
      "Uruchamia pełny cykl zadania categorize: reset, pobranie CSV, kolejne zapytania do huba z podanym szablonem promptu (placeholdery {id}, {description}). Zwraca m.in. sukces/błąd, szczegóły błędnej klasyfikacji, flagę przy sukcesie, informację o budżecie — zgodnie z odpowiedzią huba.",
    parameters: {
      type: "object",
      properties: {
        prompt_template: {
          type: "string",
          description:
            "Szablon promptu z placeholderami {id} i {description}; treść i język muszą być zgodne z wymaganiami zadania z materiałów kursu.",
        },
      },
      required: ["prompt_template"],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;
