# awesome-aeco-mcp

Model Context Protocol (MCP) server for querying curated open-source tools from [Awesome AECO](https://awesome-aeco.org/) (Architecture, Engineering, Construction & Operations).

Backed by the live [`catalog.json`](https://awesome-aeco.org/data/catalog.json) endpoint (enriched automatically with GitHub stars, star deltas, languages, SPDX licenses, topics, archived status, and inferred AECO/openBIM tags).

## Tools

| Tool | Description |
| --- | --- |
| `search_tools` | Search and filter AECO tools by keyword, `category`, `tag` (e.g. `IFC`, `IDS`, `BCF`, `CityGML`, `MCP`, `Revit`), `language`, `license`, `exclude_archived`, and `sort` (`relevance`, `stars`, `recent`, `name`). |
| `get_tool` | Get full details and GitHub metadata for a specific tool by `id`, `name`, or `owner/repo`. |
| `list_categories` | List all AECO categories with entry counts and top tags. |
| `list_tags` | List available domain/standard tags, programming languages, and licenses with entry counts. |
| `get_movers` | Get fastest-growing repositories (weekly star delta), newly added tools, and recently updated repositories. |

## Quick Start (Local stdio via `npx`)

Add to your MCP client configuration (Claude Desktop, Cursor, VS Code, Windsurf, Antigravity, etc.):

```json
{
  "mcpServers": {
    "awesome-aeco": {
      "command": "npx",
      "args": ["-y", "awesome-aeco-mcp"]
    }
  }
}
```

### Environment Variables

- `AWESOME_AECO_CATALOG_URL`: Optional override for the catalog JSON URL (defaults to `https://awesome-aeco.org/data/catalog.json`).

## Remote MCP (Cloudflare Worker)

A hosted stateless Streamable HTTP MCP server is live at:

- **MCP Endpoint:** `https://mcp.awesome-aeco.org/mcp`
- **Service Info:** `https://mcp.awesome-aeco.org/`
- **Health Check:** `https://mcp.awesome-aeco.org/health`

Example remote MCP client configuration:

```json
{
  "mcpServers": {
    "awesome-aeco": {
      "url": "https://mcp.awesome-aeco.org/mcp"
    }
  }
}
```

### Deploy Your Own Worker

```bash
npm install
npm run dev:worker      # Local dev via wrangler
npm run deploy:worker   # Deploy to Cloudflare Workers
```

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

- Server code: [MIT](LICENSE)
- Catalog data (`catalog.json`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Underlying curated list (`readme.md`): [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
