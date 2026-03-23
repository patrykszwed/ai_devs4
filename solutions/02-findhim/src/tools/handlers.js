import {
  hubUrlFromPathEnv,
  hubVerifyUrl,
} from "../../../../hub-paths.js";

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const NEAR_KM = 5;

const normalizeLatLng = (a, b) => {
  const lat = a ?? b;
  const lng = a != null && b != null ? (a === lat ? b : a) : (b ?? a);
  if (lat >= 14 && lat <= 25 && lng >= 49 && lng <= 55) return { lat: lng, lng: lat };
  return { lat, lng };
};

export const createHandlers = (apikey, powerPlants) => {
  return {
    async get_person_locations({ name, surname }) {
      const res = await fetch(hubUrlFromPathEnv("AI_DEVS_HUB_PATH_API_LOCATION"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey, name, surname })
      });
      if (!res.ok) throw new Error(`location API: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const raw = Array.isArray(data) ? data : data?.coordinates ?? [];
      const coordinates = raw.map((p) => {
        const a = p.lat ?? p.latitude ?? p[0];
        const b = p.lng ?? p.longitude ?? p[1];
        return normalizeLatLng(a, b);
      });
      return { coordinates };
    },

    async get_access_level({ name, surname, birthYear }) {
      const res = await fetch(hubUrlFromPathEnv("AI_DEVS_HUB_PATH_API_ACCESSLEVEL"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey, name, surname, birthYear })
      });
      if (!res.ok) throw new Error(`accesslevel API: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const level = data?.accessLevel ?? data?.level ?? data;
      return { accessLevel: typeof level === "number" ? level : parseInt(level, 10) };
    },

    check_near_power_plant({ lat, lng }) {
      const { lat: latN, lng: lngN } = normalizeLatLng(lat, lng);
      let best = null;
      let bestKm = Infinity;
      for (const plant of powerPlants) {
        const km = haversineKm(latN, lngN, plant.lat, plant.lng);
        if (km <= NEAR_KM && km < bestKm) {
          bestKm = km;
          best = { powerPlant: plant.code, city: plant.city, distanceKm: Math.round(km * 100) / 100 };
        }
      }
      if (best) return best;
      return { powerPlant: null, city: null, distanceKm: null };
    },

    async submit_findhim_answer({ name, surname, accessLevel, powerPlant }) {
      const res = await fetch(hubVerifyUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey,
          task: "findhim",
          answer: { name, surname, accessLevel, powerPlant }
        })
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`verify: ${res.status} ${text}`);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
      return { success: true, response: body };
    }
  };
};
