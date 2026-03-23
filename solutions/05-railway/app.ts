import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { api } from "./src/config";
import { tools } from "./src/tools/definitions";
import { createHandlers } from "./src/tools/handlers";
import { runAgent } from "./src/agent";

const __dirname = dirname(fileURLToPath(import.meta.url));

const main = async () => {
  const handlers = createHandlers();

  const initialInput = `
Masz rozwiązać zadanie "railway" z AI_DEVS, korzystając wyłącznie z API tego zadania udostępnianego przez narzędzie call_railway_api.

Kontekst:
- API nie ma zewnętrznej dokumentacji – jedynym źródłem jest akcja "help" w samym API.
- Narzędzie call_railway_api automatycznie uzupełnia apikey i task; Ty przekazujesz jedynie answer.

Twoje zadanie:
1. Najpierw wywołaj call_railway_api z answer { "action": "help" }, aby pobrać dokumentację API.
2. Na podstawie zwróconej dokumentacji:
   - ustal jakie są dostępne akcje,
   - jakie parametry przyjmują,
   - jaką kolejność trzeba zachować, aby ukończyć scenariusz z zadania.
3. Następnie wykonuj kolejne, dobrze przemyślane wywołania call_railway_api:
   - za każdym razem przekazując w answer dokładnie takie pola, jakie wymaga dokumentacja,
   - pilnując poprawnej kolejności opisanej w help.
4. Błędy (np. zła kolejność, zły parametr) traktuj jako wskazówkę:
   - odczytaj komunikat z odpowiedzi,
   - popraw parametry w kolejnym wywołaniu, zamiast zgadywać przypadkowo.

Ograniczenia:
- API jest przeciążone i może zwracać błędy 503 – są one automatycznie obsługiwane przez narzędzie (retry z backoffem).
- API ma bardzo restrykcyjne limity – narzędzie korzysta z nagłówków limitów i w razie potrzeby czeka przed kolejnymi próbami.
- Ty masz minimalizować liczbę wywołań:
  - nie powtarzaj help bez potrzeby,
  - nie wysyłaj wielu podobnych zapytań,
  - celuj w najkrótszą ścieżkę opisaną w dokumentacji z help.

Zakończenie:
- Szukaj w odpowiedziach komunikatu o pomyślnym ukończeniu (token ukończenia w formacie opisanym w materiałach kursu).
- Gdy zadanie jest ukończone, możesz krótko podsumować kroki.
`.trim();

  const usageAcc = { inputTokens: 0, outputTokens: 0 };

  const { text, submitResult } = await runAgent({
    model: api.model,
    tools: [...tools],
    handlers,
    instructions: api.instructions,
    initialInput,
    usageAcc,
  });

  console.log("\nAgent result:", text ?? "<no text>");
  if (submitResult != null) {
    console.log("\n--- Last railway API response ---");
    console.log(JSON.stringify(submitResult.response, null, 2));
    if (submitResult.flag) {
      console.log("\n🎉 Flag:", submitResult.flag);
    }
  }
  console.log(
    `\nToken usage (approx): input=${usageAcc.inputTokens}, output=${usageAcc.outputTokens}`,
  );
};

main().catch((error) => {
  console.error("Error running railway agent:", error);
  process.exitCode = 1;
});
