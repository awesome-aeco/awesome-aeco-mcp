import { describe, expect, it } from "vitest";
import {
  getMovers,
  getTool,
  listCategories,
  listTags,
  searchTools,
} from "../src/query.js";
import type { Catalog } from "../src/types.js";

export const SAMPLE_CATALOG: Catalog = {
  schema_version: 1,
  generated_at: "2026-11-25T00:36:01Z",
  source: "https://github.com/awesome-aeco/Awesome-AECO/blob/main/readme.md",
  license: "CC-BY-4.0",
  stats: {
    total_entries: 4,
    categories: 3,
    github_repos: 4,
    enriched_repos: 4,
    archived_repos: 1,
    fetch_errors: 0,
  },
  categories: [
    "BIM (Building Information Modeling)",
    "Energy & Sustainability",
    "AI & Automation for AECO",
  ],
  entries: [
    {
      id: "ifcopenshell",
      name: "IfcOpenShell",
      category: "BIM (Building Information Modeling)",
      description:
        "Open-source toolkit and geometry engine for BuildingSMART IFC files.",
      website: null,
      github_url: "https://github.com/IfcOpenShell/IfcOpenShell",
      github_repo: "IfcOpenShell/IfcOpenShell",
      tags: ["IFC", "BIM"],
      github: {
        full_name: "IfcOpenShell/IfcOpenShell",
        stars: 3000,
        forks: 1000,
        open_issues: 500,
        language: "C++",
        license: "LGPL-3.0",
        topics: ["ifc", "openbim"],
        archived: false,
        pushed_at: "2026-11-24T22:00:00Z",
        default_branch: "v0.9.0",
        homepage: null,
        error: null,
        stars_prev: 2950,
        stars_delta: 50,
      },
      is_new: false,
    },
    {
      id: "idfkit-mcp",
      name: "idfkit-mcp",
      category: "AI & Automation for AECO",
      description:
        "MCP server for EnergyPlus IDF building energy simulation models.",
      website: null,
      github_url: "https://github.com/example/idfkit-mcp",
      github_repo: "example/idfkit-mcp",
      tags: ["MCP", "Energy"],
      github: {
        full_name: "example/idfkit-mcp",
        stars: 120,
        forks: 15,
        open_issues: 4,
        language: "Python",
        license: "MIT",
        topics: ["mcp", "energyplus"],
        archived: false,
        pushed_at: "2026-11-25T10:00:00Z",
        default_branch: "main",
        homepage: null,
        error: null,
        stars_prev: null,
        stars_delta: null,
      },
      is_new: true,
    },
    {
      id: "ladybug",
      name: "Ladybug",
      category: "Energy & Sustainability",
      description:
        "Environmental analysis and daylight simulation plugin for Rhino and Grasshopper.",
      website: "https://www.ladybug.tools/",
      github_url: "https://github.com/ladybug-tools/ladybug",
      github_repo: "ladybug-tools/ladybug",
      tags: ["Energy", "Rhino", "Grasshopper"],
      github: {
        full_name: "ladybug-tools/ladybug",
        stars: 950,
        forks: 200,
        open_issues: 30,
        language: "Python",
        license: "GPL-3.0",
        topics: ["energy", "daylight"],
        archived: false,
        pushed_at: "2026-11-20T12:00:00Z",
        default_branch: "master",
        homepage: "https://www.ladybug.tools/",
        error: null,
        stars_prev: 940,
        stars_delta: 10,
      },
      is_new: false,
    },
    {
      id: "old-bim-tool",
      name: "OldBimTool",
      category: "BIM (Building Information Modeling)",
      description: "Legacy archived IFC viewer.",
      website: null,
      github_url: "https://github.com/example/old-bim-tool",
      github_repo: "example/old-bim-tool",
      tags: ["IFC"],
      github: {
        full_name: "example/old-bim-tool",
        stars: 500,
        forks: 50,
        open_issues: 0,
        language: "JavaScript",
        license: "MIT",
        topics: ["ifc"],
        archived: true,
        pushed_at: "2020-01-01T00:00:00Z",
        default_branch: "main",
        homepage: null,
        error: null,
        stars_prev: 500,
        stars_delta: 0,
      },
      is_new: false,
    },
  ],
};

describe("query helpers", () => {
  it("excludes archived repos by default and includes them when requested", () => {
    const defaultRes = searchTools(SAMPLE_CATALOG, { tag: "IFC" });
    expect(defaultRes.results.map((r) => r.id)).toEqual(["ifcopenshell"]);

    const withArchived = searchTools(SAMPLE_CATALOG, {
      tag: "IFC",
      exclude_archived: false,
    });
    expect(withArchived.results.map((r) => r.id)).toEqual([
      "ifcopenshell",
      "old-bim-tool",
    ]);
  });

  it("filters by language, license, category, and keyword", () => {
    const res = searchTools(SAMPLE_CATALOG, {
      query: "energy",
      language: "python",
      license: "mit",
    });
    expect(res.total_matches).toBe(1);
    expect(res.results[0].id).toBe("idfkit-mcp");
  });

  it("resolves tools by id, name, repo, or partial match", () => {
    expect(getTool(SAMPLE_CATALOG, "ifcopenshell")?.name).toBe("IfcOpenShell");
    expect(getTool(SAMPLE_CATALOG, "IfcOpenShell/IfcOpenShell")?.id).toBe(
      "ifcopenshell"
    );
    expect(getTool(SAMPLE_CATALOG, "lady")?.id).toBe("ladybug");
    expect(getTool(SAMPLE_CATALOG, "does-not-exist")).toBeNull();
  });

  it("summarizes categories and tags", () => {
    const cats = listCategories(SAMPLE_CATALOG);
    expect(cats).toHaveLength(3);
    expect(cats[0]).toMatchObject({
      name: "BIM (Building Information Modeling)",
      count: 2,
    });

    const taxonomy = listTags(SAMPLE_CATALOG);
    expect(taxonomy.tags[0].count).toBe(2);
    expect(taxonomy.languages.find((l) => l.tag === "Python")?.count).toBe(2);
    expect(taxonomy.licenses.find((l) => l.tag === "MIT")?.count).toBe(2);
  });

  it("computes movers correctly", () => {
    const movers = getMovers(SAMPLE_CATALOG);
    expect(movers.has_star_deltas).toBe(true);
    expect(movers.fastest_growing.map((e) => e.id)).toEqual([
      "ifcopenshell",
      "ladybug",
    ]);
    expect(movers.new_entries.map((e) => e.id)).toEqual(["idfkit-mcp"]);
    expect(movers.recently_updated[0].id).toBe("idfkit-mcp");
    expect(movers.archived_count).toBe(1);
  });
});
