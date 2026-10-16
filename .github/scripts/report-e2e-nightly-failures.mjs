#!/usr/bin/env node
/**
 * Open or update one GitHub issue per failing Playwright suite after a nightly
 * E2E run on main. Dedupes via an HTML marker in the issue body so a suite
 * never has two open failure issues at once.
 *
 * Env (set by the workflow):
 *   GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SHA, GITHUB_SERVER_URL
 *   GH_TOKEN / GITHUB_TOKEN — for gh CLI
 *   RESULTS_JSON — path to Playwright JSON report (default e2e/test-results/results.json)
 *   DRY_RUN — if "1", print bodies and skip create/update
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const MARKER_PREFIX = "<!-- e2e-nightly-suite:";
const MARKER_SUFFIX = " -->";
const SUITES = ["api", "web", "admin", "app"];

/** @type {Record<string, { title: string; labels: string[] }>} */
const SUITE_META = {
  api: {
    title: "[e2e/api] Nightly regression failing",
    labels: ["kind:agent", "stream:platform", "app:api", "app:e2e"],
  },
  web: {
    title: "[e2e/web] Nightly regression failing",
    labels: ["kind:agent", "stream:web", "app:web", "app:e2e"],
  },
  admin: {
    title: "[e2e/admin] Nightly regression failing",
    labels: ["kind:agent", "stream:admin", "app:admin", "app:e2e"],
  },
  app: {
    title: "[e2e/app] Nightly regression failing",
    labels: ["kind:agent", "stream:mobile", "app:mobile", "app:e2e"],
  },
  infra: {
    title: "[e2e] Nightly suite failed before tests",
    labels: ["kind:agent", "stream:platform", "app:infra", "app:e2e"],
  },
};

function marker(suite) {
  return `${MARKER_PREFIX}${suite}${MARKER_SUFFIX}`;
}

function gh(args, { allowFail = false } = {}) {
  const r = spawnSync("gh", args, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0 && !allowFail) {
    const err = (r.stderr || r.stdout || "").trim();
    throw new Error(`gh ${args.join(" ")} failed (exit ${r.status}): ${err}`);
  }
  return (r.stdout || "").trim();
}

function repoUrl() {
  const server = process.env.GITHUB_SERVER_URL || "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY is required");
  return `${server}/${repo}`;
}

function runUrl() {
  const id = process.env.GITHUB_RUN_ID;
  if (!id) return null;
  return `${repoUrl()}/actions/runs/${id}`;
}

/**
 * Resolve the uploaded nightly report artifact to a clickable Actions UI URL.
 * Uses actions:read via the REST API (archive_download_url needs auth; the UI
 * artifact page is what humans can open).
 */
function resolveArtifactPageUrl() {
  const runId = process.env.GITHUB_RUN_ID;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!runId || !repo) return null;
  const name = `e2e-report-full-${runId}`;
  try {
    const raw = gh([
      "api",
      `repos/${repo}/actions/runs/${runId}/artifacts`,
      "--jq",
      `.artifacts[] | select(.name == "${name}") | .id`,
    ]);
    const id = raw.split("\n").map((s) => s.trim()).find(Boolean);
    if (!id) return null;
    return `${repoUrl()}/actions/runs/${runId}/artifacts/${id}`;
  } catch (err) {
    console.warn(`Could not resolve artifact URL: ${err.message || err}`);
    return null;
  }
}

function writeTemp(text) {
  const dir = process.env.RUNNER_TEMP || "/tmp";
  const file = path.join(
    dir,
    `e2e-nightly-issue-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.md`,
  );
  writeFileSync(file, text, "utf8");
  return file;
}

function isFileLevelSuite(suite) {
  if (!suite.file || !suite.title) return false;
  const file = String(suite.file).replace(/\\/g, "/");
  const title = String(suite.title).replace(/\\/g, "/");
  return title === file || file.endsWith(`/${title}`) || file.endsWith(title);
}

/**
 * Walk Playwright JSON reporter output and collect unexpected tests by project.
 * Builds the human title from enclosing describe titles + spec.title (JSON specs
 * have no titlePath). Skips the file-level suite title — `file` is shown separately.
 *
 * @param {unknown} report
 * @returns {Map<string, Array<{ title: string; file: string; error: string; traces: string[] }>>}
 */
