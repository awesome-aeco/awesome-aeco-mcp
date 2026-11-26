import type {
  Catalog,
  CatalogEntry,
  CategorySummary,
  CheckBeforeBuildingOptions,
  CheckBeforeBuildingResult,
  DraftSubmissionOptions,
  DraftSubmissionResult,
  MoversOptions,
  MoversResult,
  SearchToolsOptions,
  SearchToolsResult,
  TagSummary,
} from "./types.js";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function tokenize(query: string): string[] {
  return normalize(query)
    .split(/[\s,;/]+/)
    .filter((token) => token.length > 0);
}

function scoreEntry(entry: CatalogEntry, rawQuery: string): number {
  const q = normalize(rawQuery);
  if (!q) return 0;

  const name = normalize(entry.name);
  const id = normalize(entry.id);
  const desc = normalize(entry.description);
  const category = normalize(entry.category);
  const repo = normalize(entry.github_repo);
  const tags = entry.tags.map(normalize);
  const topics = (entry.github?.topics ?? []).map(normalize);

  let score = 0;

  if (name === q || id === q) score += 100;
  else if (name.startsWith(q)) score += 60;
  else if (name.includes(q)) score += 40;

  if (repo.includes(q)) score += 25;
  if (tags.some((t) => t === q)) score += 35;
  else if (tags.some((t) => t.includes(q))) score += 20;

  if (topics.some((t) => t === q)) score += 25;
  else if (topics.some((t) => t.includes(q))) score += 12;

  if (desc.includes(q)) score += 18;
  if (category.includes(q)) score += 10;

  const tokens = tokenize(q);
  if (tokens.length > 1) {
    let matchedTokens = 0;
    for (const token of tokens) {
      let tokenHit = false;
      if (name.includes(token)) {
        score += 14;
        tokenHit = true;
      }
      if (tags.some((t) => t.includes(token))) {
        score += 12;
        tokenHit = true;
      }
      if (topics.some((t) => t.includes(token))) {
        score += 8;
        tokenHit = true;
      }
      if (desc.includes(token)) {
        score += 6;
        tokenHit = true;
      }
      if (category.includes(token)) {
        score += 4;
        tokenHit = true;
      }
      if (tokenHit) matchedTokens += 1;
    }
    if (matchedTokens === tokens.length) {
      score += 20;
    }
  }

  return score;
}

function compareByStars(a: CatalogEntry, b: CatalogEntry): number {
  const starsA = a.github?.stars ?? -1;
  const starsB = b.github?.stars ?? -1;
  if (starsB !== starsA) return starsB - starsA;
  return a.name.localeCompare(b.name);
}

function compareByRecent(a: CatalogEntry, b: CatalogEntry): number {
  const pushedA = a.github?.pushed_at ?? "";
  const pushedB = b.github?.pushed_at ?? "";
  if (pushedB !== pushedA) return pushedB.localeCompare(pushedA);
  return compareByStars(a, b);
}

export function searchTools(
  catalog: Catalog,
  options: SearchToolsOptions = {}
): SearchToolsResult {
  const {
    query,
    category,
    tag,
    language,
    license,
    exclude_archived = true,
    sort,
    limit = 20,
  } = options;

  const clampedLimit = Math.max(1, Math.min(50, limit));
  const qNorm = normalize(query);
  const catNorm = normalize(category);
  const tagNorm = normalize(tag);
  const langNorm = normalize(language);
  const licNorm = normalize(license);

  const scored: Array<{ entry: CatalogEntry; score: number }> = [];

  for (const entry of catalog.entries) {
    if (exclude_archived && entry.github?.archived) continue;

    if (catNorm && !normalize(entry.category).includes(catNorm)) continue;

    if (tagNorm) {
      const hasTag =
        entry.tags.some((t) => normalize(t) === tagNorm || normalize(t).includes(tagNorm)) ||
        (entry.github?.topics ?? []).some((t) => normalize(t) === tagNorm);
      if (!hasTag) continue;
    }

    if (langNorm) {
      const entryLang = normalize(entry.github?.language);
      if (!entryLang || entryLang !== langNorm) continue;
    }

    if (licNorm) {
      const entryLic = normalize(entry.github?.license);
      if (!entryLic || !entryLic.includes(licNorm)) continue;
    }

    const score = qNorm ? scoreEntry(entry, qNorm) : 0;
    if (qNorm && score === 0) continue;

    scored.push({ entry, score });
  }

  const effectiveSort = sort ?? (qNorm ? "relevance" : "stars");

  scored.sort((a, b) => {
    if (effectiveSort === "relevance") {
      if (b.score !== a.score) return b.score - a.score;
      return compareByStars(a.entry, b.entry);
    }
    if (effectiveSort === "recent") {
      return compareByRecent(a.entry, b.entry);
    }
    if (effectiveSort === "name") {
      return a.entry.name.localeCompare(b.entry.name);
    }
    return compareByStars(a.entry, b.entry);
  });

  const results = scored.slice(0, clampedLimit).map((item) => item.entry);

  return {
    total_matches: scored.length,
    returned: results.length,
    generated_at: catalog.generated_at,
    results,
  };
}

