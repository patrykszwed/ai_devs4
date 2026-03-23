export const tools = [
  {
    type: "function",
    name: "call_railway_api",
    description:
      'Wywołuje API zadania "railway" na hubie kursu. Użyj NAJPIERW z answer { "action": "help" }, aby pobrać dokumentację, a potem zgodnie z nią wykonuj kolejne akcje aż do ukończenia zadania.',
    parameters: {
      type: "object",
      properties: {
        answer: {
          type: "object",
          description:
            'Obiekt answer, który zostanie wysłany do API zadania "railway". Musi zawierać co najmniej pole "action" oraz wszystkie inne pola wymagane przez dokumentację zwróconą przez help.',
          additionalProperties: true,
        },
      },
      required: ["answer"],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;
