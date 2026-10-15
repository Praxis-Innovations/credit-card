import { afterEach, describe, expect, it, vi } from "vitest";
import { createClaudeClient, describeJwt, identityTokenProvider, resolveAuth, type RunCommand, type WifConfig } from "./auth";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims: object = { iss: "https://accounts.google.com", sub: "1234", aud: "https://api.anthropic.com" }) =>
  `${b64({ alg: "RS256" })}.${b64(claims)}.c2ln`;

const WIF = {
  ANTHROPIC_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000000",
  ANTHROPIC_FEDERATION_RULE_ID: "fdrl_test",
  ANTHROPIC_SERVICE_ACCOUNT_ID: "svac_test",
};

function configured(env: NodeJS.ProcessEnv): WifConfig {
  const r = resolveAuth(env);
  if (r.status !== "configured") throw new Error(`expected configured, got ${JSON.stringify(r)}`);
  return r.config;
}

describe("resolveAuth", () => {
  it("is 'none' when nothing is set, so dry runs can proceed without Claude", () => {
    expect(resolveAuth({})).toEqual({ status: "none", warnings: [] });
  });

  it("never treats a static API key as credentials, even an empty one", () => {
    const r = resolveAuth({ ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "x" });
    expect(r.status).toBe("none");
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/ANTHROPIC_API_KEY is set but ignored/);
  });

  it("lists missing variables when partly configured", () => {
    const r = resolveAuth({ CRAWLER_WIF_IDENTITY: "gcloud", ANTHROPIC_ORGANIZATION_ID: "org" });
    expect(r).toMatchObject({ status: "invalid" });
    expect(r.status === "invalid" && r.error).toMatch(/ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_SERVICE_ACCOUNT_ID/);
  });

  it("requires an identity source locally", () => {
    expect(resolveAuth(WIF)).toMatchObject({ status: "invalid", error: expect.stringMatching(/CRAWLER_WIF_IDENTITY/) });
    expect(resolveAuth({ ...WIF, CRAWLER_WIF_IDENTITY: "apikey" })).toMatchObject({ status: "invalid" });
  });

  it("requires the service account to impersonate for gcloud", () => {
    expect(resolveAuth({ ...WIF, CRAWLER_WIF_IDENTITY: "gcloud" })).toMatchObject({
      status: "invalid",
      error: expect.stringMatching(/CRAWLER_WIF_GCP_SERVICE_ACCOUNT/),
    });
    const c = configured({ ...WIF, CRAWLER_WIF_IDENTITY: "gcloud", CRAWLER_WIF_GCP_SERVICE_ACCOUNT: "sa@p.iam.gserviceaccount.com" });
    expect(c).toMatchObject({ source: "gcloud", serviceAccountId: "svac_test", workspaceId: undefined, baseURL: "https://api.anthropic.com" });
  });

  it("detects GitHub Actions and insists on id-token: write", () => {
    const gha = { ...WIF, GITHUB_ACTIONS: "true", ACTIONS_ID_TOKEN_REQUEST_URL: "https://gh.example/token?x=1" };
    expect(resolveAuth(gha)).toMatchObject({ status: "invalid", error: expect.stringMatching(/id-token: write/) });
    expect(configured({ ...gha, ACTIONS_ID_TOKEN_REQUEST_TOKEN: "rt" }).source).toBe("github-actions");
  });

  it("uses a token file when one is given", () => {
    expect(configured({ ...WIF, ANTHROPIC_IDENTITY_TOKEN_FILE: "/var/run/token" })).toMatchObject({ source: "file", tokenFile: "/var/run/token" });
  });
});

