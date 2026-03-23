export const tools = [
  {
    type: "function" as const,
    name: "inspect_board",
    description:
      "Resetuje opcjonalnie planszę electricity, pobiera obraz PNG, zamienia go na reprezentację tekstową 3x3 i zwraca zalecany plan obrotów względem obrazu docelowego.",
    parameters: {
      type: "object",
      properties: {
        reset: {
          type: "boolean",
          description:
            "Jeśli true, pobierz planszę po resecie (electricity.png?reset=1).",
        },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "rotate_tile",
    description:
      "Wykonuje dokładnie jeden obrót wskazanego pola planszy electricity o 90 stopni w prawo.",
    parameters: {
      type: "object",
      properties: {
        cell: {
          type: "string",
          description: 'Adres pola w formacie "AxB", np. "2x3".',
          enum: [
            "1x1",
            "1x2",
            "1x3",
            "2x1",
            "2x2",
            "2x3",
            "3x1",
            "3x2",
            "3x3",
          ],
        },
      },
      required: ["cell"],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;
