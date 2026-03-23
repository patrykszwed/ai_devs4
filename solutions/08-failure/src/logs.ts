import { readFileSync } from "node:fs";

export type Severity = "INFO" | "WARN" | "ERRO" | "CRIT";

export type LogEntry = {
  lineNumber: number;
  raw: string;
  timestamp: string;
  date: string;
  time: string;
  severity: Severity;
  message: string;
  components: string[];
};

export type BuildStrategy = "balanced" | "broad" | "focused" | "tail-heavy";

export type BuildCandidateArgs = {
  strategy?: BuildStrategy;
  focusComponents?: string[];
  maxTokens?: number;
  finalWindowAlerts?: number;
};

type SelectedEntry = {
  entry: LogEntry;
  priority: number;
  reasons: string[];
  protected: boolean;
};

const LINE_RE =
  /^\[(?<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(?<severity>INFO|WARN|ERRO|CRIT)\] (?<message>.+)$/;
const COMPONENT_RE = /\b[A-Z]{2,}[A-Z0-9_-]*\d*\b/g;
const NON_COMPONENT_TOKENS = new Set(["INFO", "WARN", "ERRO", "CRIT"]);
const IMPORTANT_COMPONENTS = [
  "ECCS8",
  "WTANK07",
  "WTRPMP",
  "WSTPOOL2",
  "PWR01",
  "STMTURB12",
  "FIRMWARE",
];

let cachedEntries: LogEntry[] | null = null;

const dedupe = <T>(items: T[]) => [...new Set(items)];

const extractComponents = (message: string) =>
  dedupe(
    [...message.matchAll(COMPONENT_RE)]
      .map(([token]) => token)
      .filter((token) => !NON_COMPONENT_TOKENS.has(token)),
  );

export const estimateTokens = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const byChars = Math.ceil(trimmed.length / 3.2);
  const byWords = Math.ceil(trimmed.split(/\s+/).filter(Boolean).length * 1.35);
  return Math.max(byChars, byWords);
};

const splitTimestamp = (timestamp: string) => {
  const [date, fullTime] = timestamp.split(" ");
  return {
    date,
    time: fullTime.slice(0, 5),
  };
};

export const loadEntries = (logPath: string) => {
  if (cachedEntries) {
    return cachedEntries;
  }

  cachedEntries = readFileSync(logPath, "utf-8")
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim().length > 0)
    .map(({ line, lineNumber }) => {
      const match = line.match(LINE_RE);
      if (!match?.groups) {
        throw new Error(`Unsupported log format at line ${lineNumber}`);
      }

      const timestamp = match.groups.timestamp;
      const { date, time } = splitTimestamp(timestamp);
      const message = match.groups.message;

      return {
        lineNumber,
        raw: line,
        timestamp,
        date,
        time,
        severity: match.groups.severity as Severity,
        message,
        components: extractComponents(message),
      } satisfies LogEntry;
    });

  return cachedEntries;
};