describe("identityTokenProvider", () => {
  it("gcloud: impersonates the service account with the Anthropic audience", async () => {
    const run = vi.fn<RunCommand>().mockResolvedValue(`${jwt()}\n`);
    const c = configured({ ...WIF, CRAWLER_WIF_IDENTITY: "gcloud", CRAWLER_WIF_GCP_SERVICE_ACCOUNT: "sa@p.iam.gserviceaccount.com" });
    expect(await identityTokenProvider(c, { run })()).toBe(jwt());
    expect(run).toHaveBeenCalledWith("gcloud", [
      "auth",
      "print-identity-token",
      "--impersonate-service-account=sa@p.iam.gserviceaccount.com",
      "--audiences=https://api.anthropic.com",
      "--include-email",
    ]);
  });

  it("gcloud: explains a missing CLI or login", async () => {
    const c = configured({ ...WIF, CRAWLER_WIF_IDENTITY: "gcloud", CRAWLER_WIF_GCP_SERVICE_ACCOUNT: "sa@p" });
    const missing = vi.fn<RunCommand>().mockRejectedValue(Object.assign(new Error("spawn gcloud ENOENT"), { code: "ENOENT" }));
    await expect(identityTokenProvider(c, { run: missing })()).rejects.toThrow(/gcloud CLI not found/);
    const stderr = "WARNING: This command is using service account impersonation.\nERROR: (gcloud.auth.print-identity-token) Permission denied\nPlease run:\n\n  $ gcloud auth login\n";
    const denied = vi.fn<RunCommand>().mockRejectedValue(Object.assign(new Error("exit 1"), { stderr }));
    await expect(identityTokenProvider(c, { run: denied })()).rejects.toThrow(
      /^gcloud: ERROR: \(gcloud.auth.print-identity-token\) Permission denied — .*serviceAccountTokenCreator/,
    );
    const garbage = vi.fn<RunCommand>().mockResolvedValue("not a token");
    await expect(identityTokenProvider(c, { run: garbage })()).rejects.toThrow(/did not return a JWT/);
  });

  it("aws: asks STS for a web identity token", async () => {
    const run = vi.fn<RunCommand>().mockResolvedValue(jwt());
    await identityTokenProvider(configured({ ...WIF, CRAWLER_WIF_IDENTITY: "aws" }), { run })();
    const [cmd, args] = run.mock.calls[0]!;
    expect(cmd).toBe("aws");
    expect(args.join(" ")).toContain("sts get-web-identity-token --region us-east-1 --audience https://api.anthropic.com");
  });

  it("github-actions: requests a fresh OIDC token with the audience on every call", async () => {
    const env = {
      ...WIF,
      GITHUB_ACTIONS: "true",
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://gh.example/token?api-version=2.0",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
    };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ value: jwt() }));
    const provider = identityTokenProvider(configured(env), { env, fetch: fetchMock });
    await provider();
    await provider();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://gh.example/token?api-version=2.0&audience=https%3A%2F%2Fapi.anthropic.com");
    expect(init?.headers).toEqual({ Authorization: "Bearer request-token" });
  });
});

describe("createClaudeClient", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("exchanges the identity token and calls Claude with a bearer token, ignoring ANTHROPIC_API_KEY", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-should-not-be-used");
    const assertion = jwt();
    const calls: { url: string; headers: Headers; body: unknown }[] = [];
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push({ url, headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith("/v1/oauth/token")) return Response.json({ access_token: "sk-ant-oat-short-lived", expires_in: 600 });
      return Response.json({
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: [{ type: "text", text: "pong" }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    });
    const config = configured({ ...WIF, ANTHROPIC_WORKSPACE_ID: "wrkspc_test", ANTHROPIC_IDENTITY_TOKEN: assertion });
    const client = createClaudeClient(config, { fetch: fetchMock });
    await client.messages.create({ model: "claude-sonnet-5-5", max_tokens: 1, messages: [{ role: "user", content: "ping" }] });

    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(["/v1/oauth/token", "/v1/messages"]);
    expect(calls[0]!.body).toMatchObject({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
      federation_rule_id: "fdrl_test",
      organization_id: WIF.ANTHROPIC_ORGANIZATION_ID,
      service_account_id: "svac_test",
      workspace_id: "wrkspc_test",
    });
    expect(calls[1]!.headers.get("authorization")).toBe("Bearer sk-ant-oat-short-lived");
    expect(calls[1]!.headers.get("x-api-key")).toBeNull();
  });
});

describe("describeJwt", () => {
  it("returns only non-secret claims", () => {
    const claims = describeJwt(jwt({ iss: "i", sub: "s", aud: "a", email: "e", nonce: "n" }));
    expect(claims).toEqual({ iss: "i", sub: "s", aud: "a", email: "e" });
  });
});
