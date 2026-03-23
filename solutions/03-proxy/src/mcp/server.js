#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { hubUrlFromPathEnv } from "../../../../hub-paths.js";

const packagesApiUrl = () => hubUrlFromPathEnv("AI_DEVS_HUB_PATH_API_PACKAGES");

const apikey = process.env.AI_DEVS_API_KEY?.trim();
if (!apikey) {
  console.error("AI_DEVS_API_KEY is required for packages MCP server");
  process.exit(1);
}

const textResult = (obj) => ({
  content: [{ type: "text", text: JSON.stringify(obj) }],
});

const server = new McpServer(
  { name: "proxy-packages-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.registerTool(
  "check_package",
  {
    description: "Sprawdza status i lokalizację paczki po ID (np. PKG12345678).",
    inputSchema: {
      packageid: z.string().describe("Identyfikator paczki, np. PKG12345678"),
    },
  },
  async ({ packageid }) => {
    const res = await fetch(packagesApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey, action: "check", packageid }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`packages API: ${res.status} ${text}`);
    return textResult(JSON.parse(text || "{}"));
  }
);

server.registerTool(
  "redirect_package",
  {
    description:
      "Przekierowuje paczkę do podanego celu. Wymaga kodu zabezpieczającego. Zwraca confirmation — przekaż go operatorowi.",
    inputSchema: {
      packageid: z.string().describe("Identyfikator paczki"),
      destination: z.string().describe("Kod celu, np. PWR3847PL"),
      code: z.string().describe("Kod zabezpieczający od operatora"),
    },
  },
  async ({ packageid, destination, code }) => {
    const res = await fetch(packagesApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey,
        action: "redirect",
        packageid,
        destination,
        code,
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`packages API: ${res.status} ${text}`);
    return textResult(JSON.parse(text || "{}"));
  }
);

const main = async () => {
  await server.connect(new StdioServerTransport());
  const exit = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", exit);
  process.on("SIGTERM", exit);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