function collectFailuresBySuite(report) {
  /** @type {Map<string, Array<{ title: string; file: string; error: string; traces: string[] }>>} */
  const bySuite = new Map();

  function add(project, entry) {
    const key = SUITES.includes(project) ? project : project || "unknown";
    if (!bySuite.has(key)) bySuite.set(key, []);
    bySuite.get(key).push(entry);
  }

  function walkSuite(suite, inheritedProject, titleParts) {
    const projectName = suite.projectName || inheritedProject;
    const nextParts = [...titleParts];
    if (suite.title && !isFileLevelSuite(suite)) {
      nextParts.push(suite.title);
    }

    for (const child of suite.suites || []) {
      walkSuite(child, projectName, nextParts);
    }

    for (const spec of suite.specs || []) {
      const title =
        [...nextParts, spec.title].filter(Boolean).join(" › ") ||
        spec.title ||
        "(unnamed)";
      for (const test of spec.tests || []) {
        const project = test.projectName || projectName || "unknown";
        // Prefer Playwright's rolled-up status so test.fail() / flaky match the UI.
        if (test.status !== "unexpected") continue;
        const results = test.results || [];
        const last = results.length ? results[results.length - 1] : null;
        const traces = (last?.attachments || [])
          .filter((a) => a.name === "trace" && a.path)
          .map((a) => relativizeTrace(a.path));
        const error =
          (last?.error && (last.error.message || last.error.value)) ||
          last?.status ||
          test.status ||
          "unexpected";
        add(project, {
          title,
          file: spec.file || test.location?.file || "",
          error: String(error).split("\n")[0].slice(0, 240),
          traces,
        });
      }
    }
  }

  for (const suite of report.suites || []) {
    walkSuite(suite, undefined, []);
  }
  return bySuite;
}

function relativizeTrace(absPath) {
  const normalized = absPath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/test-results/");
  if (idx >= 0) return `e2e${normalized.slice(idx)}`;
  if (normalized.includes("e2e/test-results/")) {
    return normalized.slice(normalized.indexOf("e2e/test-results/"));
  }
  return path.basename(normalized);
}

function lastGreenCommit() {
  try {
    const raw = gh(
      [
        "run",
        "list",
        "--workflow",
        "E2E nightly",
        "--branch",
        "main",
        "--status",
        "success",
        "--limit",
        "5",
        "--json",
        "headSha,databaseId,url,createdAt,conclusion",
      ],
      { allowFail: true },
    );
    if (!raw) return null;
    const runs = JSON.parse(raw);
    const current = process.env.GITHUB_RUN_ID;
    const green = runs.find(
      (r) =>
        r.conclusion === "success" &&
        String(r.databaseId) !== String(current || ""),
    );
    if (!green) return null;
    return {
      sha: green.headSha,
      url: green.url,
      short: String(green.headSha).slice(0, 7),
    };
  } catch {
    return null;
  }
}

function findOpenIssue(suite) {
  const needle = marker(suite);
  // Must not swallow errors: a failed list would otherwise create a duplicate.
  const raw = gh([
    "issue",
    "list",
    "--state",
    "open",
    "--label",
    "app:e2e",
    "--limit",
    "50",
    "--json",
    "number,title,body,url",
  ]);
  const issues = JSON.parse(raw || "[]");
  return issues.find((i) => (i.body || "").includes(needle)) || null;
}

