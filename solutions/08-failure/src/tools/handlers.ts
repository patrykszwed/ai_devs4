import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { apiKey } from "../config.js";
import {
  buildCandidateLogs,
  buildComponentStory,
  buildOverview,
  estimateTokens,
  extractComponentHints,
  loadEntries,
  searchEntries,
  type Severity,
} from "../logs.js";
import { hubVerifyUrl } from "../../../../hub-paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..", "..");
const LOG_PATH = join(ROOT_DIR, "failure.log");

const extractFlag = (text: string) => text.match(/\{FLG:[^}]+}/)?.[0];
const VALID_LINE_RE =
  /^\[\d{4}-\d{2}-\d{2} (?:\d:|\d{2}:)\d{2}\] \[(?:INFO|WARN|ERRO|CRIT)\] .+/;

const parseBody = (raw: string) => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

export const createHandlers = () => {
  const entries = loadEntries(LOG_PATH);
  const candidateCache = new Map<string, string>();
  let candidateSeq = 0;

  const validateLogs = (logs: string) => {
    const lines = logs.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return {
        ok: false,
        message: "logs is empty",
      };
    }

    const invalidLine = lines.find((line) => !VALID_LINE_RE.test(line));
    if (invalidLine) {
      return {
        ok: false,
        message: `Invalid log line format: "${invalidLine}"`,
      };
    }

    return { ok: true, lines };
  };

  return {
    async get_log_overview() {
      return {
        ok: true,
        ...buildOverview(entries),
      };
    },

    async get_component_story({ component }: { component: string }) {
      return {
        ok: true,
        ...buildComponentStory(entries, component),
      };
    },

    async search_events({
      component,
      severity,
      query,
      limit,
    }: {
      component?: string;
      severity?: Severity;
      query?: string;
      limit?: number;
    }) {
      const results = searchEntries(entries, {
        component,
        severity,
        query,
        limit,
      });

      return {
        ok: true,
        count: results.length,
        results,
      };
    },

    async build_candidate_logs({
      strategy,
      focus_components,
      max_tokens,
      final_window_alerts,
    }: {
      strategy?: "balanced" | "broad" | "focused" | "tail-heavy";
      focus_components?: string[];
      max_tokens?: number;
      final_window_alerts?: number;
    }) {
      const candidate = buildCandidateLogs(entries, {
        strategy,
        focusComponents: focus_components,
        maxTokens: max_tokens,
        finalWindowAlerts: final_window_alerts,
      });

      candidateSeq += 1;
      const candidateId = `candidate-${candidateSeq}`;
      candidateCache.set(candidateId, candidate.logs);

      return {
        ok: true,
        ...candidate,
        candidate_id: candidateId,
        preview: candidate.logs.split("\n").slice(0, 12),
      };
    },

    async submit_logs({
      candidate_id,
      logs,
    }: {
      candidate_id?: string;
      logs?: string;
    }) {
      const resolvedLogs = candidate_id
        ? candidateCache.get(candidate_id)
        : logs;

      if (!resolvedLogs) {
        return {
          ok: false,
          status: 0,
          estimatedTokens: 0,
          submittedLineCount: 0,
          flag: undefined,
          body: {
            code: -1,
            message: candidate_id
              ? `Unknown candidate_id: ${candidate_id}`
              : "Provide candidate_id or logs",
          },
          rawBodyPreview: "",
          technicianHints: [],
        };
      }

      const validation = validateLogs(resolvedLogs);
      if (!validation.ok) {
        return {
          ok: false,
          status: 0,
          estimatedTokens: estimateTokens(resolvedLogs),
          submittedLineCount: resolvedLogs.split("\n").filter(Boolean).length,
          flag: undefined,
          body: {
            code: -2,
            message: validation.message,
          },
          rawBodyPreview: validation.message,
          technicianHints: [],
        };
      }

      const response = await fetch(hubVerifyUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apikey: apiKey,
          task: "failure",
          answer: {
            logs: resolvedLogs,
          },
        }),
      });

      const rawBody = await response.text();
      const parsedBody = parseBody(rawBody);
      const successCode =
        typeof parsedBody === "object" &&
        parsedBody !== null &&
        "code" in parsedBody &&
        typeof (parsedBody as { code?: unknown }).code === "number"
          ? (parsedBody as { code: number }).code
          : null;
      const flag = successCode === 0 ? extractFlag(rawBody) : undefined;
      const technicianText =
        typeof parsedBody === "object" &&
        parsedBody !== null &&
        "message" in parsedBody &&
        typeof (parsedBody as { message?: unknown }).message === "string"
          ? (parsedBody as { message: string }).message
          : rawBody;

      return {
        ok: response.ok && successCode === 0,
        status: response.status,
        estimatedTokens: estimateTokens(resolvedLogs),
        submittedLineCount: resolvedLogs.split("\n").filter(Boolean).length,
        candidate_id,
        successCode,
        flag,
        body: parsedBody ?? { raw: rawBody },
        rawBodyPreview: rawBody.slice(0, 1000),
        technicianHints: extractComponentHints(technicianText),
      };
    },
  } as const;
};