const shortenMessage = (message: string) =>
  message
    .replaceAll("validation queue validation queue", "validation queue")
    .replaceAll("reported runaway outlet temperature. Protection interlock initiated reactor trip.", "runaway outlet temp; reactor trip.")
    .replaceAll("core cooling cannot maintain safe gradient. Immediate protective actions are required.", "core cooling cannot keep safe gradient; immediate protection required.")
    .replaceAll("cannot remove heat with the current WTANK07 volume. Reactor protection initiates critical stop.", "cannot remove heat with current WTANK07 volume; critical stop.")
    .replaceAll("Final trip complete because WTANK07 remained under critical water level. FIRMWARE confirms safe shutdown state with all core operations halted.", "final trip complete; WTANK07 below critical water level, FIRMWARE confirms safe shutdown.")
    .replaceAll("coolant level is below critical threshold. Shutdown logic is moving to hard trip stage.", "coolant below critical threshold; hard trip stage.")
    .replaceAll("Coolant level in WTANK07 is below critical reserve for sustained operation. Protective shutdown path is being enforced.", "WTANK07 coolant below critical reserve; protective shutdown active.")
    .replaceAll("Cooling reserve trend in WTANK07 keeps falling during load rise. ECCS8 is approaching a nonrecoverable limit.", "WTANK07 cooling reserve keeps falling; ECCS8 nears nonrecoverable limit.")
    .replaceAll("indicates unstable refill trend. Available coolant inventory is no longer guaranteed.", "unstable refill trend; coolant inventory no longer guaranteed.")
    .replaceAll("level estimate dropped near minimum reserve line. Automatic refill request timed out.", "level near minimum reserve; refill request timed out.")
    .replaceAll("returned inconsistent feedback under load. Automatic fallback path has been applied.", "returned inconsistent feedback under load; fallback applied.")
    .replaceAll("Operational fault persisted on WTANK07 after retry cycle. Performance constraints are now enforced.", "WTANK07 fault persisted after retry; performance constraints enforced.")
    .replaceAll("Operational fault persisted on ECCS8 after retry cycle. Performance constraints are now enforced.", "ECCS8 fault persisted after retry; performance constraints enforced.")
    .replaceAll("failed a recovery step in the active sequence. The subsystem remains in degraded operation mode.", "failed a recovery step; subsystem remains degraded.")
    .replaceAll("fails to recover thermal margin while WTANK07 remains partially filled. Shutdown criteria are approaching.", "fails to recover thermal margin while WTANK07 is partially filled; shutdown criteria approaching.")
    .replaceAll("return circuit temperature rose faster than prediction. Emergency bias remains armed.", "return circuit temp rose faster than predicted; emergency bias armed.")
    .replaceAll("returned nonblocking fault set. Runtime proceeds in constrained mode.", "returned nonblocking faults; constrained mode.")
    .replaceAll("entered emergency guard branch after repeated safety faults. Manual override is locked.", "entered emergency guard branch after repeated safety faults; manual override locked.")
    .replaceAll("watchdog acknowledged delayed subsystem poll. Retry timer is active.", "watchdog saw delayed subsystem poll; retry timer active.")
    .replaceAll("Input ripple on PWR01 crossed warning limits. Stability window is narrowed.", "PWR01 input ripple crossed warning limits; stability margin narrowed.")
    .replaceAll("transient disturbed auxiliary pump control. Recovery completed with degraded margin.", "transient disturbed auxiliary pump control; degraded margin.")
    .replaceAll("can no longer sustain stable feed for cooling auxiliaries. Critical loads are shedding.", "cannot sustain stable feed for cooling auxiliaries; critical load shedding.")
    .replaceAll("Power stability on PWR01 is highly unstable under startup load. Adding an additional power source is strongly recommended.", "PWR01 power highly unstable under startup load; extra power source recommended.")
    .replaceAll("suction profile is inconsistent with expected coolant volume. Mechanical stress is increasing.", "suction profile inconsistent with expected coolant volume; mechanical stress rising.")
    .replaceAll("reported repeated cavitation signatures. Output pressure cannot be held at requested level.", "reported repeated cavitation; output pressure cannot be held.")
    .replaceAll("lost stable prime under peak thermal demand. Core loop continuity is compromised.", "lost stable prime under peak thermal demand; core loop continuity compromised.")
    .replaceAll("duty cycle is elevated for current load. Extended operation may reduce efficiency.", "duty cycle elevated for current load; efficiency risk.")
    .replaceAll("Flow margin on WTRPMP is below preferred startup profile. Monitoring continues without immediate trip.", "WTRPMP flow margin below preferred startup profile.")
    .replaceAll("Fill trajectory in WTANK07 is slower than expected. Cooling reserve may become constrained.", "WTANK07 fill trajectory too slow; cooling reserve may tighten.")
    .replaceAll("Level sensor reconciliation for WTANK07 returned minor mismatch. Secondary read is requested.", "WTANK07 level sensor mismatch; secondary read requested.")
    .replaceAll("Waste heat relay to WSTPOOL2 is approaching soft cap. Throughput tuning is required.", "WSTPOOL2 waste heat relay approaching soft cap; throughput tuning required.")
    .replaceAll("Heat transfer path to WSTPOOL2 is saturated. Dissipation lag continues to accumulate.", "WSTPOOL2 heat transfer path saturated; dissipation lag accumulating.")
    .replaceAll("absorption path reached emergency boundary. Heat rejection is no longer sufficient.", "absorption path reached emergency boundary; heat rejection insufficient.")
    .replaceAll("entered critical protection state during startup. Immediate shutdown safeguards remain active.", "entered critical protection state during startup; shutdown safeguards active.")
    .replaceAll("feedback loop exceeded correction budget. Thermal conversion rate is reduced.", "feedback loop exceeded correction budget; thermal conversion reduced.")
    .replaceAll("decoupling sequence forced by thermal risk. Energy conversion is terminated.", "decoupling sequence forced by thermal risk; energy conversion terminated.")
    .replaceAll("Pressure jitter near STMTURB12 is above baseline. Automatic damping remains engaged.", "STMTURB12 pressure jitter above baseline; damping engaged.")
    .replaceAll("Thermal drift on ECCS8 exceeds advisory threshold. Corrective ramp is queued.", "ECCS8 thermal drift exceeds advisory threshold; corrective ramp queued.")
    .replaceAll("ECCS8 reports rising return temperature. Cooling headroom is decreasing.", "ECCS8 return temp rising; cooling headroom decreasing.")
    .replaceAll("Cooling efficiency on ECCS8 dropped below operational target. Compensating commands did not recover nominal state.", "ECCS8 cooling efficiency below target; compensation failed.")
    .replaceAll("Cross-check between FIRMWARE and hardware interface map did not complete successfully. Compatibility verification remains unresolved for startup state.", "FIRMWARE/hardware map cross-check failed; startup compatibility unresolved.")
    .replace(/\s+/g, " ")
    .trim();

