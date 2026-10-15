import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { identityTokenFromFile, identityTokenFromValue } from "@anthropic-ai/sdk/lib/credentials/identity-token";
import { oidcFederationProvider } from "@anthropic-ai/sdk/lib/credentials/oidc-federation";
import type { AccessTokenProvider, IdentityTokenProvider } from "@anthropic-ai/sdk/lib/credentials/types";

/**
 * Claude authentication via Anthropic Workload Identity Federation only. The
 * workload presents a short-lived OIDC JWT from an identity provider; the SDK
 * exchanges it for a short-lived Anthropic token bound to a service account
 * and refreshes it before expiry. Static API keys are never used.
 */

export const WIF_AUDIENCE = "https://api.anthropic.com";
const DEFAULT_BASE_URL = "https://api.anthropic.com";

export const IDENTITY_SOURCES = ["github-actions", "gcloud", "aws", "file"] as const;
export type IdentitySource = (typeof IDENTITY_SOURCES)[number];

export interface WifConfig {
  source: IdentitySource;
  organizationId: string;
  federationRuleId: string;
  serviceAccountId: string;
  workspaceId: string | undefined;
  baseURL: string;
  /** gcloud: Google service account to impersonate (the user's own gcloud login must hold Token Creator on it). */
  gcpServiceAccount: string | undefined;
  /** aws: regional STS endpoint for GetWebIdentityToken. */
  awsRegion: string;
  /** file: path from ANTHROPIC_IDENTITY_TOKEN_FILE, or a literal ANTHROPIC_IDENTITY_TOKEN. */
  tokenFile: string | undefined;
  tokenValue: string | undefined;
}

export type AuthResolution =
  | { status: "configured"; config: WifConfig; warnings: string[] }
  | { status: "none"; warnings: string[] }
  | { status: "invalid"; error: string; warnings: string[] };

const REQUIRED = ["ANTHROPIC_ORGANIZATION_ID", "ANTHROPIC_FEDERATION_RULE_ID", "ANTHROPIC_SERVICE_ACCOUNT_ID"] as const;

const val = (env: NodeJS.ProcessEnv, key: string) => {
  const v = env[key]?.trim();
  return v ? v : undefined;
};

/** Reads WIF settings from the environment. Pure: no network, no subprocesses. */
export function resolveAuth(env: NodeJS.ProcessEnv = process.env): AuthResolution {
  const warnings: string[] = [];
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]) {
    if (key in env) warnings.push(`${key} is set but ignored: the crawler authenticates with Workload Identity Federation only.`);
  }

  const explicit = val(env, "CRAWLER_WIF_IDENTITY");
  const anySet = REQUIRED.some((k) => val(env, k)) || explicit !== undefined;
  if (!anySet) return { status: "none", warnings };

  const missing = REQUIRED.filter((k) => !val(env, k));
  if (missing.length) {
    return { status: "invalid", error: `Workload Identity Federation is partly configured; missing ${missing.join(", ")}.`, warnings };
  }

  let source: IdentitySource;
  if (explicit) {
    if (!(IDENTITY_SOURCES as readonly string[]).includes(explicit)) {
      return { status: "invalid", error: `CRAWLER_WIF_IDENTITY must be one of ${IDENTITY_SOURCES.join(", ")} (got "${explicit}").`, warnings };
    }
    source = explicit as IdentitySource;
  } else if (env.GITHUB_ACTIONS === "true" && val(env, "ACTIONS_ID_TOKEN_REQUEST_URL")) {
    source = "github-actions";
  } else if (val(env, "ANTHROPIC_IDENTITY_TOKEN_FILE") || val(env, "ANTHROPIC_IDENTITY_TOKEN")) {
    source = "file";
  } else {
    return {
      status: "invalid",
      error: "Set CRAWLER_WIF_IDENTITY to gcloud or aws for local runs (see apps/crawler/README.md).",
      warnings,
    };
  }

  const config: WifConfig = {
    source,
    organizationId: val(env, "ANTHROPIC_ORGANIZATION_ID")!,
    federationRuleId: val(env, "ANTHROPIC_FEDERATION_RULE_ID")!,
    serviceAccountId: val(env, "ANTHROPIC_SERVICE_ACCOUNT_ID")!,
    workspaceId: val(env, "ANTHROPIC_WORKSPACE_ID"),
    baseURL: val(env, "ANTHROPIC_BASE_URL") ?? DEFAULT_BASE_URL,
    gcpServiceAccount: val(env, "CRAWLER_WIF_GCP_SERVICE_ACCOUNT"),
    awsRegion: val(env, "CRAWLER_WIF_AWS_REGION") ?? "us-east-1",
    tokenFile: val(env, "ANTHROPIC_IDENTITY_TOKEN_FILE"),
    tokenValue: val(env, "ANTHROPIC_IDENTITY_TOKEN"),
  };

  if (source === "github-actions" && !(val(env, "ACTIONS_ID_TOKEN_REQUEST_URL") && val(env, "ACTIONS_ID_TOKEN_REQUEST_TOKEN"))) {
    return {
      status: "invalid",
      error: "GitHub OIDC is unavailable: the job needs `permissions: id-token: write` (ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN unset).",
      warnings,
    };
  }
  if (source === "gcloud" && !config.gcpServiceAccount) {
    return { status: "invalid", error: "CRAWLER_WIF_GCP_SERVICE_ACCOUNT is required when CRAWLER_WIF_IDENTITY=gcloud.", warnings };
  }
  if (source === "file" && !config.tokenFile && !config.tokenValue) {
    return { status: "invalid", error: "Set ANTHROPIC_IDENTITY_TOKEN_FILE (or ANTHROPIC_IDENTITY_TOKEN) when CRAWLER_WIF_IDENTITY=file.", warnings };
  }
  return { status: "configured", config, warnings };
}

