#!/usr/bin/env node
/**
 * CLI: pnpm import:<kind> <file>
 * Writes merchant_code_findings only. Never loads live catalog rows.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createSupabaseFindingStore,
  importMccCsv,
  isImportKind,
  IMPORT_KINDS,
} from "./mcc-import";

async function main() {
  const [, , kindArg, fileArg] = process.argv;
  if (!kindArg || !fileArg || !isImportKind(kindArg)) {
    console.error(
      `Usage: tsx src/lib/mcc-import-cli.ts <kind> <file>\nKinds: ${IMPORT_KINDS.join(", ")}`,
    );
    process.exit(2);
  }

  const csvText = readFileSync(resolve(fileArg), "utf8");
  const store = createSupabaseFindingStore();
  const result = await importMccCsv(kindArg, csvText, store);

  console.log(
    JSON.stringify(
      {
        kind: result.kind,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        rejected: result.rejected.length,
        rejections: result.rejected,
      },
      null,
      2,
    ),
  );

  if (result.rejected.length > 0 && result.inserted + result.updated + result.unchanged === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
