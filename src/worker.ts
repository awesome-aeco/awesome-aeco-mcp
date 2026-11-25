import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CatalogClient, DEFAULT_CATALOG_URL } from "./catalog.js";
import {
  createAwesomeAecoServer,
  SERVER_NAME,
  SERVER_VERSION,
} from "./server.js";

export interface Env {
  CATALOG_URL?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function createWorkerCatalogClient(catalogUrl: string): CatalogClient {
  return new CatalogClient({
    catalogUrl,
    // Keep cache per-request short and rely on Cloudflare edge caching
    cacheTtlMs: 0,
    fetchImpl: (input, init) =>
      fetch(input, {
        ...init,
        cf: {
          cacheTtl: 900,
          cacheEverything: true,
        },
      } as RequestInit),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return withCors(
        Response.json({
          status: "ok",
          name: SERVER_NAME,
          version: SERVER_VERSION,
        })
      );
    }

    if (url.pathname === "/" && request.method === "GET") {
      return withCors(
        Response.json({
          name: SERVER_NAME,
          version: SERVER_VERSION,
          description:
            "Remote Model Context Protocol (MCP) server for Awesome AECO.",
          mcp_endpoint: `${url.origin}/mcp`,
          catalog_url: env.CATALOG_URL ?? DEFAULT_CATALOG_URL,
          docs: "https://awesome-aeco.github.io/ai/",
          repository: "https://github.com/awesome-aeco/awesome-aeco-mcp",
        })
      );
    }

    if (url.pathname === "/mcp") {
      if (request.method !== "POST") {
        return withCors(
          Response.json(
            {
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message:
                  "Method not allowed. Send JSON-RPC requests via POST /mcp (stateless Streamable HTTP).",
              },
              id: null,
            },
            { status: 405, headers: { Allow: "POST, OPTIONS" } }
          )
        );
      }

      const client = createWorkerCatalogClient(
        env.CATALOG_URL ?? DEFAULT_CATALOG_URL
      );
      const server = createAwesomeAecoServer(client);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      await server.connect(transport);
      try {
        const response = await transport.handleRequest(request);
        return withCors(response);
      } finally {
        await server.close();
      }
    }

    return withCors(
      Response.json(
        { error: "Not found", mcp_endpoint: `${url.origin}/mcp` },
        { status: 404 }
      )
    );
  },
};
