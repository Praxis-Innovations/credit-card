import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PreviousCard, PreviousDiscovery } from "./store";

interface CacheFile {
  compare: Record<string, PreviousDiscovery>;
  cards: Record<string, PreviousCard>;
}

/**
 * Local page-hash cache in output/cache.json so repeated local (and dry) runs
 * skip Claude for unchanged pages even without database history.
 */
export class LocalCache {
  private data: CacheFile = { compare: {}, cards: {} };

  constructor(private readonly file: string | null) {}

  async load(): Promise<this> {
    if (!this.file) return this;
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as Partial<CacheFile>;
      this.data = { compare: parsed.compare ?? {}, cards: parsed.cards ?? {} };
    } catch {
      // Missing or unreadable cache just means no skips this run.
    }
    return this;
  }

  getCompare(url: string): PreviousDiscovery | null {
    return this.data.compare[url] ?? null;
  }
  setCompare(url: string, value: PreviousDiscovery): void {
    this.data.compare[url] = value;
  }
  getCard(url: string): PreviousCard | null {
    return this.data.cards[url] ?? null;
  }
  setCard(url: string, value: PreviousCard): void {
    this.data.cards[url] = value;
  }

  async save(): Promise<void> {
    if (!this.file) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, `${JSON.stringify(this.data, null, 2)}\n`);
  }
}