function buildBody({ suite, failures, failingSha, green, reason, artifactUrl }) {
  const run = runUrl();
  const lines = [];
  lines.push(marker(suite));
  lines.push("");
  lines.push(
    `Automated report from the **E2E nightly** workflow on \`main\`.`,
  );
  lines.push("");
  lines.push(`- **Failing commit:** \`${failingSha}\``);
  if (green) {
    lines.push(
      `- **Last green commit:** [\`${green.short}\`](${repoUrl()}/commit/${green.sha}) ([workflow run](${green.url}))`,
    );
  } else {
    lines.push(`- **Last green commit:** _(none found on main)_`);
  }
  if (run) lines.push(`- **This run:** ${run}`);
  if (artifactUrl) {
    lines.push(`- **Report artifact:** [e2e-report-full-${process.env.GITHUB_RUN_ID}](${artifactUrl})`);
  } else if (process.env.GITHUB_RUN_ID) {
    lines.push(
      `- **Report artifact:** e2e-report-full-${process.env.GITHUB_RUN_ID} (see run → Artifacts)`,
    );
  }
  lines.push("");

  if (reason) {
    lines.push("## Why");
    lines.push("");
    lines.push(reason);
    lines.push("");
  }

  if (failures && failures.length > 0) {
    lines.push("## Failing tests");
    lines.push("");
    for (const f of failures) {
      const where = f.file ? ` (\`${f.file}\`)` : "";
      lines.push(`- **${f.title}**${where}`);
      if (f.error) lines.push(`  - ${f.error}`);
      if (f.traces.length) {
        for (const t of f.traces) {
          if (artifactUrl) {
            lines.push(
              `  - Trace: [\`${t}\`](${artifactUrl}) (path inside the zip; \`npx playwright show-trace\` after download)`,
            );
          } else {
            lines.push(
              `  - Trace path: \`${t}\` — download the run artifact, then \`npx playwright show-trace\``,
            );
          }
        }
      } else if (artifactUrl) {
        lines.push(
          `  - Trace: none attached — see HTML report / screenshots in the [artifact](${artifactUrl})`,
        );
      } else {
        lines.push(
          `  - Trace: none attached (see HTML report / screenshots in the artifact)`,
        );
      }
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(
    `_Updated by GitHub Actions. One open issue per suite (\`${suite}\`); later failures update this issue instead of opening a duplicate._`,
  );
  return lines.join("\n");
}

function upsertIssue(suite, body, comment) {
  const meta = SUITE_META[suite] || SUITE_META.infra;
  const existing = findOpenIssue(suite);
  const dry = process.env.DRY_RUN === "1";

  if (dry) {
    console.log(
      `--- DRY_RUN suite=${suite} existing=${existing?.number || "none"} ---`,
    );
    console.log(body);
    if (comment) console.log("--- comment ---\n" + comment);
    return;
  }

  if (existing) {
    console.log(`Updating issue #${existing.number} for suite=${suite}`);
    gh(["issue", "edit", String(existing.number), "--body-file", writeTemp(body)]);
    gh([
      "issue",
      "edit",
      String(existing.number),
      "--add-label",
      meta.labels.join(","),
    ]);
    if (comment) {
      gh([
        "issue",
        "comment",
        String(existing.number),
        "--body-file",
        writeTemp(comment),
      ]);
    }
    console.log(existing.url);
    return;
  }

  console.log(`Creating issue for suite=${suite}`);
  const url = gh([
    "issue",
    "create",
    "--title",
    meta.title,
    "--body-file",
    writeTemp(body),
    "--label",
    meta.labels.join(","),
  ]);
  console.log(url);
}

function recurrenceComment(failingSha, extraLines) {
  const run = runUrl();
  return [
    `### Recurrence`,
    ``,
    `- Commit: \`${failingSha}\``,
    run ? `- Run: ${run}` : null,
    ...extraLines,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function reportSuite(suite, body, comment, errors) {
  try {
    upsertIssue(suite, body, comment);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to upsert issue for suite=${suite}: ${msg}`);
    errors.push(suite);
  }
}

function main() {
  const resultsPath =
    process.env.RESULTS_JSON ||
    path.join(process.cwd(), "e2e/test-results/results.json");
  const failingSha = process.env.GITHUB_SHA || "unknown";
  const green = lastGreenCommit();
  const artifactUrl = resolveArtifactPageUrl();
  /** @type {string[]} */
  const errors = [];

  if (!existsSync(resultsPath)) {
    const suite = "infra";
    reportSuite(
      suite,
      buildBody({
        suite,
        failures: [],
        failingSha,
        green,
        reason:
          "The nightly job failed before a Playwright JSON report was produced (stack/setup/timeout). Check the workflow logs and artifacts.",
        artifactUrl,
      }),
      recurrenceComment(failingSha, [
        `- No \`results.json\` — failure was outside the test runner.`,
      ]),
      errors,
    );
    if (errors.length) process.exit(1);
    return;
  }

  const report = JSON.parse(readFileSync(resultsPath, "utf8"));
  const bySuite = collectFailuresBySuite(report);
  const failedSuites = [...bySuite.entries()].filter(
    ([suite, list]) => SUITES.includes(suite) && list.length > 0,
  );

  if (failedSuites.length === 0) {
    const suite = "infra";
    reportSuite(
      suite,
      buildBody({
        suite,
        failures: [],
        failingSha,
        green,
        reason:
          "The nightly job failed, but the Playwright report has no failed tests. Likely a post-test step, upload, or runner error.",
        artifactUrl,
      }),
      recurrenceComment(failingSha, [
        `- Playwright report present; zero failed tests.`,
      ]),
      errors,
    );
    if (errors.length) process.exit(1);
    return;
  }

  for (const [suite, failures] of failedSuites) {
    reportSuite(
      suite,
      buildBody({
        suite,
        failures,
        failingSha,
        green,
        reason: null,
        artifactUrl,
      }),
      recurrenceComment(failingSha, [
        `- Failures: ${failures.length}`,
        ...failures.slice(0, 20).map((f) => `  - ${f.title}`),
      ]),
      errors,
    );
  }

  if (errors.length) {
    console.error(
      `Issue reporting failed for suite(s): ${errors.join(", ")}`,
    );
    process.exit(1);
  }
}

main();
