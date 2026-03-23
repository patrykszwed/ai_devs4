export const tools = [
  {
    type: "function" as const,
    name: "zmail_help",
    description:
      "Sprawdza dostępne akcje i parametry API skrzynki mailowej zmail. Wywołaj raz na początku, żeby poznać możliwości API.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "zmail_get_inbox",
    description:
      "Pobiera listę wiadomości ze skrzynki mailowej. Zwraca metadane wiadomości (ID, nadawca, temat, data) bez pełnej treści. Użyj zmail_get_message po ID, żeby przeczytać treść.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "number",
          description: "Numer strony (od 1). Domyślnie 1.",
        },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "zmail_search",
    description:
      'Wyszukuje wiadomości w skrzynce mailowej z użyciem operatorów Gmail: from:, to:, subject:, OR, AND. Np. "from:proton.me" lub "subject:password OR subject:haslo". Zwraca metadane bez pełnej treści.',
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Zapytanie wyszukiwania w formacie Gmail: from:, to:, subject:, OR, AND. Np. "from:proton.me", "subject:attack", "SEC-".',
        },
        page: {
          type: "number",
          description: "Numer strony wyników (od 1). Domyślnie 1.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "zmail_get_message",
    description:
      "Pobiera pełną treść wiadomości mailowej po jej ID. Zawsze wywołuj to narzędzie przed wyciąganiem wniosków z maila - sama lista nie zawiera treści.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            "ID wiadomości zwrócone przez zmail_get_inbox lub zmail_search.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function" as const,
    name: "submit_answer",
    description:
      "Wysyła znalezione odpowiedzi do huba zadania mailbox. Zwraca flagę {FLG:...} jeśli wszystkie trzy wartości są poprawne, lub feedback co jest błędne/brakuje.",
    parameters: {
      type: "object",
      properties: {
        password: {
          type: "string",
          description:
            "Hasło do systemu pracowniczego znalezione w skrzynce mailowej.",
        },
        date: {
          type: "string",
          description:
            "Data planowanego ataku na elektrownię w formacie YYYY-MM-DD.",
        },
        confirmation_code: {
          type: "string",
          description:
            "Kod potwierdzenia z ticketa działu bezpieczeństwa. Przepisz dokładnie tak jak widnieje w mailu (zaczyna się od SEC-).",
        },
      },
      required: ["password", "date", "confirmation_code"],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;
