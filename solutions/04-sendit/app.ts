import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { api } from "./src/config";
import { tools } from "./src/tools/definitions";
import { createHandlers } from "./src/tools/handlers";
import { runAgent } from "./src/agent";

const __dirname = dirname(fileURLToPath(import.meta.url));

const main = async () => {
  const handlers = createHandlers({
    docsDir: join(__dirname, "."),
  });

  const initialInput = `
Masz przygotować deklarację nadania przesyłki w Systemie Przesyłek Konduktorskich (zadanie "sendit").

Kontekst:
- dokumentacja SPK jest dostępna lokalnie w katalogu solutions/04-sendit (index.md + załączniki, w tym trasy-wylaczone.png)
- możesz korzystać z narzędzi do czytania plików, analizy obrazu z tabelą tras wyłączonych oraz wysłania gotowej deklaracji

Wymagania biznesowe dla tej konkretnej przesyłki:
- NADAWCA (identyfikator): 450202122
- PUNKT NADAWCZY: Gdańsk
- PUNKT DOCELOWY: Żarnowiec
- WAGA: około 2,8 tony (2800 kg)
- BUDŻET: 0 PP (przesyłka ma być darmowa lub finansowana przez System)
- ZAWARTOŚĆ: kasety z paliwem do reaktora
- UWAGI SPECJALNE: brak (nie dodawaj żadnych uwag)

Twoim celem jest:
1. Zrozumieć z dokumentacji:
   - jakie są kategorie przesyłek i która pasuje do kaset z paliwem do reaktora przy zerowym budżecie,
   - jak działają trasy (w tym wyłączone) między Gdańskiem a Żarnowcem,
   - jak liczone są opłaty (OB, OW, OT), dodatkowe wagony (WDP) i kiedy opłaty pokrywa System.
2. W razie potrzeby użyj vision na pliku trasy-wylaczone.png, aby potwierdzić kod trasy Gdańsk–Żarnowiec.
3. NIE buduj ręcznie pełnego tekstu deklaracji i NIE wypisuj podsumowania z pytaniem o potwierdzenie. Gdy będziesz pewien danych (kategoria, kod trasy, metoda opłat, 0 PP), od razu wywołaj dokładnie raz narzędzie submit_sendit_declaration – bez czekania na potwierdzenie.
4. Zadbaj, aby końcowa deklaracja korzystała z właściwego kodu trasy, prawidłowej kategorii, WDP oraz kwoty 0 PP.

Kolejność: przeczytaj index.md i załączniki, w razie potrzeby vision na trasy-wylaczone.png, a gdy dane są ustalone – natychmiast wywołaj submit_sendit_declaration (nie pisz długiej odpowiedzi zamiast wywołania).
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
    console.log("\n--- Verify response ---");
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
  console.error("Error running sendit agent:", error);
  process.exitCode = 1;
});
