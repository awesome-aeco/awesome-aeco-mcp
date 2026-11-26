import type { Catalog } from "./types.js";

export const DEFAULT_CATALOG_URL =
  "https://awesome-aeco.org/data/catalog.json";
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface CatalogClientOptions {
  catalogUrl?: string;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
}

export class CatalogClient {
  private readonly catalogUrl: string;
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private cached: { data: Catalog; expiresAt: number } | null = null;
  private inflight: Promise<Catalog> | null = null;
  private textCache = new Map<string, { text: string; expiresAt: number }>();

  constructor(options: CatalogClientOptions = {}) {
    this.catalogUrl = options.catalogUrl ?? DEFAULT_CATALOG_URL;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  async getCatalog(forceRefresh = false): Promise<Catalog> {
    const now = Date.now();
    if (!forceRefresh && this.cached && now < this.cached.expiresAt) {
      return this.cached.data;
    }

    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.fetchCatalog()
      .then((data) => {
        this.cached = { data, expiresAt: Date.now() + this.cacheTtlMs };
        return data;
      })
      .finally(() => {
        this.inflight = null;
      });

    return this.inflight;
  }

  async getText(url: string, forceRefresh = false): Promise<string> {
    const now = Date.now();
    const hit = this.textCache.get(url);
    if (!forceRefresh && hit && now < hit.expiresAt) {
      return hit.text;
    }

    const response = await this.fetchImpl(url, {
      headers: {
        Accept: "text/markdown, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": "awesome-aeco-mcp/0.1.1",
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch resource (${response.status} ${response.statusText}) from ${url}`
      );
    }

    const text = await response.text();
    this.textCache.set(url, { text, expiresAt: Date.now() + this.cacheTtlMs });
    return text;
  }

  private async fetchCatalog(): Promise<Catalog> {
    const response = await this.fetchImpl(this.catalogUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "awesome-aeco-mcp/0.1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Awesome AECO catalog (${response.status} ${response.statusText}) from ${this.catalogUrl}`
      );
    }

    const data = (await response.json()) as Catalog;
    if (!data || !Array.isArray(data.entries)) {
      throw new Error(
        `Invalid catalog payload received from ${this.catalogUrl}`
      );
    }

    return data;
  }
}
