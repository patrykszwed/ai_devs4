import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./App.css";

const API = "/api";

function useSolutions() {
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSolutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/solutions`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setSolutions(data);
    } catch (e) {
      setError(e.message);
      setSolutions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { solutions, loading, error, fetchSolutions };
}

function playCompletionSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (_) {}
}

function formatDuration(ms) {
  if (ms == null || ms < 0) return null;
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const FLG_REGEX = /FLG:\s*(\S+)/;
function parseFlagFromLogs(logLines) {
  if (!Array.isArray(logLines)) return null;
  const text = logLines.map((l) => l.text).join("");
  const m = text.match(FLG_REGEX);
  if (!m) return null;
  return m[1].replace(/\}"?$|"$/, "").trim() || null;
}

function useRunSolution() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [exitCode, setExitCode] = useState(null);
  const [lastCost, setLastCost] = useState(null);
  const [lastUsage, setLastUsage] = useState(null);
  const [lastDurationMs, setLastDurationMs] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const esRef = useRef(null);
  const runStartedAtRef = useRef(null);

  const run = useCallback((id, modelId, onDone) => {
    setRunning(true);
    setLogs([]);
    setAgentEvents([]);
    setExitCode(null);
    setLastCost(null);
    setLastUsage(null);
    setLastDurationMs(null);
    setTimedOut(false);
    runStartedAtRef.current = Date.now();
    const qs = modelId ? `?model=${encodeURIComponent(modelId)}` : "";
    const es = new EventSource(`${API}/run/${id}${qs}`);
    esRef.current = es;
    const logLines = [];

    es.addEventListener("stdout", (e) => {
      const { data } = JSON.parse(e.data);
      logLines.push({ type: "stdout", text: data });
      setLogs((prev) => [...prev, { type: "stdout", text: data }]);
    });
    es.addEventListener("stderr", (e) => {
      const { data } = JSON.parse(e.data);
      logLines.push({ type: "stderr", text: data });
      setLogs((prev) => [...prev, { type: "stderr", text: data }]);
    });
    es.addEventListener("agent", (e) => {
      try {
        const event = JSON.parse(e.data)?.data ?? JSON.parse(e.data);
        setAgentEvents((prev) => [...prev, event]);
      } catch (_) {}
    });
    es.addEventListener("ping", () => {});
    es.addEventListener("exit", (e) => {
      const { data } = JSON.parse(e.data);
      const durationMs = runStartedAtRef.current != null ? Date.now() - runStartedAtRef.current : null;
      setExitCode(data.code);
      setLastCost(data.cost ?? null);
      setLastUsage(data.usage ?? null);
      setLastDurationMs(durationMs);
      setTimedOut(data.timedOut ?? false);
      setRunning(false);
      esRef.current = null;
      es.close();
      playCompletionSound();
      onDone?.(data.code, logLines, data.cost ?? null, durationMs);
    });

    es.onerror = () => {
      setRunning(false);
      setLogs((prev) => [...prev, { type: "stderr", text: "Connection lost.\n" }]);
      esRef.current = null;
      es.close();
    };

    return () => {
      esRef.current = null;
      es.close();
      setRunning(false);
    };
  }, []);

  const cancel = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setRunning(false);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setAgentEvents([]);
    setExitCode(null);
    setLastCost(null);
    setLastUsage(null);
    setLastDurationMs(null);
    setTimedOut(false);
  }, []);

  return { run, running, cancel, logs, agentEvents, exitCode, lastCost, lastUsage, lastDurationMs, timedOut, clearLogs };
}

const IconSystemPrompt = () => (
  <svg className="agent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);
const IconRequest = () => (
  <svg className="agent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const IconToolCalls = () => (
  <svg className="agent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
);
const IconToolResultOk = () => (
  <svg className="agent-icon agent-icon-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const IconToolResultError = () => (
  <svg className="agent-icon agent-icon-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </svg>
);
const IconText = () => (
  <svg className="agent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 6h16M4 12h10M4 18h6" />
  </svg>
);
const IconChevron = ({ open }) => (
  <svg className={`agent-chevron ${open ? "open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

function AgentInspectorContent({ events }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  return (
    <div className="agent-events">
      {events.map((ev, i) => {
        const key = `${ev.type}-${i}`;
        const isOpen = expanded[key] ?? (ev.type === "instructions" || ev.type === "tool_calls" ? false : true);
        if (ev.type === "instructions") {
          return (
            <div key={key} className="agent-event agent-event-instructions">
              <button type="button" className="agent-event-head" onClick={() => toggle(key)} aria-expanded={isOpen}>
                <IconSystemPrompt />
                <span className="agent-event-type">System prompt</span>
                <IconChevron open={isOpen} />
              </button>
              {isOpen && (
                <pre className="agent-event-body">{typeof ev.content === "string" ? ev.content : JSON.stringify(ev.content, null, 2)}</pre>
              )}
            </div>
          );
        }
        if (ev.type === "request") {
          return (
            <div key={key} className="agent-event agent-event-request">
              <button type="button" className="agent-event-head" onClick={() => toggle(key)} aria-expanded={isOpen}>
                <IconRequest />
                <span className="agent-event-type">Request</span>
                <span className="agent-event-meta">Round {ev.round}</span>
                <IconChevron open={isOpen} />
              </button>
              {isOpen && (
                <div className="agent-event-body">
                  {(ev.messages ?? []).map((msg, j) => (
                    <div key={j} className="agent-msg">
                      {msg.role && <span className="agent-msg-role">{msg.role}</span>}
                      {msg.type === "function_call" && (
                        <span className="agent-msg-tool">tool: {msg.name}({typeof msg.arguments === "string" ? msg.arguments : JSON.stringify(msg.arguments)})</span>
                      )}
                      {msg.type === "function_call_output" && (
                        <span className="agent-msg-output">output: {typeof msg.output === "string" ? msg.output : JSON.stringify(msg.output)}</span>
                      )}
                      {msg.content != null && <pre className="agent-msg-content">{typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)}</pre>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        if (ev.type === "tool_calls") {
          return (
            <div key={key} className="agent-event agent-event-tool-calls">
              <button type="button" className="agent-event-head" onClick={() => toggle(key)} aria-expanded={isOpen}>
                <IconToolCalls />
                <span className="agent-event-type">Tool calls</span>
                <span className="agent-event-meta">Round {ev.round} · {(ev.calls ?? []).length} call(s)</span>
                <IconChevron open={isOpen} />
              </button>
              {isOpen && (
                <ul className="agent-event-body agent-tool-list">
                  {(ev.calls ?? []).map((call, j) => {
                    let args = call.arguments;
                    try {
                      args = typeof args === "string" ? JSON.parse(args) : args;
                    } catch (_) {}
                    return (
                      <li key={j} className="agent-tool-call">
                        <strong>{call.name}</strong>
                        <pre className="agent-tool-args">{JSON.stringify(args, null, 2)}</pre>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        }
        if (ev.type === "tool_result") {
          return (
            <div key={key} className={`agent-event agent-event-tool-result ${ev.error ? "is-error" : ""}`}>
              <button type="button" className="agent-event-head" onClick={() => toggle(key)} aria-expanded={isOpen}>
                {ev.error ? <IconToolResultError /> : <IconToolResultOk />}
                <span className="agent-event-type">{ev.name ?? "Tool result"}</span>
                <span className="agent-event-meta">{ev.error ? "Error" : "OK"}</span>
                <IconChevron open={isOpen} />
              </button>
              {isOpen && (
                <pre className="agent-event-body">{typeof ev.output === "object" ? JSON.stringify(ev.output, null, 2) : String(ev.output)}</pre>
              )}
            </div>
          );
        }
        if (ev.type === "text") {
          return (
            <div key={key} className="agent-event agent-event-text">
              <button type="button" className="agent-event-head" onClick={() => toggle(key)} aria-expanded={isOpen}>
                <IconText />
                <span className="agent-event-type">Assistant text</span>
                {ev.round != null && <span className="agent-event-meta">Round {ev.round}</span>}
                <IconChevron open={isOpen} />
              </button>
              {isOpen && <pre className="agent-event-body">{typeof ev.content === "string" ? ev.content : JSON.stringify(ev.content)}</pre>}
            </div>
          );
        }
        return (
          <div key={key} className="agent-event">
            <pre className="agent-event-body">{JSON.stringify(ev, null, 2)}</pre>
          </div>
        );
      })}
    </div>
  );
}

function AgentInspectorDialog({ events, open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const dialog = (
    <div
      className="agent-dialog-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-dialog-title"
    >
      <div className="agent-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="agent-dialog-header">
          <h2 id="agent-dialog-title" className="agent-dialog-title">Agent inspector</h2>
          <button type="button" className="agent-dialog-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="agent-dialog-body">
          <AgentInspectorContent events={events} />
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

function LogView({ logs, exitCode, lastCost, lastUsage, lastDurationMs, timedOut, autoScroll }) {
  const containerRef = useRef(null);
  const flag = logs.length > 0 ? parseFlagFromLogs(logs) : null;
  useEffect(() => {
    if (autoScroll && containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [logs, autoScroll]);

  return (
    <div
      ref={containerRef}
      className="log-view"
      role="log"
      aria-live="polite"
    >
      {logs.length === 0 && exitCode === null && !timedOut && (
        <div className="log-placeholder">Output will appear here when you run a solution.</div>
      )}
      {logs.map((line, i) => (
        <div key={i} className={`log-line ${line.type}`}>
          {line.text}
        </div>
      ))}
      {flag != null && (exitCode !== null || timedOut) && (
        <div className="log-flag-callout" role="status">
          <span className="log-flag-label">Correct!</span>{" "}
          <span className="log-flag-value">Flag: {flag}</span>
        </div>
      )}
      {(exitCode !== null || timedOut) && (
        <div className="log-exit">
          {timedOut ? (
            "Run timed out (10 min)."
          ) : (
            <>
              Process exited with code {exitCode}
              {formatDuration(lastDurationMs) && (
                <span className="log-duration"> · {formatDuration(lastDurationMs)}</span>
              )}
              {lastUsage != null && (
                <span className="log-usage">
                  {" "}· {lastUsage.inputTokens?.toLocaleString() ?? 0} in / {lastUsage.outputTokens?.toLocaleString() ?? 0} out
                </span>
              )}
              {lastCost != null && (
                <span className="log-cost"> · ${lastCost.toFixed(4)}</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const MODEL_STORAGE_KEY = "dashboard-model";
const RUN_HISTORY_KEY = "dashboard-run-history";
const SESSION_COST_KEY = "dashboard-session-cost";
const MAX_RUN_HISTORY = 10;

function loadRunHistory() {
  try {
    const raw = localStorage.getItem(RUN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RUN_HISTORY) : [];
  } catch {
    return [];
  }
}

function formatTimeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function useModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/models`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);
  return { models, loading };
}

function useEnvCheck() {
  const [env, setEnv] = useState(null);
  useEffect(() => {
    fetch(`${API}/env-check`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setEnv)
      .catch(() => setEnv(null));
  }, []);
  return env;
}

function App() {
  const { solutions, loading, error, fetchSolutions } = useSolutions();
  const { models, loading: modelsLoading } = useModels();
  const env = useEnvCheck();
  const {
    run,
    running,
    cancel,
    logs,
    agentEvents,
    exitCode,
    lastCost,
    lastUsage,
    lastDurationMs,
    timedOut,
    clearLogs,
  } = useRunSolution();
  const [selectedId, setSelectedId] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(MODEL_STORAGE_KEY) || "" : ""
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [sessionCost, setSessionCost] = useState(() => {
    if (typeof localStorage === "undefined") return 0;
    const v = localStorage.getItem(SESSION_COST_KEY);
    return v != null ? parseFloat(v, 10) || 0 : 0;
  });
  const [runHistory, setRunHistory] = useState(loadRunHistory);
  const [solutionFilter, setSolutionFilter] = useState("");
  const [agentInspectorOpen, setAgentInspectorOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SESSION_COST_KEY, String(sessionCost));
  }, [sessionCost]);

  useEffect(() => {
    try {
      localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(runHistory));
    } catch (_) {}
  }, [runHistory]);

  useEffect(() => {
    fetchSolutions();
  }, [fetchSolutions]);

  useEffect(() => {
    if (solutions.length > 0 && selectedId === null) setSelectedId(solutions[0].id);
  }, [solutions, selectedId]);

  useEffect(() => {
    if (models.length > 0 && selectedModelId) {
      const valid = models.some((m) => m.id === selectedModelId);
      if (!valid) setSelectedModelId(models[0]?.id || "");
    } else if (models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0]?.id || "");
    }
  }, [models]);

  const handleModelChange = useCallback((modelId) => {
    setSelectedModelId(modelId);
    localStorage.setItem(MODEL_STORAGE_KEY, modelId);
  }, []);

  const runContextRef = useRef(null);
  const handleRunDone = useCallback((code, logLines, cost, durationMs) => {
    if (cost != null && cost > 0) setSessionCost((c) => c + cost);
    const ctx = runContextRef.current;
    const flag = parseFlagFromLogs(logLines ?? []);
    if (ctx) {
      setRunHistory((prev) => [
        {
          solutionId: ctx.solutionId,
          solutionName: ctx.solutionName,
          modelId: ctx.modelId,
          modelName: ctx.modelName,
          exitCode: code,
          cost: cost ?? null,
          durationMs: durationMs ?? null,
          timestamp: Date.now(),
          flag: flag ?? undefined,
        },
        ...prev.slice(0, MAX_RUN_HISTORY - 1),
      ]);
    }
  }, []);

  const filterLower = solutionFilter.trim().toLowerCase();
  const filteredSolutions =
    !filterLower ? solutions : solutions.filter((s) => s.id.toLowerCase().includes(filterLower) || s.name.toLowerCase().includes(filterLower));

  useEffect(() => {
    if (filteredSolutions.length === 0) return;
    const stillSelected = filteredSolutions.some((s) => s.id === selectedId);
    if (!stillSelected) setSelectedId(filteredSolutions[0].id);
  }, [filteredSolutions, selectedId]);

  const getLastRun = useCallback(
    (solutionId) => runHistory.find((e) => e.solutionId === solutionId) ?? null,
    [runHistory]
  );

  const selected = solutions.find((s) => s.id === selectedId) ?? solutions[0];
  const logsText = logs.map((l) => l.text).join("");

  const copyLogs = useCallback(() => {
    if (logsText) navigator.clipboard?.writeText(logsText);
  }, [logsText]);

  const downloadLogs = useCallback(() => {
    if (!logsText) return;
    const blob = new Blob([logsText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${selected?.id ?? "output"}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logsText, selected?.id]);

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">
          <span className="title-icon">◈</span>
          Task Dashboard
        </h1>
        <p className="subtitle">Run AI Devs solutions</p>
        <div className="header-meta">
          {env != null && (
            <span className="env-check" title="API keys present">
              {env.openai && <span className="env-ok">OpenAI</span>}
              {env.openrouter && <span className="env-ok">OpenRouter</span>}
              {env.aiDevs && <span className="env-ok">AI Devs</span>}
              {!env.openai && !env.openrouter && (
                <span className="env-miss">No API key</span>
              )}
            </span>
          )}
          <span className="session-cost">Session: ${sessionCost.toFixed(4)}</span>
          <button type="button" className="reset-cost-btn" onClick={() => setSessionCost(0)} title="Reset session cost">
            Reset
          </button>
        </div>
      </header>

      <main className="main">
        <section className="solutions-panel">
          <h2 className="panel-title">Solutions</h2>
          {solutions.length > 0 && (
            <input
              type="search"
              className="solution-filter"
              placeholder="Filter by id or name…"
              value={solutionFilter}
              onChange={(e) => setSolutionFilter(e.target.value)}
              aria-label="Filter solutions"
            />
          )}
          {loading && <p className="muted">Loading…</p>}
          {error && <p className="error">{error}</p>}
          <ul className="solution-list">
            {filteredSolutions.map((s) => {
              const lastRun = getLastRun(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`solution-card ${selectedId === s.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedId(s.id);
                      clearLogs();
                    }}
                  >
                    <span className="solution-id">{s.id}</span>
                    <span className="solution-name">{s.name}</span>
                    <span className="solution-last-run">
                      {lastRun
                        ? `Last run: code ${lastRun.exitCode} · ${formatTimeAgo(lastRun.timestamp)}`
                        : "Never run"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {solutions.length > 0 && filteredSolutions.length === 0 && (
            <p className="muted">No solutions match the filter.</p>
          )}

          <h2 className="panel-title model-title">Model</h2>
          {!modelsLoading && models.length > 0 && (
            <select
              className="model-select"
              value={selectedModelId}
              onChange={(e) => handleModelChange(e.target.value)}
              aria-label="Select model"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.pricingNote}
                </option>
              ))}
            </select>
          )}
          {selected && (
            <div className="run-actions">
              <button
                type="button"
                className="run-btn"
                onClick={() => {
                  const model = models.find((m) => m.id === selectedModelId);
                  runContextRef.current = {
                    solutionId: selected.id,
                    solutionName: selected.name,
                    modelId: selectedModelId,
                    modelName: model?.name ?? selectedModelId,
                  };
                  run(selected.id, selectedModelId || undefined, handleRunDone);
                }}
                disabled={running}
                aria-busy={running}
              >
                {running ? (
                  <>
                    <span className="run-spinner" aria-hidden />
                    Running…
                  </>
                ) : (
                  <>Run {selected.name}</>
                )}
              </button>
              {running && (
                <button type="button" className="cancel-btn" onClick={cancel}>
                  Cancel
                </button>
              )}
            </div>
          )}
        </section>

        <section className="output-panel">
          <div className="output-header">
            <h2 className="panel-title">Output</h2>
            <div className="output-toolbar">
              <label className="auto-scroll-label">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                Auto-scroll
              </label>
              {logs.length > 0 && (
                <>
                  <button type="button" className="toolbar-btn" onClick={copyLogs}>
                    Copy
                  </button>
                  <button type="button" className="toolbar-btn" onClick={downloadLogs}>
                    Download
                  </button>
                  <button type="button" className="clear-btn" onClick={clearLogs}>
                    Clear
                  </button>
                </>
              )}
              <button
                type="button"
                className="toolbar-btn toolbar-btn-inspector"
                onClick={() => setAgentInspectorOpen(true)}
                disabled={agentEvents.length === 0}
                title={agentEvents.length === 0 ? "Run a solution that logs agent events first (e.g. Find Him)" : "Open agent inspector"}
              >
                <svg className="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                </svg>
                Agent inspector
              </button>
            </div>
          </div>
          <LogView
            logs={logs}
            exitCode={exitCode}
            lastCost={lastCost}
            lastUsage={lastUsage}
            lastDurationMs={lastDurationMs}
            timedOut={timedOut}
            autoScroll={autoScroll}
          />
          <AgentInspectorDialog
            events={agentEvents}
            open={agentInspectorOpen}
            onClose={() => setAgentInspectorOpen(false)}
          />
          {runHistory.length > 0 && (
            <div className="run-history">
              <h3 className="panel-title">Run history</h3>
              <ul className="run-history-list">
                {runHistory.map((entry, i) => (
                  <li key={`${entry.timestamp}-${i}`} className="run-history-item">
                    <span className="run-history-solution">{entry.solutionName}</span>
                    <span className="run-history-model">{entry.modelName}</span>
                    {entry.flag != null && (
                      <span className="run-history-flag">Flag: {entry.flag}</span>
                    )}
                    <span className="run-history-meta">
                      code {entry.exitCode}
                      {entry.durationMs != null && ` · ${formatDuration(entry.durationMs)}`}
                      {entry.cost != null && ` · $${entry.cost.toFixed(4)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
      <footer className="footer">
        <a
          href="https://github.com/patrykszwed"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          <span className="footer-emoji">✨</span> created by patrykszwed and Cursor
        </a>
        <span className="footer-location">
          <span className="footer-flag" aria-hidden>🇵🇱</span> Wrocław
        </span>
      </footer>
    </div>
  );
}

export default App;
