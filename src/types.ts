export interface GitHubMetadata {
  full_name: string;
  stars: number | null;
  forks: number | null;
  open_issues: number | null;
  language: string | null;
  license: string | null;
  topics: string[];
  archived: boolean;
  pushed_at: string | null;
  default_branch: string | null;
  homepage: string | null;
  error: string | null;
  stars_prev: number | null;
  stars_delta: number | null;
}

export interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  website: string | null;
  github_url: string | null;
  github_repo: string | null;
  tags: string[];
  github: GitHubMetadata | null;
  is_new: boolean;
}

export interface CatalogStats {
  total_entries: number;
  categories: number;
  github_repos: number;
  enriched_repos: number;
  archived_repos: number;
  fetch_errors: number;
}

export interface Catalog {
  schema_version: number;
  generated_at: string;
  source: string;
  license: string;
  stats: CatalogStats;
  categories: string[];
  entries: CatalogEntry[];
}

export type SortOrder = "relevance" | "stars" | "recent" | "name";

export interface SearchToolsOptions {
  query?: string;
  category?: string;
  tag?: string;
  language?: string;
  license?: string;
  exclude_archived?: boolean;
  sort?: SortOrder;
  limit?: number;
}

export interface SearchToolsResult {
  total_matches: number;
  returned: number;
  generated_at: string;
  results: CatalogEntry[];
}

export interface CategorySummary {
  name: string;
  count: number;
  top_tags: string[];
}

export interface TagSummary {
  tag: string;
  count: number;
}

export interface MoversOptions {
  limit?: number;
  category?: string;
}

export interface MoversResult {
  generated_at: string;
  has_star_deltas: boolean;
  fastest_growing: CatalogEntry[];
  new_entries: CatalogEntry[];
  recently_updated: CatalogEntry[];
  archived_count: number;
}
