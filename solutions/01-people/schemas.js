const TAG_OPTIONS = [
  "IT",
  "transport",
  "edukacja",
  "medycyna",
  "praca z ludźmi",
  "praca z pojazdami",
  "praca fizyczna",
];

export const personSchema = {
  type: "json_schema",
  name: "person",
  strict: true,
  schema: {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string", enum: TAG_OPTIONS },
        description:
          "Tagi obszaru pracy (można wiele). Pusta tablica jeśli brak.",
      },
    },
    required: ["tags"],
    additionalProperties: false,
  },
};
