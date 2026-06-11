import { readFileSync } from 'node:fs';
import type { CatalogEntry } from './types.js';

export interface SectionCount { section: string; count: number; }

export class Catalog {
  private byId = new Map<string, CatalogEntry>();

  constructor(private entries: CatalogEntry[]) {
    for (const e of entries) this.byId.set(e.id, e);
  }

  static load(path?: URL): Catalog {
    const url = path ?? new URL('../../catalog.json', import.meta.url);
    const entries = JSON.parse(readFileSync(url, 'utf8')) as CatalogEntry[];
    return new Catalog(entries);
  }

  all(): CatalogEntry[] { return this.entries; }

  get(id: string): CatalogEntry | undefined { return this.byId.get(id); }

  sections(): SectionCount[] {
    const counts = new Map<string, number>();
    for (const e of this.entries) counts.set(e.section, (counts.get(e.section) ?? 0) + 1);
    return [...counts.entries()].map(([section, count]) => ({ section, count }));
  }

  search(query: string, limit = 25): CatalogEntry[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const scored = this.entries.map((e) => {
      const hay = `${e.name} ${e.section} ${e.folderPath.join(' ')} ${e.pathTemplate} ${e.id}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (e.name.toLowerCase().includes(t)) score += 3;
        else if (hay.includes(t)) score += 1;
      }
      return { e, score };
    }).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((x) => x.e);
  }
}