export const formatEntry = (entry: LogEntry) =>
  `[${entry.date} ${entry.time}] [${entry.severity}] ${shortenMessage(entry.message)}`;

const groupFirstByTemplate = (entries: LogEntry[]) => {
  const firstByTemplate = new Map<string, LogEntry>();

  for (const entry of entries) {
    const key = `${entry.severity}:${entry.message}`;
    if (!firstByTemplate.has(key)) {
      firstByTemplate.set(key, entry);
    }
  }

  return [...firstByTemplate.values()];
};

const normalizeFocus = (focusComponents: string[]) =>
  dedupe(
    focusComponents
      .map((component) => component.trim().toUpperCase())
      .filter(Boolean),
  );

const entryMatchesFocus = (entry: LogEntry, focusSet: Set<string>) =>
  entry.components.some((component) => focusSet.has(component));

const mergeSelectedEntry = (
  existing: SelectedEntry | undefined,
  entry: LogEntry,
  priority: number,
  reason: string,
  protectedEntry = false,
) => {
  if (!existing) {
    return {
      entry,
      priority,
      reasons: [reason],
      protected: protectedEntry,
    } satisfies SelectedEntry;
  }

  return {
    ...existing,
    priority: Math.max(existing.priority, priority),
    protected: existing.protected || protectedEntry,
    reasons: existing.reasons.includes(reason)
      ? existing.reasons
      : [...existing.reasons, reason],
  } satisfies SelectedEntry;
};

const buildSelectionPool = (
  entries: LogEntry[],
  args: Required<BuildCandidateArgs>,
) => {
  const nonInfo = entries.filter((entry) => entry.severity !== "INFO");
  const uniqueAlerts = groupFirstByTemplate(nonInfo);
  const focusComponents = normalizeFocus(args.focusComponents);
  const focusSet = new Set(
    focusComponents.length ? focusComponents : IMPORTANT_COMPONENTS,
  );
  const selected = new Map<number, SelectedEntry>();
  const tail = nonInfo.slice(-args.finalWindowAlerts);

  const push = (
    entry: LogEntry,
    priority: number,
    reason: string,
    protectedEntry = false,
  ) => {
    selected.set(
      entry.lineNumber,
      mergeSelectedEntry(
        selected.get(entry.lineNumber),
        entry,
        priority,
        reason,
        protectedEntry,
      ),
    );
  };

  for (const entry of tail) {
    push(entry, 160, "final_window");
  }

  if (nonInfo.length > 0) {
    push(nonInfo.at(-1)!, 200, "last_alert", true);
  }

  for (const entry of nonInfo.filter((item) => item.severity === "CRIT")) {
    if (args.strategy !== "tail-heavy" || entry.lineNumber > nonInfo.length - 120) {
      push(entry, 120, "critical");
    }
  }

  const uniqueCriticalOrError = uniqueAlerts.filter(
    (entry) => entry.severity === "CRIT" || entry.severity === "ERRO",
  );
  for (const entry of uniqueCriticalOrError) {
    push(entry, entry.severity === "CRIT" ? 130 : 95, "unique_serious");
  }

  if (args.strategy === "broad") {
    for (const entry of uniqueAlerts) {
      push(entry, entry.severity === "WARN" ? 70 : 90, "unique_alert");
    }
  } else if (args.strategy === "balanced") {
    for (const entry of uniqueAlerts) {
      const isFocus = entryMatchesFocus(entry, focusSet);
      if (entry.severity === "WARN" && isFocus) {
        push(entry, 78, "focus_warn");
      }
    }
  } else if (args.strategy === "focused") {
    for (const entry of uniqueAlerts) {
      if (entryMatchesFocus(entry, focusSet)) {
        push(entry, entry.severity === "WARN" ? 88 : 104, "focused_unique");
      }
    }
  } else {
    for (const entry of uniqueAlerts) {
      if (entryMatchesFocus(entry, focusSet) || entry.severity === "CRIT") {
        push(entry, entry.severity === "WARN" ? 74 : 100, "tail_heavy_context");
      }
    }
  }

  for (const component of focusSet) {
    const matches = nonInfo.filter((entry) => entry.components.includes(component));
    if (matches.length === 0) continue;

    push(matches[0], 110, `${component}_first`, true);

    const bySeverity = {
      WARN: matches.find((entry) => entry.severity === "WARN"),
      ERRO: matches.find((entry) => entry.severity === "ERRO"),
      CRIT: matches.find((entry) => entry.severity === "CRIT"),
    } as const;

    for (const [severity, entry] of Object.entries(bySeverity)) {
      if (!entry) continue;
      push(
        entry,
        severity === "CRIT" ? 125 : severity === "ERRO" ? 105 : 82,
        `${component}_${severity.toLowerCase()}`,
        severity === "CRIT",
      );
    }

    for (const entry of matches.slice(-3)) {
      push(entry, 118, `${component}_tail`);
    }
  }

  return [...selected.values()];
};

