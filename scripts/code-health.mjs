#!/usr/bin/env node
/**
 * AU1 code-health runner.
 *
 *   node scripts/code-health.mjs            # CI: fail on new violations vs baseline
 *   node scripts/code-health.mjs --report   # print full report (includes baselined)
 *   node scripts/code-health.mjs --update-baseline
 *
 * Tools: ESLint (size/complexity), knip, jscpd, dependency-cruiser.
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_DIR = path.join(ROOT, "code-health", "baselines");
const TMP_DIR = path.join(ROOT, "code-health", ".tmp");

const args = new Set(process.argv.slice(2));
const REPORT = args.has("--report");
const UPDATE = args.has("--update-baseline");

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function nodeMajor() {
  return Number(process.versions.node.split(".")[0]);
}

/** dependency-cruiser supports ^22 || ^24 || >=26 (not Node 25). */
function depcruiseEnv() {
  const major = nodeMajor();
  if (major === 22 || major === 24 || major >= 26) return process.env;
  const probe = run("npx", ["--yes", "node@22", "-e", "process.stdout.write(process.execPath)"]);
  if (probe.status !== 0 || !probe.stdout.trim()) {
    throw new Error(
      `dependency-cruiser needs Node ^22 || ^24 || >=26 (current ${process.versions.node}). Install a supported Node or ensure npx can fetch node@22.`,
    );
  }
  const binDir = path.dirname(probe.stdout.trim());
  return { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}` };
}

function pnpm(args, opts = {}) {
  const env =
    args[0] === "depcruise" || args[0] === "dependency-cruiser"
      ? depcruiseEnv()
      : process.env;
  return run("pnpm", ["exec", ...args], { ...opts, env });
}

function ensureDirs() {
  mkdirSync(BASELINE_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });
}

function countMap(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item, (map.get(item) || 0) + 1);
  }
  return map;
}

function baselineToCountMap(baseline) {
  // Prefer { fingerprint: count }. Legacy unique-string arrays count as 1 each.
  if (Array.isArray(baseline)) return countMap(baseline);
  if (baseline && typeof baseline === "object") {
    return new Map(
      Object.entries(baseline).map(([k, v]) => [k, Number(v) || 0]),
    );
  }
  return new Map();
}

function readBaseline(name) {
  const file = path.join(BASELINE_DIR, name);
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeBaseline(name, fingerprints) {
  const counts = countMap(fingerprints);
  const obj = Object.fromEntries(
    [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  );
  writeFileSync(
    path.join(BASELINE_DIR, name),
    `${JSON.stringify(obj, null, 2)}\n`,
  );
  return obj;
}

/**
 * Fail only when a fingerprint's count increases vs baseline.
 * Line shifts / complexity 24→23 with the same (file, rule) stay green.
 */
function diffAgainstBaseline(fingerprints, baseline) {
  const current = countMap(fingerprints);
  const known = baselineToCountMap(baseline);
  const novel = [];
  const resolved = [];
  for (const [fp, count] of [...current.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const base = known.get(fp) || 0;
    if (count > base) {
      novel.push({
        fingerprint: fp,
        current: count,
        baseline: base,
        excess: count - base,
      });
    }
  }
  for (const [fp, base] of [...known.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const count = current.get(fp) || 0;
    if (count < base) {
      resolved.push({ fingerprint: fp, current: count, baseline: base });
    }
  }
  const knownTotal = [...known.values()].reduce((sum, n) => sum + n, 0);
  return {
    novel,
    resolved,
    total: fingerprints.length,
    known: knownTotal,
  };
}

// --- collectors -------------------------------------------------------------

function collectEslint() {
  const outFile = path.join(TMP_DIR, "eslint.json");
  const result = pnpm([
    "eslint",
    "-c",
    "eslint.code-health.config.mjs",
    "--no-error-on-unmatched-pattern",
    "-f",
    "json",
    "-o",
    outFile,
    "apps",
    "scripts",
  ]);
  // ESLint exits 1 when there are lint errors; still parse the report.
  if (!existsSync(outFile) && result.status > 1) {
    throw new Error(`eslint failed:\n${result.stderr || result.stdout}`);
  }
  const raw = existsSync(outFile)
    ? JSON.parse(readFileSync(outFile, "utf8"))
    : [];
  const findings = [];
  for (const file of raw) {
    for (const msg of file.messages ?? []) {
      if (msg.severity < 2) continue;
      const filePath = rel(file.filePath);
      const ruleId = msg.ruleId ?? "unknown";
      // Location-independent: count per (file, rule). Line shifts and
      // complexity 24→23 do not create a "new" fingerprint.
      findings.push({
        fingerprint: `eslint|${filePath}|${ruleId}`,
        summary: `${filePath}:${msg.line} ${ruleId} — ${msg.message}`,
      });
    }
  }
  return findings;
}

function collectKnip() {
  const result = pnpm([
    "knip",
    "--reporter",
    "json",
    "--no-progress",
    "--no-config-hints",
  ]);
  // knip exits non-zero when it finds issues; stdout is still JSON.
  let data;
  try {
    data = JSON.parse(result.stdout || "{}");
  } catch {
    throw new Error(`knip produced non-JSON output:\n${result.stdout}\n${result.stderr}`);
  }
  const findings = [];

  // knip ≥6 JSON reporter: { issues: [{ file, files, dependencies, exports, ... }] }
  const issueRows = Array.isArray(data.issues)
    ? data.issues
    : [{ file: "", ...data }];

  for (const issue of issueRows) {
    const file = issue.file ?? "";
    for (const row of issue.files ?? []) {
      const name = typeof row === "string" ? row : row.name;
      findings.push({
        fingerprint: `knip|file|${name}`,
        summary: `unused file: ${name}`,
      });
    }
    for (const row of issue.dependencies ?? []) {
      const name = typeof row === "string" ? row : row.name;
      findings.push({
        fingerprint: `knip|dep|${file}|${name}`,
        summary: `unused dependency: ${name}${file ? ` (${file})` : ""}`,
      });
    }
    for (const row of issue.devDependencies ?? []) {
      const name = typeof row === "string" ? row : row.name;
      findings.push({
        fingerprint: `knip|devDep|${file}|${name}`,
        summary: `unused devDependency: ${name}${file ? ` (${file})` : ""}`,
      });
    }
    for (const row of issue.unlisted ?? []) {
      const name = typeof row === "string" ? row : row.name;
      findings.push({
        fingerprint: `knip|unlisted|${file}|${name}`,
        summary: `unlisted dependency: ${name}${file ? ` in ${file}` : ""}`,
      });
    }
    for (const row of issue.exports ?? []) {
      const id = typeof row === "string" ? row : (row.name ?? row.id ?? "*");
      findings.push({
        fingerprint: `knip|export|${file}|${id}`,
        summary: `unused export: ${id} in ${file}`,
      });
    }
    for (const row of issue.types ?? []) {
      const id = typeof row === "string" ? row : (row.name ?? row.id ?? "*");
      findings.push({
        fingerprint: `knip|type|${file}|${id}`,
        summary: `unused type: ${id} in ${file}`,
      });
    }
    for (const row of issue.enumMembers ?? []) {
      const id = typeof row === "string" ? row : (row.name ?? row.id ?? "*");
      findings.push({
        fingerprint: `knip|enum|${file}|${id}`,
        summary: `unused enum member: ${id} in ${file}`,
      });
    }
    for (const row of issue.duplicates ?? []) {
      const names = (Array.isArray(row) ? row : [row])
        .map((x) => (typeof x === "string" ? x : (x.name ?? x)))
        .join(",");
      findings.push({
        fingerprint: `knip|dup|${file}|${names}`,
        summary: `duplicate export: ${names} in ${file}`,
      });
    }
  }
  return findings;
}

function collectJscpd() {
  const reportDir = path.join(ROOT, "code-health", ".jscpd-report");
  rmSync(reportDir, { recursive: true, force: true });
  const result = pnpm([
    "jscpd",
    "apps",
    "scripts",
    "--config",
    ".jscpd.json",
  ]);
  const jsonPath = path.join(reportDir, "jscpd-report.json");
  if (!existsSync(jsonPath)) {
    // No clones → jscpd may still write an empty report; treat as none.
    if (result.status === 0) return [];
    throw new Error(`jscpd failed:\n${result.stderr || result.stdout}`);
  }
  const data = JSON.parse(readFileSync(jsonPath, "utf8"));
  const duplicates = data.duplicates ?? [];
  const findings = [];
  for (const dup of duplicates) {
    const a = dup.firstFile ?? dup.first;
    const b = dup.secondFile ?? dup.second;
    const aPath = rel(a?.name ?? a?.path ?? "unknown");
    const bPath = rel(b?.name ?? b?.path ?? "unknown");
    const aStart = a?.start ?? a?.startLoc?.line ?? 0;
    const bStart = b?.start ?? b?.startLoc?.line ?? 0;
    const lines = dup.lines ?? dup.fragment?.split?.("\n")?.length ?? 0;
    // Location-independent: count per ordered file pair. Line shifts and
    // clone length churn do not create a "new" fingerprint.
    const [left, right] = [aPath, bPath].sort();
    findings.push({
      fingerprint: `jscpd|${left}|${right}`,
      summary: `clone (${lines} lines): ${aPath}:${aStart} ↔ ${bPath}:${bStart}`,
    });
  }
  return findings;
}

function collectDepCruiser() {
  const outFile = path.join(TMP_DIR, "depcruise.json");
  const result = pnpm([
    "depcruise",
    "apps",
    "scripts",
    "--config",
    ".dependency-cruiser.cjs",
    "--output-type",
    "json",
    "--output-to",
    outFile,
  ]);
  if (!existsSync(outFile)) {
    throw new Error(
      `dependency-cruiser failed:\n${result.stderr || result.stdout}`,
    );
  }
  const data = JSON.parse(readFileSync(outFile, "utf8"));
  const findings = [];
  for (const v of data.summary?.violations ?? []) {
    if (v.rule?.severity === "ignore") continue;
    const from = v.from ?? "";
    const to = v.to ?? "";
    const rule = v.rule?.name ?? "unknown";
    findings.push({
      fingerprint: `depcruise|${rule}|${from}|${to}`,
      summary: `${rule}: ${from} → ${to}`,
    });
  }
  return findings;
}

// --- main -------------------------------------------------------------------

const TOOLS = [
  { id: "eslint", title: "ESLint (size & complexity)", collect: collectEslint, baseline: "eslint.json" },
  { id: "knip", title: "knip (unused files/exports/deps)", collect: collectKnip, baseline: "knip.json" },
  { id: "jscpd", title: "jscpd (duplication)", collect: collectJscpd, baseline: "jscpd.json" },
  { id: "dependency-cruiser", title: "dependency-cruiser (boundaries)", collect: collectDepCruiser, baseline: "dependency-cruiser.json" },
];

function main() {
  ensureDirs();
  console.log(REPORT ? "Code-health full report\n" : UPDATE ? "Updating code-health baselines\n" : "Code-health check (new violations only)\n");

  let exitCode = 0;
  const summaryRows = [];

  for (const tool of TOOLS) {
    console.log(`▸ ${tool.title}`);
    let findings;
    try {
      findings = tool.collect();
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      exitCode = 1;
      summaryRows.push({ tool: tool.id, status: "error", novel: "—", total: "—" });
      continue;
    }

    const fingerprints = findings.map((f) => f.fingerprint);

    if (UPDATE) {
      const written = writeBaseline(tool.baseline, fingerprints);
      const total = Object.values(written).reduce((sum, n) => sum + n, 0);
      console.log(
        `  baseline ← ${total} finding(s) across ${Object.keys(written).length} key(s)\n`,
      );
      summaryRows.push({ tool: tool.id, status: "updated", novel: 0, total });
      continue;
    }

    const baseline = readBaseline(tool.baseline);
    const { novel, resolved, total, known } = diffAgainstBaseline(
      fingerprints,
      baseline,
    );
    const novelByFp = new Map(novel.map((n) => [n.fingerprint, n]));
    const novelExcess = novel.reduce((sum, n) => sum + n.excess, 0);

    if (REPORT) {
      if (findings.length === 0) {
        console.log("  (no findings)\n");
      } else {
        for (const f of findings) {
          const tag = novelByFp.has(f.fingerprint) ? "NEW" : "base";
          console.log(`  [${tag}] ${f.summary}`);
        }
        console.log("");
      }
    } else if (novel.length > 0) {
      console.log(
        `  ${novelExcess} new violation(s) across ${novel.length} key(s) (${total} total, ${known} baselined):`,
      );
      for (const n of novel) {
        console.log(
          `  [NEW] ${n.fingerprint} — count ${n.current} (baseline ${n.baseline}, +${n.excess})`,
        );
        for (const f of findings.filter((x) => x.fingerprint === n.fingerprint)) {
          console.log(`         ${f.summary}`);
        }
      }
      console.log("");
      exitCode = 1;
    } else {
      console.log(
        `  ok — ${total} finding(s), all baselined` +
          (resolved.length
            ? ` (${resolved.length} key(s) below baseline)`
            : "") +
          "\n",
      );
    }

    summaryRows.push({
      tool: tool.id,
      status: novel.length ? "fail" : "ok",
      novel: novelExcess,
      total,
    });
  }

  console.log("Summary");
  for (const row of summaryRows) {
    console.log(
      `  ${row.tool.padEnd(20)} ${String(row.status).padEnd(8)} novel=${row.novel}  total=${row.total}`,
    );
  }

  if (!UPDATE && !REPORT && exitCode === 0) {
    console.log("\nNo new code-health violations.");
  }
  if (REPORT) {
    console.log(
      "\nTip: CI fails only on [NEW] items. Refresh baselines with:\n  pnpm code-health:baseline",
    );
  }

  // Best-effort cleanup of transient reports (baselines stay).
  rmSync(TMP_DIR, { recursive: true, force: true });
  rmSync(path.join(ROOT, "code-health", ".jscpd-report"), {
    recursive: true,
    force: true,
  });

  process.exit(exitCode);
}

main();
