/**
 * Generated card illustrations (decision 2026-09-27, docs/data/ASSETS.md):
 * render one neutral illustration per card, upload it to
 * brand-assets/cards/generated/ and point cards.image_url at it with rights
 * 'generated'. Cards with licensed / issuer_provided art are never touched.
 *
 *   pnpm --filter api assets:generate-card-art [--only id,id] [--dry-run] [--by <who>]
 *
 * Idempotent: object paths are content-hashed and a row is only written when
 * its image fields would change. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { parseArgs } from "node:util";
import type { CreditCard } from "@/domain";
import { createServiceClient } from "../data-pipeline/supabase";
import { objectPathFor, storagePathFromPublicUrl } from "./assets";
import { illustrationAlt, rasterizeSvg, renderIllustrationSvg } from "./card-art/illustration";
import { publicUrlFor, replaceAsset } from "./storage";

export type CardImageRow = Pick<CreditCard, "id" | "issuer" | "name" | "network"> & {
  image_url: string | null;
  image_alt: string | null;
  image_source_url: string | null;
  image_rights_status: string;
};

export type CardPlan =
  | { action: "skip"; reason: string }
  | { action: "unchanged" }
  | {
      action: "update";
      patch: {
        image_url: string;
        image_alt: string;
        image_source_url: null;
        image_rights_status: "generated";
      };
      /** Stored object the row pointed at before, deleted once replaced. */
      previousPath: string | null;
    };

/** Object path of a card's illustration, derived from the rendered bytes. */
export function illustrationPath(card: CardImageRow, png: Uint8Array): string {
  return objectPathFor("card", card.id, "illustration.png", png, "generated");
}

/** What to do with one card row, given its illustration's path and public URL. */
export function planCard(row: CardImageRow, target: { path: string; url: string }): CardPlan {
  if (row.image_rights_status === "licensed" || row.image_rights_status === "issuer_provided") {
    return { action: "skip", reason: `has ${row.image_rights_status} art` };
  }
  const patch = {
    image_url: target.url,
    image_alt: illustrationAlt(row),
    image_source_url: null,
    image_rights_status: "generated" as const,
  };
  if (
    row.image_url === patch.image_url &&
    row.image_alt === patch.image_alt &&
    row.image_source_url === null &&
    row.image_rights_status === "generated"
  ) {
    return { action: "unchanged" };
  }
  const previous = storagePathFromPublicUrl(row.image_url);
  return { action: "update", patch, previousPath: previous === target.path ? null : previous };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      only: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      by: { type: "string", default: "script:assets:generate-card-art" },
    },
  });
  const only = values.only?.split(",").map((s) => s.trim()).filter(Boolean);
  const client = createServiceClient();

  const { data, error } = await client
    .from("cards")
    .select("id, issuer, name, network, image_url, image_alt, image_source_url, image_rights_status")
    .order("id");
  if (error) throw error;
  const rows = ((data ?? []) as CardImageRow[]).filter((r) => !only?.length || only.includes(r.id));

  const counts = { total: rows.length, updated: 0, unchanged: 0, skipped: 0 };
  for (const row of rows) {
    const png = await rasterizeSvg(renderIllustrationSvg(row));
    const path = illustrationPath(row, png);
    const plan = planCard(row, { path, url: publicUrlFor(client, path) });

    if (plan.action === "skip") {
      counts.skipped++;
      console.log(`${row.id.padEnd(28)} skipped (${plan.reason})`);
      continue;
    }
    if (plan.action === "unchanged") {
      counts.unchanged++;
      continue;
    }
    counts.updated++;
    console.log(
      `${row.id.padEnd(28)} ${values["dry-run"] ? "would update" : "updated"} → ${path}` +
        (plan.previousPath ? ` (replaces ${plan.previousPath})` : ""),
    );
    if (values["dry-run"]) continue;
    await replaceAsset(client, {
      kind: "card",
      id: row.id,
      path,
      bytes: png,
      contentType: "image/png",
      previousPath: plan.previousPath,
      patch: () => ({
        ...plan.patch,
        image_updated_at: new Date().toISOString(),
        image_updated_by: values.by!,
      }),
    });
  }
  console.log(JSON.stringify({ ...counts, dryRun: values["dry-run"] }));
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