const toLogsText = (items: SelectedEntry[]) =>
  items
    .map(({ entry }) => formatEntry(entry))
    .join("\n");

const fitProtectedToTokenLimit = (
  items: SelectedEntry[],
  maxTokens: number,
) => {
  const selected = [...items];
  selected.sort((left, right) => left.entry.lineNumber - right.entry.lineNumber);

  while (estimateTokens(toLogsText(selected)) > maxTokens) {
    const removableIndex = selected.findIndex(
      (item) => item.protected && !item.reasons.includes("last_alert"),
    );

    if (removableIndex >= 0) {
      selected.splice(removableIndex, 1);
      continue;
    }

    break;
  }

  return selected;
};

const fitOptionalToTokenLimit = (
  required: SelectedEntry[],
  optional: SelectedEntry[],
  maxTokens: number,
) => {
  const selected = [...required];
  const optionalSorted = [...optional].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.entry.lineNumber - right.entry.lineNumber;
  });

  for (const candidate of optionalSorted) {
    const next = [...selected, candidate].sort(
      (left, right) => left.entry.lineNumber - right.entry.lineNumber,
    );
    if (estimateTokens(toLogsText(next)) <= maxTokens) {
      selected.push(candidate);
    }
  }

  return selected.sort((left, right) => left.entry.lineNumber - right.entry.lineNumber);
};

export const buildCandidateLogs = (
  entries: LogEntry[],
  args: BuildCandidateArgs = {},
) => {
  const normalizedArgs = {
    strategy: args.strategy ?? "balanced",
    focusComponents: args.focusComponents ?? [],
    maxTokens: args.maxTokens ?? 1400,
    finalWindowAlerts: args.finalWindowAlerts ?? 20,
  } satisfies Required<BuildCandidateArgs>;

  const pool = buildSelectionPool(entries, normalizedArgs).sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.entry.lineNumber - right.entry.lineNumber;
  });

  const uniqueByLine = new Map<number, SelectedEntry>();
  for (const item of pool) {
    uniqueByLine.set(item.entry.lineNumber, item);
  }

  const allItems = [...uniqueByLine.values()];
  const requiredItems = fitProtectedToTokenLimit(
    allItems.filter((item) => item.protected),
    normalizedArgs.maxTokens,
  );
  const requiredLineNumbers = new Set(
    requiredItems.map((item) => item.entry.lineNumber),
  );
  const optionalItems = allItems.filter(
    (item) => !requiredLineNumbers.has(item.entry.lineNumber),
  );
  const pruned = fitOptionalToTokenLimit(
    requiredItems,
    optionalItems,
    normalizedArgs.maxTokens,
  );
  const logs = toLogsText(pruned);

  return {
    strategy: normalizedArgs.strategy,
    focusComponents: normalizeFocus(normalizedArgs.focusComponents),
    logs,
    estimatedTokens: estimateTokens(logs),
    lineCount: pruned.length,
    lines: pruned.map((item) => ({
      lineNumber: item.entry.lineNumber,
      timestamp: `${item.entry.date} ${item.entry.time}`,
      severity: item.entry.severity,
      components: item.entry.components,
      formatted: formatEntry(item.entry),
      reasons: item.reasons,
    })),
  };
};

