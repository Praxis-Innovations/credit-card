import { htmlToText, textContainsClaim } from "./extract/html";
import { FETCH_TIMEOUT_MS, PER_HOST_DELAY_MS, USER_AGENT } from "./sources";
import type { CorroborationResult, DiffFinding } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * For conflict findings, fetch an alternate cited sourceUrl (when available)
 * and check whether it supports the staging value, production value, both, or neither.
 */
export async function corroborateConflicts(
  findings: DiffFinding[],
  fetchImpl: typeof fetch = fetch,
): Promise<DiffFinding[]> {
  const out: DiffFinding[] = [];

  for (const finding of findings) {
    if (finding.kind !== "partnership_conflict") {
      out.push(finding);
      continue;
    }

    const primary = finding.sourceUrls[0];
    const alternates = [...new Set(finding.sourceUrls)].filter(
      (u) => u !== primary,
    );

    if (alternates.length === 0) {
      out.push({
        ...finding,
        corroboration: {
          note: "Only one source URL available — no third source to corroborate; human must decide between staging and production.",
          agreesWith: "unavailable",
        },
      });
      continue;
    }

    const thirdSourceUrl = alternates[0]!;
    await sleep(Math.min(PER_HOST_DELAY_MS, 1_500));

    try {
      const res = await fetchImpl(thirdSourceUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        out.push({
          ...finding,
          corroboration: {
            thirdSourceUrl,
            note: `Third source returned HTTP ${res.status}; could not corroborate.`,
            agreesWith: "unavailable",
          },
        });
        continue;
      }

      const text = htmlToText(await res.text());
      const staging = finding.stagingValue ?? "";
      const productionParts = (finding.productionValue ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const stagingHit =
        staging.length > 0 &&
        (textContainsClaim(text, staging) ||
          textContainsClaim(text, `${staging}¢`) ||
          textContainsClaim(text, `${staging} cents`));

      const productionHit = productionParts.some(
        (p) =>
          textContainsClaim(text, p) ||
          textContainsClaim(text, `${p}¢`) ||
          textContainsClaim(text, `${p} cents`),
      );

      let agreesWith: CorroborationResult["agreesWith"] = "neither";
      if (stagingHit && productionHit) agreesWith = "both";
      else if (stagingHit) agreesWith = "staging";
      else if (productionHit) agreesWith = "production";

      const snippetIdx = text
        .toLowerCase()
        .indexOf((staging || productionParts[0] || "").toLowerCase());
      const thirdValue =
        snippetIdx >= 0
          ? text.slice(Math.max(0, snippetIdx - 40), snippetIdx + 60).trim()
          : undefined;

      out.push({
        ...finding,
        corroboration: {
          thirdSourceUrl,
          thirdValue,
          agreesWith,
          note:
            agreesWith === "staging"
              ? "Third source leans toward the newly scraped value."
              : agreesWith === "production"
                ? "Third source still reflects cited production amounts."
                : agreesWith === "both"
                  ? "Third source mentions both staging and production figures (often marketing totals vs components)."
                  : "Third source did not clearly match either figure.",
        },
      });
    } catch (err) {
      out.push({
        ...finding,
        corroboration: {
          thirdSourceUrl,
          note: `Third source fetch failed: ${err instanceof Error ? err.message : String(err)}`,
          agreesWith: "unavailable",
        },
      });
    }
  }

  return out;
}