export type RunCommand = (cmd: string, args: string[]) => Promise<string>;

const execFileAsync = promisify(execFile);
const runCommand: RunCommand = async (cmd, args) => {
  const { stdout } = await execFileAsync(cmd, args, { timeout: 30_000, maxBuffer: 64 * 1024 });
  return stdout;
};

function asJwt(raw: string, from: string): string {
  const token = raw.trim();
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) throw new Error(`${from} did not return a JWT`);
  return token;
}

function commandError(cli: string, err: unknown, hint: string): Error {
  const e = err as NodeJS.ErrnoException & { stderr?: string };
  if (e.code === "ENOENT") return new Error(`${cli} CLI not found on PATH. ${hint}`);
  const lines = (e.stderr || e.message || String(err)).trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const detail = lines.find((l) => /^(ERROR|An error occurred)/.test(l)) ?? lines.at(-1) ?? "failed";
  return new Error(`${cli}: ${detail} — ${hint}`);
}

/**
 * Where the OIDC JWT comes from. Each call mints a fresh token, so a refresh
 * never re-presents an already-exchanged assertion (single-use `jti`).
 */
export function identityTokenProvider(config: WifConfig, deps: AuthDeps = {}): IdentityTokenProvider {
  const env = deps.env ?? process.env;
  const doFetch = deps.fetch ?? fetch;
  const run = deps.run ?? runCommand;

  switch (config.source) {
    case "github-actions":
      return async () => {
        const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL!);
        url.searchParams.set("audience", WIF_AUDIENCE);
        const res = await doFetch(url, { headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } });
        if (!res.ok) throw new Error(`GitHub OIDC token request failed: HTTP ${res.status}`);
        const body = (await res.json()) as { value?: string };
        return asJwt(body.value ?? "", "GitHub OIDC endpoint");
      };
    case "gcloud":
      return async () => {
        try {
          const out = await run("gcloud", [
            "auth",
            "print-identity-token",
            `--impersonate-service-account=${config.gcpServiceAccount}`,
            `--audiences=${WIF_AUDIENCE}`,
            "--include-email",
          ]);
          return asJwt(out, "gcloud");
        } catch (err) {
          throw commandError("gcloud", err, "Run `gcloud auth login` and check you hold roles/iam.serviceAccountTokenCreator on the service account.");
        }
      };
    case "aws":
      return async () => {
        try {
          const out = await run("aws", [
            "sts",
            "get-web-identity-token",
            "--region",
            config.awsRegion,
            "--audience",
            WIF_AUDIENCE,
            "--signing-algorithm",
            "RS256",
            "--duration-seconds",
            "900",
            "--query",
            "WebIdentityToken",
            "--output",
            "text",
          ]);
          return asJwt(out, "aws sts get-web-identity-token");
        } catch (err) {
          throw commandError("aws", err, "Run `aws sso login` (or set AWS_PROFILE) and use a current AWS CLI v2 that has `sts get-web-identity-token`.");
        }
      };
    case "file":
      return config.tokenFile ? identityTokenFromFile(config.tokenFile) : identityTokenFromValue(config.tokenValue!);
  }
}

type AuthDeps = { env?: NodeJS.ProcessEnv; fetch?: typeof fetch; run?: RunCommand };

/** Exchanges a fresh identity JWT for an Anthropic access token (jwt-bearer grant), via the SDK. */
export function federationCredentials(config: WifConfig, deps: AuthDeps = {}): AccessTokenProvider {
  return oidcFederationProvider({
    identityTokenProvider: identityTokenProvider(config, deps),
    federationRuleId: config.federationRuleId,
    organizationId: config.organizationId,
    serviceAccountId: config.serviceAccountId,
    workspaceId: config.workspaceId,
    baseURL: config.baseURL,
    fetch: deps.fetch ?? fetch,
  });
}

/** The only place a Claude client is constructed. The SDK caches the access token and refreshes it before expiry. */
export function createClaudeClient(config: WifConfig, deps: AuthDeps = {}): Anthropic {
  return new Anthropic({
    // Explicit nulls: otherwise the SDK reads ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN, which outrank `credentials`.
    apiKey: null,
    authToken: null,
    baseURL: config.baseURL,
    maxRetries: 2,
    fetch: deps.fetch ?? fetch,
    credentials: federationCredentials(config, deps),
  });
}

/** Non-secret claims of a JWT, for setup diagnostics. Never returns the token or its signature. */
export function describeJwt(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  const keep = ["iss", "sub", "aud", "email", "repository", "repository_owner", "ref", "event_name", "workflow", "exp", "iat"];
  return Object.fromEntries(keep.filter((k) => k in claims).map((k) => [k, claims[k]]));
}
