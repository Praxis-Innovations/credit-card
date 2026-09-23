import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatSourceHealthMarkdown,
  runSourceHealth,
} from "./source-health";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  console.log("NorthTap source-health — verified catalog URLs");
  const report = await runSourceHealth({
    reviewedBy: process.env.PIPELINE_REVIEWER ?? "pipeline:source-health",
    limit: process.env.SOURCE_HEALTH_LIMIT
      ? Number(process.env.SOURCE_HEALTH_LIMIT)
      : undefined,
  });
  const md = formatSourceHealthMarkdown(report);
  const outDir = path.join(__dirname, "reports");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "source-health-latest.md"), md, "utf8");
  await writeFile(
    path.join(outDir, "source-health-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Done. ok=${report.summary.ok} failed=${report.summary.failed} stale=${report.summary.markedStale}`,
  );
  console.log(`Report: ${path.join(outDir, "source-health-latest.md")}`);
  if (report.summary.failed > 0) process.exitCode = 0; // still succeed; issue upsert surfaces failures
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