export const buildOverview = (entries: LogEntry[]) => {
  const severityCounts = {
    INFO: 0,
    WARN: 0,
    ERRO: 0,
    CRIT: 0,
  };
  const componentCounts = new Map<string, number>();

  for (const entry of entries) {
    severityCounts[entry.severity] += 1;
    for (const component of entry.components) {
      componentCounts.set(component, (componentCounts.get(component) ?? 0) + 1);
    }
  }

  const wholeFile = entries.map((entry) => entry.raw).join("\n");
  const componentRanking = [...componentCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([component, count]) => ({ component, count }));

  const uniqueAlertTemplates = groupFirstByTemplate(
    entries.filter((entry) => entry.severity !== "INFO"),
  );

  return {
    totalLines: entries.length,
    estimatedTokens: estimateTokens(wholeFile),
    range: {
      first: entries[0]?.timestamp ?? null,
      last: entries.at(-1)?.timestamp ?? null,
    },
    severityCounts,
    topComponents: componentRanking,
    suggestedFocusComponents: IMPORTANT_COMPONENTS,
    uniqueAlertTemplates: uniqueAlertTemplates.length,
    representativeAlerts: uniqueAlertTemplates
      .slice(0, 12)
      .map((entry) => formatEntry(entry)),
  };
};

export const searchEntries = (
  entries: LogEntry[],
  {
    component,
    severity,
    query,
    limit = 20,
  }: {
    component?: string;
    severity?: Severity;
    query?: string;
    limit?: number;
  },
) => {
  const normalizedComponent = component?.trim().toUpperCase();
  const normalizedQuery = query?.trim().toLowerCase();

  return entries
    .filter((entry) => {
      if (severity && entry.severity !== severity) return false;
      if (normalizedComponent && !entry.components.includes(normalizedComponent)) {
        return false;
      }
      if (
        normalizedQuery &&
        !entry.raw.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    })
    .slice(0, Math.min(Math.max(limit, 1), 50))
    .map((entry) => ({
      lineNumber: entry.lineNumber,
      timestamp: `${entry.date} ${entry.time}`,
      severity: entry.severity,
      components: entry.components,
      raw: entry.raw,
      formatted: formatEntry(entry),
    }));
};

export const buildComponentStory = (
  entries: LogEntry[],
  component: string,
) => {
  const normalizedComponent = component.trim().toUpperCase();
  const relevant = entries.filter((entry) =>
    entry.components.includes(normalizedComponent),
  );
  const alerts = relevant.filter((entry) => entry.severity !== "INFO");
  const uniqueAlerts = groupFirstByTemplate(alerts);

  const relatedComponents = new Map<string, number>();
  for (const entry of alerts) {
    for (const related of entry.components) {
      if (related === normalizedComponent) continue;
      relatedComponents.set(related, (relatedComponents.get(related) ?? 0) + 1);
    }
  }

  return {
    component: normalizedComponent,
    totalEntries: relevant.length,
    alertCount: alerts.length,
    firstAlert: alerts[0] ? formatEntry(alerts[0]) : null,
    firstError:
      alerts.find((entry) => entry.severity === "ERRO" || entry.severity === "CRIT")
        ? formatEntry(
            alerts.find(
              (entry) => entry.severity === "ERRO" || entry.severity === "CRIT",
            )!,
          )
        : null,
    firstCritical:
      alerts.find((entry) => entry.severity === "CRIT")
        ? formatEntry(alerts.find((entry) => entry.severity === "CRIT")!)
        : null,
    recentAlerts: alerts.slice(-8).map((entry) => formatEntry(entry)),
    representativeAlerts: uniqueAlerts.slice(0, 15).map((entry) => formatEntry(entry)),
    relatedComponents: [...relatedComponents.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count })),
  };
};

export const extractComponentHints = (text: string) =>
  dedupe(extractComponents(text)).filter((component) =>
    IMPORTANT_COMPONENTS.includes(component),
  );
