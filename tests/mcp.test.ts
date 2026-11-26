import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { CatalogClient } from "../src/catalog.js";
import { createAwesomeAecoServer } from "../src/server.js";
import worker from "../src/worker.js";
import { SAMPLE_CATALOG } from "./query.test.js";

function createMockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("SKILL.md")) {
      return new Response(`# Mock Skill\nLoaded from ${url}\n`, {
        status: 200,
        headers: { "Content-Type": "text/markdown" },
      });
    }
    return new Response(JSON.stringify(SAMPLE_CATALOG), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("MCP server tools (InMemoryTransport)", () => {
  it("lists all 5 tools and executes them", async () => {
    const catalogClient = new CatalogClient({ fetchImpl: createMockFetch() });
    const server = createAwesomeAecoServer(catalogClient);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "check_before_building",
      "draft_submission",
      "get_movers",
      "get_tool",
      "list_categories",
      "list_tags",
      "search_tools",
    ]);
    for (const tool of tools) {
      expect(tool.title).toBeTruthy();
      expect(tool.annotations?.title).toBeTruthy();
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
    }

    const searchRes = await client.callTool({
      name: "search_tools",
      arguments: { tag: "IFC" },
    });
    const searchText = (searchRes.content as Array<{ text: string }>)[0].text;
    expect(searchText).toContain("IfcOpenShell");
    expect(searchText).not.toContain("OldBimTool");

    const toolRes = await client.callTool({
      name: "get_tool",
      arguments: { identifier: "idfkit-mcp" },
    });
    const toolText = (toolRes.content as Array<{ text: string }>)[0].text;
    expect(toolText).toContain("# idfkit-mcp");
    expect(toolText).toContain("MIT");

    const catRes = await client.callTool({
      name: "list_categories",
      arguments: {},
    });
    const catText = (catRes.content as Array<{ text: string }>)[0].text;
    expect(catText).toContain("BIM (Building Information Modeling)");

    const tagsRes = await client.callTool({
      name: "list_tags",
      arguments: {},
    });
    const tagsText = (tagsRes.content as Array<{ text: string }>)[0].text;
    expect(tagsText).toContain("IFC (2)");

    const moversRes = await client.callTool({
      name: "get_movers",
      arguments: {},
    });
    const moversText = (moversRes.content as Array<{ text: string }>)[0].text;
    expect(moversText).toContain("Fastest Growing");
    expect(moversText).toContain("IfcOpenShell");

    const checkRes = await client.callTool({
      name: "check_before_building",
      arguments: { goal: "parse IFC files", language: "C++" },
    });
    const checkText = (checkRes.content as Array<{ text: string }>)[0].text;
    expect(checkText).toContain("IfcOpenShell");
    expect(checkText).toContain("Archived Repositories");
    expect(checkText).toContain("OldBimTool");

    const gapRes = await client.callTool({
      name: "check_before_building",
      arguments: { goal: "quantum bridge analyzer", language: "Rust" },
    });
    const gapText = (gapRes.content as Array<{ text: string }>)[0].text;
    expect(gapText).toContain("template=wanted-tool.yml");
    expect(gapText).toContain("language=Rust");

    const draftRes = await client.callTool({
      name: "draft_submission",
      arguments: {
        name: "FreshTool",
        github_url: "https://github.com/acme/fresh-tool",
        category: "BIM (Building Information Modeling)",
        description: "Open-source IFC validation CLI for CI pipelines.",
      },
    });
    const draftText = (draftRes.content as Array<{ text: string }>)[0].text;
    expect(draftText).toContain("template=suggest-resource.yml");
    expect(draftText).toContain("*GitHub: [acme/fresh-tool](https://github.com/acme/fresh-tool)*");

    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual([
      "add-after-you-build",
      "find-or-build-aeco-tool",
    ]);
    const promptRes = await client.getPrompt({
      name: "find-or-build-aeco-tool",
      arguments: { goal: "IFC viewer", language: "TypeScript" },
    });
    expect(promptRes.messages[0].content).toMatchObject({
      type: "text",
    });

    const addPromptRes = await client.getPrompt({
      name: "add-after-you-build",
      arguments: { project_name: "FreshTool" },
    });
    expect(addPromptRes.messages[0].content).toMatchObject({
      type: "text",
    });

    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual([
      "awesome-aeco://skills/add-after-you-build",
      "awesome-aeco://skills/awesome-aeco",
    ]);
    const skillRes = await client.readResource({
      uri: "awesome-aeco://skills/add-after-you-build",
    });
    expect(skillRes.contents[0]).toMatchObject({
      uri: "awesome-aeco://skills/add-after-you-build",
      mimeType: "text/markdown",
    });
    expect((skillRes.contents[0] as { text: string }).text).toContain(
      "skills/add-after-you-build/SKILL.md"
    );

    await client.close();
    await server.close();
  });
});

describe("Cloudflare Worker entrypoint", () => {
  it("handles /, /health, CORS OPTIONS, and 405 on GET /mcp", async () => {
    const infoRes = await worker.fetch(new Request("https://example.com/"), {});
    expect(infoRes.status).toBe(200);
    const info = (await infoRes.json()) as { mcp_endpoint: string };
    expect(info.mcp_endpoint).toBe("https://example.com/mcp");

    const healthRes = await worker.fetch(
      new Request("https://example.com/health"),
      {}
    );
    expect(healthRes.status).toBe(200);

    const optRes = await worker.fetch(
      new Request("https://example.com/mcp", { method: "OPTIONS" }),
      {}
    );
    expect(optRes.status).toBe(204);
    expect(optRes.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const getMcpRes = await worker.fetch(
      new Request("https://example.com/mcp", { method: "GET" }),
      {}
    );
    expect(getMcpRes.status).toBe(405);
  });

  it("handles stateless MCP initialize and tools/list over POST /mcp", async () => {
    const initReq = new Request("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "worker-test", version: "1.0.0" },
        },
      }),
    });

    const initRes = await worker.fetch(initReq, {});
    expect(initRes.status).toBe(200);
    const initJson = (await initRes.json()) as {
      result: { serverInfo: { name: string } };
    };
    expect(initJson.result.serverInfo.name).toBe("awesome-aeco-mcp");

    const listReq = new Request("https://example.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });

    const listRes = await worker.fetch(listReq, {});
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(listJson.result.tools).toHaveLength(7);
  });
});
