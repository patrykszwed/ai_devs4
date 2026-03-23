import { createServer } from "http";
import { processMessage } from "./agent.js";

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });

const sendJson = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

export const createProxyServer = (getAgentContext) => {
  const sessions = new Map();

  const handler = async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { msg: "Method not allowed" });
      return;
    }

    const path = (req.url ?? "").split("?")[0];
    if (path !== "" && path !== "/") {
      sendJson(res, 404, { msg: "Not found" });
      return;
    }

    let body;
    try {
      body = await parseBody(req);
    } catch {
      sendJson(res, 400, { msg: "Invalid JSON" });
      return;
    }

    const sessionID = body.sessionID ?? "";
    const msg = body.msg ?? "";

    if (!sessionID || typeof msg !== "string") {
      sendJson(res, 400, { msg: "sessionID and msg are required" });
      return;
    }

    const context = getAgentContext();
    const history = sessions.get(sessionID) ?? [];

    try {
      const { text, messages } = await processMessage(history, msg, context);
      sessions.set(sessionID, messages);
      sendJson(res, 200, { msg: text });
    } catch (err) {
      console.error("[proxy]", sessionID, err);
      sendJson(res, 500, { msg: "Wystąpił błąd. Spróbuj ponownie." });
    }
  };

  return createServer(handler);
};
