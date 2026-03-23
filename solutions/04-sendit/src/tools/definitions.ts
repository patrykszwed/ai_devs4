export const tools = [
  {
    type: "function",
    name: "read_trasy_wylaczone_vision",
    description:
      "Odczytuje tabelę tras wyłączonych z pliku PNG (vision). Użyj, gdy potrzebujesz potwierdzić kod trasy lub szczegóły z obrazu.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Opcjonalna ścieżka do pliku PNG; jeśli nie podasz, użyty zostanie domyślny plik w katalogu rozwiązania.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "submit_sendit_declaration",
    description:
      "Buduje deklarację SPK z parametrów środowiskowych (SENDIT_*) i wysyła ją do weryfikacji. Wywołaj dokładnie raz, gdy masz pewność co do danych.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;
