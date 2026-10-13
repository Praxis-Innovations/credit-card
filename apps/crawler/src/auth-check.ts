import { createClaudeClient, describeJwt, federationCredentials, identityTokenProvider, resolveAuth } from "./auth";
import { DEFAULT_MODEL } from "./config";
import { loadEnv } from "./env";

/**
 * Verifies the Workload Identity Federation setup step by step without
 * crawling: identity token claims, token exchange, then a one-token Claude call.
 * Prints claims and expiry only, never a token.
 */
async function main(): Promise<number> {
  loadEnv();
  const auth = resolveAuth(process.env);
  for (const w of auth.warnings) console.log(`warning: ${w}`);
  if (auth.status === "none") {
    console.error("Error: Workload Identity Federation is not configured (see apps/crawler/README.md).");
    return 2;
  }
  if (auth.status === "invalid") {
    console.error(`Error: ${auth.error}`);
    return 2;
  }
  const { config } = auth;
  console.log(`1. Identity token from ${config.source}`);
  const jwt = await identityTokenProvider(config)();
  console.log(JSON.stringify(describeJwt(jwt), null, 2).replace(/^/gm, "   "));

  console.log("2. Exchange for an Anthropic access token");
  const access = await federationCredentials(config)();
  const ttl = access.expiresAt ? `${Math.round(access.expiresAt - Date.now() / 1000)} s` : "no expiry";
  console.log(`   ok, expires in ${ttl}`);

  const model = process.env.CRAWLER_MODEL?.trim() || DEFAULT_MODEL;
  console.log(`3. One-token Messages call (${model})`);
  const msg = await createClaudeClient(config).messages.create({
    model,
    max_tokens: 1,
    messages: [{ role: "user", content: "ping" }],
  });
  console.log(`   ok (${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out)`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    console.error("A 401 from the exchange is deliberately opaque; the reason is in Claude Console → Settings → Workload identity → authentication history.");
    process.exit(1);
  },
);
