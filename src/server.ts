import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CatalogClient } from "./catalog.js";
import {
  getMovers,
  getTool,
  listCategories,
  listTags,
  searchTools,
} from "./query.js";
import type { CatalogEntry } from "./types.js";

export const SERVER_NAME = "awesome-aeco-mcp";
export const SERVER_VERSION = "0.1.1";

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function formatEntrySummary(entry: CatalogEntry): string {
  const parts: string[] = [`- **${entry.name}** (\`${entry.id}\`)`];
  const meta: string[] = [entry.category];
  if (entry.github?.stars !== null && entry.github?.stars !== undefined) {
    const delta =
      entry.github.stars_delta && entry.github.stars_delta > 0
        ? ` (+${entry.github.stars_delta})`
        : "";
    meta.push(`★ ${entry.github.stars.toLocaleString("en-US")}${delta}`);
  }
  if (entry.github?.language) meta.push(entry.github.language);
  if (entry.github?.license) meta.push(entry.github.license);
  if (entry.github?.archived) meta.push("ARCHIVED");
  parts.push(`  ${meta.join(" · ")}`);
  parts.push(`  ${entry.description}`);

  if (entry.tags.length > 0) {
    parts.push(`  Tags: ${entry.tags.join(", ")}`);
  }

  const links: string[] = [];
  if (entry.github_url) links.push(`GitHub: ${entry.github_url}`);
  if (entry.website) links.push(`Website: ${entry.website}`);
  if (links.length > 0) {
    parts.push(`  ${links.join(" | ")}`);
  }

  return parts.join("\n");
}

