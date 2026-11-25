#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CatalogClient, DEFAULT_CATALOG_URL } from "./catalog.js";
import { createAwesomeAecoServer } from "./server.js";

async function main(): Promise<void> {
  const catalogUrl = process.env.AWESOME_AECO_CATALOG_URL || DEFAULT_CATALOG_URL;
  const client = new CatalogClient({ catalogUrl });
  const server = createAwesomeAecoServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error starting awesome-aeco-mcp:", error);
  process.exit(1);
});