export function getTool(
  catalog: Catalog,
  identifier: string
): CatalogEntry | null {
  const target = normalize(identifier);
  if (!target) return null;

  // 1. Exact id, name, or github_repo match
  const exact = catalog.entries.find(
    (e) =>
      normalize(e.id) === target ||
      normalize(e.name) === target ||
      normalize(e.github_repo) === target
  );
  if (exact) return exact;

  // 2. Partial name or repo match (best match by shortest name)
  const partials = catalog.entries
    .filter(
      (e) =>
        normalize(e.name).includes(target) ||
        normalize(e.id).includes(target) ||
        normalize(e.github_repo).includes(target)
    )
    .sort((a, b) => a.name.length - b.name.length);

  return partials[0] ?? null;
}

export function listCategories(catalog: Catalog): CategorySummary[] {
  const counts = new Map<string, { count: number; tags: Map<string, number> }>();

  for (const cat of catalog.categories) {
    counts.set(cat, { count: 0, tags: new Map() });
  }

  for (const entry of catalog.entries) {
    let bucket = counts.get(entry.category);
    if (!bucket) {
      bucket = { count: 0, tags: new Map() };
      counts.set(entry.category, bucket);
    }
    bucket.count += 1;
    for (const tag of entry.tags) {
      bucket.tags.set(tag, (bucket.tags.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([name, bucket]) => ({
    name,
    count: bucket.count,
    top_tags: Array.from(bucket.tags.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([tag]) => tag),
  }));
}

export function listTags(catalog: Catalog): {
  tags: TagSummary[];
  languages: TagSummary[];
  licenses: TagSummary[];
} {
  const tagCounts = new Map<string, number>();
  const langCounts = new Map<string, number>();
  const licCounts = new Map<string, number>();

  for (const entry of catalog.entries) {
    for (const tag of entry.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const lang = entry.github?.language;
    if (lang) {
      langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
    }
    const lic = entry.github?.license;
    if (lic) {
      licCounts.set(lic, (licCounts.get(lic) ?? 0) + 1);
    }
  }

  const toSorted = (map: Map<string, number>): TagSummary[] =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));

  return {
    tags: toSorted(tagCounts),
    languages: toSorted(langCounts),
    licenses: toSorted(licCounts),
  };
}

export function getMovers(
  catalog: Catalog,
  options: MoversOptions = {}
): MoversResult {
  const limit = Math.max(1, Math.min(30, options.limit ?? 10));
  const catNorm = normalize(options.category);

  const entries = catNorm
    ? catalog.entries.filter((e) => normalize(e.category).includes(catNorm))
    : catalog.entries;

  const fastest_growing = entries
    .filter((e) => !e.github?.archived && (e.github?.stars_delta ?? 0) > 0)
    .sort((a, b) => {
      const deltaDiff = (b.github?.stars_delta ?? 0) - (a.github?.stars_delta ?? 0);
      if (deltaDiff !== 0) return deltaDiff;
      return compareByStars(a, b);
    })
    .slice(0, limit);

  const new_entries = entries
    .filter((e) => e.is_new)
    .sort(compareByStars)
    .slice(0, limit);

  const recently_updated = entries
    .filter((e) => !e.github?.archived && Boolean(e.github?.pushed_at))
    .sort(compareByRecent)
    .slice(0, limit);

  const archived_count = entries.filter((e) => e.github?.archived).length;

  return {
    generated_at: catalog.generated_at,
    has_star_deltas: entries.some((e) => e.github?.stars_delta !== null && e.github?.stars_delta !== undefined),
    fastest_growing,
    new_entries,
    recently_updated,
    archived_count,
  };
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "with",
  "in",
  "to",
  "of",
  "and",
  "or",
  "on",
  "from",
  "scratch",
  "build",
  "building",
  "create",
  "creating",
  "write",
  "writing",
  "make",
  "making",
  "tool",
  "library",
  "app",
  "need",
  "want",
]);

function extractGoalQuery(goal: string): string {
  const tokens = tokenize(goal).filter((t) => !STOP_WORDS.has(t));
  return tokens.length > 0 ? tokens.join(" ") : normalize(goal);
}

export function checkBeforeBuilding(
  catalog: Catalog,
  options: CheckBeforeBuildingOptions
): CheckBeforeBuildingResult {
  const limit = Math.max(1, Math.min(20, options.limit ?? 8));
  const goalQuery = extractGoalQuery(options.goal);
  const langNorm = normalize(options.language);
  const licNorm = normalize(options.license_preference);

  const scored: Array<{ entry: CatalogEntry; score: number }> = [];
  for (const entry of catalog.entries) {
    const score = scoreEntry(entry, goalQuery);
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return compareByStars(a.entry, b.entry);
  });

  const archived_matches = scored
    .filter((s) => s.entry.github?.archived)
    .slice(0, 5)
    .map((s) => s.entry);

  const active = scored.filter((s) => !s.entry.github?.archived);

  const exact_matches: CatalogEntry[] = [];
  const adjacent_matches: CatalogEntry[] = [];

  for (const item of active) {
    const entryLang = normalize(item.entry.github?.language);
    const entryLic = normalize(item.entry.github?.license);
    const langOk = !langNorm || entryLang === langNorm;
    const licOk = !licNorm || entryLic.includes(licNorm);

    if (langOk && licOk && exact_matches.length < limit) {
      exact_matches.push(item.entry);
    } else if (adjacent_matches.length < limit) {
      adjacent_matches.push(item.entry);
    }
  }

  return {
    goal: options.goal,
    generated_at: catalog.generated_at,
    exact_matches,
    adjacent_matches,
    archived_matches,
  };
}

