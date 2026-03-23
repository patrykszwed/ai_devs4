import { api, apiKey } from "./src/config.js";
import { createProxyServer } from "./src/server.js";
import {
  createMcpClient,
  listMcpTools,
  callMcpTool,
  mcpToolsToOpenAI,
} from "./src/mcp/client.js";

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  const mcpClient = await createMcpClient({ AI_DEVS_API_KEY: apiKey });
  const mcpTools = await listMcpTools(mcpClient);
  const toolsList = mcpToolsToOpenAI(mcpTools);
  const handlers = Object.fromEntries(
    mcpTools.map((t) => [
      t.name,
      (args) => callMcpTool(mcpClient, t.name, args),
    ]),
  );
  console.log(`[proxy] MCP mode: ${mcpTools.map((t) => t.name).join(", ")}`);

  const getAgentContext = () => ({
    model: api.model,
    tools: toolsList,
    handlers,
    instructions: api.instructions,
  });

  const server = createProxyServer(getAgentContext);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[proxy] Listening on http://0.0.0.0:${PORT}`);
    console.log("[proxy] POST / with body: { sessionID, msg }");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
