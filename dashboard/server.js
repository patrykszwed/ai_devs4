import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import express from "express";
import cors from "cors";

const require = createRequire(import.meta.url);
let pty;
try {
  pty = require("node-pty");
} catch {
  pty = null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const rootEnv = join(ROOT, ".env");
if (existsSync(rootEnv) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(rootEnv);
  } catch (_) {}
}

const RUN_TIMEOUT_MS = 10 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 15 * 1000;

const SOLUTIONS = [
  {
    id: "01-people",
    name: "People",
    path: "solutions/01-people",
    script: "app.js",
  },
  {
    id: "02-findhim",
    name: "Find Him",
    path: "solutions/02-findhim",
    script: "app.js",
  },
  {
    id: "03-proxy",
    name: "Proxy Assistant",
    path: "solutions/03-proxy",
    script: "app.js",
  },
  {
    id: "04-sendit",
    name: "Send It",
    path: "solutions/04-sendit",
    script: "dashboard-app.js",
  },
].filter((s) => existsSync(join(ROOT, s.path, s.script)));

const MODELS = [
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    pricing: { prompt: 0.1, completion: 0.4 },
  },
  {
    id: "mistralai/ministral-3b-2512",
    name: "Ministral 3B",
    pricing: { prompt: 0.1, completion: 0.1 },
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    pricing: { prompt: 0.15, completion: 0.6 },
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    pricing: { prompt: 0.25, completion: 2 },
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    name: "NVIDIA: Nemotron 3 Nano 30B A3B (free)",
    pricing: { prompt: 0, completion: 0 },
  },
];

function computeCost(usage, modelId) {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model || !usage?.inputTokens) return null;
  const { prompt, completion } = model.pricing;
  const inputCost = (usage.inputTokens / 1e6) * prompt;
  const outputCost = ((usage.outputTokens ?? 0) / 1e6) * completion;
  return Math.round((inputCost + outputCost) * 1e6) / 1e6;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/solutions", (_req, res) => {
  res.json(SOLUTIONS);
});

app.get("/api/models", (_req, res) => {
  res.json(
    MODELS.map((m) => ({
      ...m,
      pricingNote: `$${m.pricing.prompt}/M in, $${m.pricing.completion}/M out`,
    })),
  );
});

app.get("/api/env-check", (_req, res) => {
  res.json({
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    aiDevs: Boolean(process.env.AI_DEVS_API_KEY?.trim()),
  });
});

function finishRun(
  res,
  send,
  usageFile,
  usageDir,
  modelId,
  code,
  signal,
  timedOut = false,
) {
  let usage = null;
  let cost = null;
  try {
    if (existsSync(usageFile)) {
      usage = JSON.parse(readFileSync(usageFile, "utf-8"));
      cost = computeCost(usage, modelId);
    }
  } catch (_) {}
  try {
    rmSync(usageDir, { recursive: true });
  } catch (_) {}
  send("exit", {
    code: timedOut ? null : code,
    signal: signal || null,
    usage,
    cost,
    timedOut: timedOut || undefined,
  });
  res.end();
}

app.get("/api/run/:id", (req, res) => {
  const solution = SOLUTIONS.find((s) => s.id === req.params.id);
  if (!solution) {
    res.status(404).json({ error: "Solution not found" });
    return;
  }
  const modelId =
    req.query.model && MODELS.some((m) => m.id === req.query.model)
      ? req.query.model
      : MODELS[0].id;
  const usageDir = mkdtempSync(join(tmpdir(), "dashboard-"));
  const usageFile = join(usageDir, "usage.json");
  const agentLogFile = join(usageDir, "agent.ndjson");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => {
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify({ data })}\n\n`);
      res.flush?.();
    } catch (_) {}
  };

  const cwd = join(ROOT, solution.path);
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
    DASHBOARD_MODEL: modelId,
    DASHBOARD_USAGE_FILE: usageFile,
    DASHBOARD_AGENT_LOG: agentLogFile,
  };

  let agentLogLinesSent = 0;
  const agentLogPoll = setInterval(() => {
    if (finished) return;
    try {
      if (!existsSync(agentLogFile)) return;
      const raw = readFileSync(agentLogFile, "utf-8");
      const lines = raw.split("\n").filter((l) => l.trim());
      for (let i = agentLogLinesSent; i < lines.length; i++) {
        try {
          const event = JSON.parse(lines[i]);
          send("agent", event);
        } catch (_) {}
      }
      agentLogLinesSent = lines.length;
    } catch (_) {}
  }, 120);

  let finished = false;
  const done = (code, signal, timedOut = false) => {
    if (finished) return;
    finished = true;
    clearInterval(agentLogPoll);
    clearTimeout(runTimeout);
    clearInterval(heartbeat);
    finishRun(res, send, usageFile, usageDir, modelId, code, signal, timedOut);
  };

  const runTimeout = setTimeout(() => {
    if (finished) return;
    if (ptyProcess?.kill) ptyProcess.kill("SIGTERM");
    else if (childProcess?.kill) childProcess.kill("SIGTERM");
    send("stderr", "\nRun timed out (10 min).\n");
    done(null, "SIGTERM", true);
  }, RUN_TIMEOUT_MS);

  const heartbeat = setInterval(() => {
    if (finished) return;
    send("ping", {});
  }, HEARTBEAT_INTERVAL_MS);

  let ptyProcess = null;
  let childProcess = null;

  if (pty) {
    try {
      ptyProcess = pty.spawn("node", [solution.script], {
        cwd,
        env,
        cols: 80,
        rows: 24,
      });
      ptyProcess.onData((chunk) => send("stdout", chunk));
      ptyProcess.onExit(({ exitCode, signal: sig }) => {
        done(exitCode, sig);
      });
    } catch (err) {
      ptyProcess = null;
    }
  }

  if (!ptyProcess) {
    childProcess = spawn("node", [solution.script], {
      cwd,
      env,
      shell: false,
    });
    childProcess.stdout.setEncoding("utf8");
    childProcess.stdout.on("data", (chunk) => send("stdout", chunk));
    childProcess.stderr.setEncoding("utf8");
    childProcess.stderr.on("data", (chunk) => send("stderr", chunk));
    childProcess.on("close", (code, signal) => done(code, signal));
    childProcess.on("error", (err) => {
      send("stderr", err.message + "\n");
      done(1, null);
    });
  }

  req.on("close", () => {
    if (finished) return;
    if (ptyProcess?.kill) ptyProcess.kill("SIGTERM");
    else if (childProcess?.kill) childProcess.kill("SIGTERM");
    finished = true;
    clearInterval(agentLogPoll);
    clearTimeout(runTimeout);
    clearInterval(heartbeat);
    try {
      rmSync(usageDir, { recursive: true, force: true });
    } catch (_) {}
  });
});

const dist = join(__dirname, "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
}

const PORT = Number(process.env.PORT) || 3333;
app.listen(PORT, () => {
  console.log(`Dashboard server http://localhost:${PORT}`);
});
