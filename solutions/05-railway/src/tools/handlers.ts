import { hubVerifyUrl } from "../../../../hub-paths.js";
import { api, apiKey } from "../config";

type HeadersSnapshot = Record<string, string>;

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseRetryAfterMs = (headers: Headers): number | null => {
  const retryAfter =
    headers.get("retry-after") ??
    headers.get("Retry-After") ??
    headers.get("x-ratelimit-reset-after");
  if (!retryAfter) return null;

  const asNumber = Number(retryAfter);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    // Interpret as seconds by default.
    return asNumber * 1000;
  }

  const date = new Date(retryAfter);
  if (!Number.isNaN(date.getTime())) {
    const diff = date.getTime() - Date.now();
    return diff > 0 ? diff : null;
  }

  return null;
};

const parseRateLimitResetMs = (headers: Headers): number | null => {
  const remaining =
    headers.get("x-ratelimit-remaining") ??
    headers.get("X-RateLimit-Remaining");
  if (!remaining || Number(remaining) > 0) {
    return null;
  }

  const reset =
    headers.get("x-ratelimit-reset") ?? headers.get("X-RateLimit-Reset");
  if (!reset) return null;

  const asNumber = Number(reset);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    // Heuristic: treat small numbers as seconds from now, large as unix seconds.
    if (asNumber < 10_000_000_000) {
      return asNumber * 1000;
    }
    const diff = asNumber * 1000 - Date.now();
    return diff > 0 ? diff : null;
  }

  const date = new Date(reset);
  if (!Number.isNaN(date.getTime())) {
    const diff = date.getTime() - Date.now();
    return diff > 0 ? diff : null;
  }

  return null;
};

const headersToSnapshot = (headers: Headers): HeadersSnapshot => {
  const snapshot: HeadersSnapshot = {};
  headers.forEach((value, key) => {
    snapshot[key.toLowerCase()] = value;
  });
  return snapshot;
};

const extractFlag = (text: string): string | null => {
  const match = text.match(/\{FLG:[^}]+}/);
  return match ? match[0] : null;
};

type RailwayCallResult = {
  ok: boolean;
  status: number;
  headers: HeadersSnapshot;
  rawBody: string;
  jsonBody: unknown | null;
  flag: string | null;
};

const callRailwayWithRetries = async (
  answer: unknown,
  maxAttempts = 5,
): Promise<RailwayCallResult> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const body = {
        apikey: apiKey,
        task: "railway" as const,
        answer,
      };

      const response = await fetch(hubVerifyUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const headersSnapshot = headersToSnapshot(response.headers);
      const rawBody = await response.text();
      let jsonBody: unknown | null = null;
      try {
        jsonBody = JSON.parse(rawBody);
      } catch {
        jsonBody = null;
      }

      const flag = extractFlag(rawBody);

      if (response.status === 503 || response.status === 429) {
        const retryMs =
          parseRetryAfterMs(response.headers) ??
          parseRateLimitResetMs(response.headers);

        if (attempt >= maxAttempts) {
          return {
            ok: false,
            status: response.status,
            headers: headersSnapshot,
            rawBody,
            jsonBody,
            flag,
          };
        }

        const backoffMs =
          retryMs ??
          // simple exponential backoff with jitter
          (500 * 2 ** (attempt - 1) + Math.random() * 200);

        await sleep(backoffMs);
        continue;
      }

      // Respect reset header even przy sukcesie z wyczerpanym limitem.
      const resetMs = parseRateLimitResetMs(response.headers);
      if (resetMs && resetMs > 0) {
        await sleep(resetMs);
      }

      return {
        ok: response.ok,
        status: response.status,
        headers: headersSnapshot,
        rawBody,
        jsonBody,
        flag,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        throw error;
      }
      const backoffMs = 500 * 2 ** (attempt - 1) + Math.random() * 200;
      await sleep(backoffMs);
    }
  }

  throw lastError ?? new Error("callRailwayWithRetries failed");
};

export const createHandlers = () => {
  return {
    async call_railway_api({ answer }: { answer: unknown }) {
      const result = await callRailwayWithRetries(answer);

      return {
        model: api.model,
        ok: result.ok,
        status: result.status,
        headers: result.headers,
        body: result.jsonBody ?? { raw: result.rawBody },
        rawBodyPreview: result.rawBody.slice(0, 500),
        flag: result.flag,
      };
    },
  } as const;
};

