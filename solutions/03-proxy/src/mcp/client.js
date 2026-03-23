import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "server.js");

export const createMcpClient = async (env = {}) => {
  const client = new Client(
    { name: "proxy-mcp-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH],
    env: { ...process.env, ...env },
    stderr: "inherit",
  });

  await client.connect(transport);
  return client;
};

export const listMcpTools = async (client) => {
  const result = await client.listTools();
  return result.tools ?? [];
};

export const callMcpTool = async (client, name, args) => {
  const result = await client.callTool({ name, arguments: args });
  const textContent = result.content?.find((c) => c.type === "text");
  if (textContent?.text) {
    try {
      return JSON.parse(textContent.text);
    } catch {
      return textContent.text;
    }
  }
  return result;
};

export const mcpToolsToOpenAI = (mcpTools) =>
  mcpTools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.inputSchema ?? { type: "object", properties: {} },
    strict: true,
  }));
