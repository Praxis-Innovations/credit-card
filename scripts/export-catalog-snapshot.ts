/**
 * Writes apps/web/src/data/catalog-snapshot.json from the API catalog. Run
 * from the repo root after changing apps/api/src/domain/cards.ts or
 * valuations.ts:
 *
 *   pnpm snapshot:catalog
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SNAPSHOT_PATH, serializeCatalogSnapshot } from "./catalog-snapshot.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, SNAPSHOT_PATH);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, serializeCatalogSnapshot());
console.log(`Wrote ${SNAPSHOT_PATH}`);
