import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** apps/crawler/output — gitignored. */
export const OUTPUT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../output");

export interface OutputWriter {
  readonly dir: string | null;
  text(rel: string, body: string): Promise<void>;
  json(rel: string, value: unknown): Promise<void>;
}

export function fileOutput(dir: string): OutputWriter {
  const write = async (rel: string, body: string) => {
    const file = path.join(dir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  };
  return {
    dir,
    text: (rel, body) => write(rel, body.endsWith("\n") ? body : `${body}\n`),
    json: (rel, value) => write(rel, `${JSON.stringify(value, null, 2)}\n`),
  };
}

export const nullOutput: OutputWriter = {
  dir: null,
  text: async () => {},
  json: async () => {},
};

/** "…/visa/passport-infinite-card.html" -> "passport-infinite-card". */
export function slugForUrl(url: string): string {
  const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "page";
  return last.replace(/\.html?$/i, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase().slice(0, 80) || "page";
}