const GITHUB_URL_RE = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/?$/;
const ISSUE_FORM_BASE =
  "https://github.com/awesome-aeco/Awesome-AECO/issues/new";

export function draftSubmission(
  catalog: Catalog,
  options: DraftSubmissionOptions
): DraftSubmissionResult {
  const name = options.name.trim();
  const category = options.category.trim();
  const rawDesc = options.description.trim();
  const description = rawDesc.endsWith(".") ? rawDesc : `${rawDesc}.`;
  const rawGithub = (options.github_url ?? "").trim().replace(/\/+$/, "");
  const rawWebsite = (options.website_url ?? "").trim();

  const warnings: string[] = [];

  if (!rawGithub && !rawWebsite) {
    warnings.push("Provide at least one of github_url or website_url.");
  }

  let githubRepo = "";
  if (rawGithub) {
    const match = rawGithub.match(GITHUB_URL_RE);
    if (match) {
      githubRepo = match[1];
    } else {
      warnings.push(
        "github_url should be a canonical repository URL like https://github.com/owner/repo."
      );
    }
  }

  if (
    category &&
    !catalog.categories.some((c) => normalize(c) === normalize(category))
  ) {
    warnings.push(
      `Category "${category}" is not an existing section. Call list_categories to pick an existing section if one fits.`
    );
  }

  const nameNorm = normalize(name);
  const repoNorm = normalize(githubRepo);
  const webNorm = normalize(rawWebsite).replace(/\/+$/, "");

  const duplicate =
    catalog.entries.find((e) => {
      if (nameNorm && normalize(e.name) === nameNorm) return true;
      if (repoNorm && normalize(e.github_repo) === repoNorm) return true;
      if (
        webNorm &&
        e.website &&
        normalize(e.website).replace(/\/+$/, "") === webNorm
      ) {
        return true;
      }
      return false;
    }) ?? null;

  const linkParts: string[] = [];
  if (rawWebsite) {
    let host = rawWebsite;
    try {
      host = new URL(rawWebsite).hostname.replace(/^www\./i, "");
    } catch {
      warnings.push("website_url should be a valid https:// URL.");
    }
    linkParts.push(`Website: [${host}](${rawWebsite})`);
  }
  if (rawGithub) {
    linkParts.push(`GitHub: [${githubRepo || rawGithub}](${rawGithub})`);
  }

  const markdown_entry = [
    `- **${name}**`,
    `  ${description}`,
    `  *${linkParts.join(" · ")}*`,
  ].join("\n");

  const params = new URLSearchParams({
    template: "suggest-resource.yml",
    title: `Add ${name}`,
    name,
    category,
    description,
    is_author:
      options.is_author === false
        ? "No, I am recommending someone else's project"
        : "Yes, I am the author or a maintainer",
  });
  if (rawGithub) params.set("github_url", rawGithub);
  if (rawWebsite) params.set("website_url", rawWebsite);

  return {
    duplicate,
    issue_form_url: `${ISSUE_FORM_BASE}?${params.toString()}`,
    markdown_entry,
    warnings,
  };
}
