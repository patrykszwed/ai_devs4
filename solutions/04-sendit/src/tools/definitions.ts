export const tools = [
  {
    type: "function",
    name: "read_trasy_wylaczone_vision",
    description:
      "Odczytuje z obrazu trasy-wylaczone.png tabelę tras wyłączonych (X-01..X-08) przy pomocy modelu vision. Użyj, gdy potrzebujesz potwierdzić kod trasy lub szczegóły.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Opcjonalna ścieżka do pliku PNG; jeśli nie podasz, użyty zostanie domyślny plik solutions/04-sendit/trasy-wylaczone.png.",
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
      "Buduje poprawną deklarację SPK dla zadania 'sendit' (Gdańsk → Żarnowiec, kasety z paliwem do reaktora) i wysyła ją do /verify. Wywołaj dokładnie raz, gdy masz pewność co do danych.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;

