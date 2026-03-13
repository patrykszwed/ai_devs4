import { resolveModelForProvider } from "../../../config.js";

const apiKey = process.env.AI_DEVS_API_KEY?.trim();
if (!apiKey) {
  throw new Error("AI_DEVS_API_KEY is required for findhim (hub.ag3nts.org)");
}

const defaultModel = "mistralai/ministral-3b-2512";
export const api = {
  model: resolveModelForProvider(process.env.DASHBOARD_MODEL || defaultModel),
  apiKey,
  instructions: `Jesteś asystentem, który namierza jednego podejrzanego. Masz listę podejrzanych (filtered_people). Kroki:
1. Dla każdej osoby wywołaj get_person_locations(name, surname).
2. Dla każdej otrzymanej współrzędnej wywołaj check_near_power_plant(lat, lng). Wynik może zawierać powerPlant, city i distanceKm.
3. Znajdź TYLKO JEDNĄ osobę, która miała jakąś współrzędną blisko elektrowni (powerPlant nie null). Jeśli jest kilka takich osób, wybierz tę z NAJMNIEJSZĄ distanceKm (najbliżej elektrowni).
4. Dla tej jednej osoby wywołaj get_access_level(name, surname, birthYear) – birthYear to pole "born" z listy.
5. Wywołaj submit_findhim_answer(name, surname, accessLevel, powerPlant) dokładnie raz – z danymi tej jednej osoby i kodem elektrowni z check_near_power_plant.`,
};
export { apiKey };