function formatEntryDetail(entry: CatalogEntry): string {
  const lines: string[] = [
    `# ${entry.name}`,
    "",
    entry.description,
    "",
    `- **ID:** \`${entry.id}\``,
    `- **Category:** ${entry.category}`,
  ];

  if (entry.tags.length > 0) {
    lines.push(`- **Tags:** ${entry.tags.join(", ")}`);
  }
  if (entry.github_url) {
    lines.push(`- **GitHub:** ${entry.github_url}`);
  }
  if (entry.website) {
    lines.push(`- **Website:** ${entry.website}`);
  }

  if (entry.github) {
    const g = entry.github;
    lines.push("");
    lines.push("## GitHub Metadata");
    if (g.stars !== null) {
      const deltaStr =
        g.stars_delta !== null && g.stars_delta !== 0
          ? ` (${g.stars_delta > 0 ? "+" : ""}${g.stars_delta} since previous snapshot)`
          : "";
      lines.push(`- **Stars:** ${g.stars.toLocaleString("en-US")}${deltaStr}`);
    }
    if (g.forks !== null) {
      lines.push(`- **Forks:** ${g.forks.toLocaleString("en-US")}`);
    }
    if (g.open_issues !== null) {
      lines.push(`- **Open Issues:** ${g.open_issues.toLocaleString("en-US")}`);
    }
    if (g.language) lines.push(`- **Language:** ${g.language}`);
    if (g.license) lines.push(`- **License:** ${g.license}`);
    if (g.pushed_at) lines.push(`- **Last Push:** ${g.pushed_at}`);
    if (g.default_branch) lines.push(`- **Default Branch:** ${g.default_branch}`);
    lines.push(`- **Archived:** ${g.archived ? "Yes" : "No"}`);
    if (g.topics.length > 0) {
      lines.push(`- **Topics:** ${g.topics.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function createAwesomeAecoServer(
  client: CatalogClient = new CatalogClient()
): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "search_tools",
    {
      title: "Search AECO Tools",
      description:
        "Search and filter curated open-source AECO (Architecture, Engineering, Construction & Operations) tools from Awesome AECO by keyword, category, domain/standard tag (e.g. IFC, IDS, BCF, CityGML, MCP, Revit, Energy), programming language, or license.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Free-text search across tool name, description, tags, and GitHub topics (e.g. 'ifc geometry python' or 'energy simulation')."
          ),
        category: z
          .string()
          .optional()
          .describe(
            "Filter by category name or substring (e.g. 'BIM', 'Simulation', 'AI', 'GIS'). Call list_categories to see all categories."
          ),
        tag: z
          .string()
          .optional()
          .describe(
            "Filter by standard or domain tag (e.g. 'IFC', 'MCP', 'BIM', 'Revit', 'Energy', 'CityGML', 'IDS', 'BCF'). Call list_tags to see all tags."
          ),
        language: z
          .string()
          .optional()
          .describe(
            "Filter by primary GitHub language (exact, case-insensitive, e.g. 'Python', 'TypeScript', 'C++', 'C#', 'Rust')."
          ),
        license: z
          .string()
          .optional()
          .describe(
            "Filter by SPDX license substring (case-insensitive, e.g. 'MIT', 'Apache-2.0', 'LGPL', 'GPL')."
          ),
        exclude_archived: z
          .boolean()
          .optional()
          .default(true)
          .describe("Exclude archived GitHub repositories (default: true)."),
        sort: z
          .enum(["relevance", "stars", "recent", "name"])
          .optional()
          .describe(
            "Sort order: 'relevance' (default when query is provided), 'stars' (default otherwise), 'recent' (by last push), or 'name'."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(20)
          .describe("Maximum number of tools to return (1–50, default: 20)."),
      },
      annotations: {
        ...READ_ONLY_ANNOTATIONS,
        title: "Search AECO Tools",
      },
    },
    async (args) => {
      const catalog = await client.getCatalog();
      const result = searchTools(catalog, args);

      if (result.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No matching AECO tools found. Try broadening your query or calling `list_categories` / `list_tags` to inspect available filters.",
            },
          ],
        };
      }

      const header = `Found ${result.total_matches} matching tools (showing ${result.returned}, catalog updated ${result.generated_at}):\n`;
      const body = result.results.map(formatEntrySummary).join("\n\n");

      return {
        content: [{ type: "text", text: `${header}\n${body}` }],
      };
    }
  );

  server.registerTool(
    "get_tool",
    {
      title: "Get AECO Tool Details",
      description:
        "Get full details and GitHub metadata for a specific tool in Awesome AECO by its id, name, or GitHub owner/repo.",
      inputSchema: {
        identifier: z
          .string()
          .min(1)
          .describe(
            "Tool id (e.g. 'ifcopenshell'), name (e.g. 'IfcOpenShell'), or GitHub repo (e.g. 'IfcOpenShell/IfcOpenShell')."
          ),
      },
      annotations: {
        ...READ_ONLY_ANNOTATIONS,
        title: "Get AECO Tool Details",
      },
    },
    async ({ identifier }) => {
      const catalog = await client.getCatalog();
      const entry = getTool(catalog, identifier);

      if (!entry) {
        return {
          content: [
            {
              type: "text",
              text: `No tool found matching "${identifier}". Try \`search_tools\` with a broader keyword.`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: formatEntryDetail(entry) }],
      };
    }
  );

  server.registerTool(
    "list_categories",
    {
      title: "List AECO Categories",
      description:
        "List all categories in Awesome AECO along with entry counts and top domain tags.",
      inputSchema: {},
      annotations: {
        ...READ_ONLY_ANNOTATIONS,
        title: "List AECO Categories",
      },
    },
    async () => {
      const catalog = await client.getCatalog();
      const categories = listCategories(catalog);

      const lines = [
        `Awesome AECO contains **${catalog.stats.total_entries} tools** across **${categories.length} categories** (updated ${catalog.generated_at}):`,
        "",
        ...categories.map((c) => {
          const tagNote =
            c.top_tags.length > 0 ? ` — top tags: ${c.top_tags.join(", ")}` : "";
          return `- **${c.name}** (${c.count})${tagNote}`;
        }),
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  server.registerTool(
    "list_tags",
    {
      title: "List AECO Tags & Licenses",
      description:
        "List available domain/standard tags, programming languages, and SPDX licenses in Awesome AECO with entry counts.",
      inputSchema: {},
      annotations: {
        ...READ_ONLY_ANNOTATIONS,
        title: "List AECO Tags & Licenses",
      },
    },
    async () => {
      const catalog = await client.getCatalog();
      const { tags, languages, licenses } = listTags(catalog);

      const formatList = (items: Array<{ tag: string; count: number }>) =>
        items.map((i) => `${i.tag} (${i.count})`).join(", ");

      const text = [
        `## Domain & Standard Tags (${tags.length})`,
        formatList(tags),
        "",
        `## Languages (${languages.length})`,
        formatList(languages),
        "",
        `## Licenses (${licenses.length})`,
        formatList(licenses),
      ].join("\n");

      return {
        content: [{ type: "text", text }],
      };
    }
  );

  server.registerTool(
    "get_movers",
    {
      title: "Get Awesome AECO Movers",
      description:
        "Get fastest-growing repositories (by weekly star delta), newly added tools, and recently active repositories in Awesome AECO.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .default(10)
          .describe("Maximum number of entries per section (1–30, default: 10)."),
        category: z
          .string()
          .optional()
          .describe("Optional category substring filter (e.g. 'BIM', 'AI')."),
      },
      annotations: {
        ...READ_ONLY_ANNOTATIONS,
        title: "Get Awesome AECO Movers",
      },
    },
    async (args) => {
      const catalog = await client.getCatalog();
      const movers = getMovers(catalog, args);

      const sections: string[] = [
        `# Awesome AECO Movers (snapshot: ${movers.generated_at})`,
        "",
      ];

      if (movers.fastest_growing.length > 0) {
        sections.push("## Fastest Growing (Weekly Star Delta)");
        sections.push(movers.fastest_growing.map(formatEntrySummary).join("\n\n"));
        sections.push("");
      } else if (!movers.has_star_deltas) {
        sections.push(
          "_Note: Weekly star deltas are not yet populated on this baseline catalog snapshot; showing recently updated repositories below._"
        );
        sections.push("");
      }

      if (movers.new_entries.length > 0) {
        sections.push("## Newly Added Tools");
        sections.push(movers.new_entries.map(formatEntrySummary).join("\n\n"));
        sections.push("");
      }

      if (movers.recently_updated.length > 0) {
        sections.push("## Recently Updated Repositories");
        sections.push(movers.recently_updated.map(formatEntrySummary).join("\n\n"));
        sections.push("");
      }

      sections.push(`Archived repositories in scope: ${movers.archived_count}`);

      return {
        content: [{ type: "text", text: sections.join("\n") }],
      };
    }
  );

  return server;
}
