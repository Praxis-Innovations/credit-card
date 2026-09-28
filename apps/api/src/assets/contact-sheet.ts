/**
 * Grid image of every card's stored art, for reviewing fetched / generated
 * picks at a glance.
 *
 *   pnpm --filter api assets:contact-sheet <out.jpg> [--columns 8]
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Reads the stored
 * image_url regardless of rights status (review only — don't publish the
 * output while it contains issuer art).
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import sharp, { type OverlayOptions } from "sharp";
import { createServiceClient } from "../data-pipeline/supabase";
import { escapeXml } from "./card-art/fallback";

const THUMB_W = 256;
const THUMB_H = 161;
const CELL_W = 280;
const CELL_H = 226;
const HEADER_H = 64;

interface Row {
  id: string;
  issuer: string;
  name: string;
  image_url: string | null;
  image_rights_status: string;
}

function label(row: Row, kind: string): Buffer {
  const name = `${row.issuer} ${row.name}`;
  const short = name.length > 40 ? `${name.slice(0, 39)}…` : name;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="48">
<text x="12" y="17" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="700" fill="#1d201f">${escapeXml(row.id)}</text>
<text x="12" y="33" font-family="Helvetica Neue, Arial, sans-serif" font-size="11" fill="#4b504d">${escapeXml(short)}</text>
<text x="12" y="47" font-family="Helvetica Neue, Arial, sans-serif" font-size="11" font-weight="700" fill="${kind === "issuer art" ? "#2f6b4f" : "#7a5a2a"}">${escapeXml(kind)}</text>
</svg>`,
  );
}

async function thumb(url: string | null): Promise<Buffer> {
  if (url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (res.ok) {
        return await sharp(Buffer.from(await res.arrayBuffer()))
          .resize(THUMB_W, THUMB_H, { fit: "contain", background: "#f4f4f2" })
          .flatten({ background: "#f4f4f2" })
          .png()
          .toBuffer();
      }
    } catch {
      // fall through to the empty tile
    }
  }
  return sharp({
    create: { width: THUMB_W, height: THUMB_H, channels: 3, background: "#d9d9d6" },
  })
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { columns: { type: "string", default: "8" } },
  });
  const out = positionals[0];
  if (!out) throw new Error("usage: assets:contact-sheet <out.jpg> [--columns 8]");
  const columns = Number(values.columns);

  const client = createServiceClient();
  const { data, error } = await client
    .from("cards")
    .select("id, issuer, name, image_url, image_rights_status")
    .order("issuer")
    .order("name");
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  const kinds = rows.map((r) =>
    r.image_rights_status === "generated"
      ? "generated"
      : r.image_url
        ? r.image_rights_status === "unknown"
          ? "issuer art"
          : r.image_rights_status
        : "none",
  );
  const count = (k: string) => kinds.filter((x) => x === k).length;
  const rowsN = Math.ceil(rows.length / columns);
  const width = columns * CELL_W;
  const height = HEADER_H + rowsN * CELL_H;

  const header = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEADER_H}">
<text x="14" y="30" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" font-weight="700" fill="#1d201f">NorthTap card art — ${rows.length} cards</text>
<text x="14" y="52" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" fill="#4b504d">${count("issuer art")} issuer art (rights unknown, dev only) · ${count("generated")} generated · ${count("none")} none · ${new Date().toISOString().slice(0, 10)}</text>
</svg>`,
  );

  const layers: OverlayOptions[] = [{ input: header, left: 0, top: 0 }];
  for (const [i, row] of rows.entries()) {
    const left = (i % columns) * CELL_W;
    const top = HEADER_H + Math.floor(i / columns) * CELL_H;
    layers.push({ input: await thumb(row.image_url), left: left + 12, top: top + 10 });
    layers.push({ input: label(row, kinds[i]!), left, top: top + THUMB_H + 16 });
  }

  const jpeg = await sharp({
    create: { width, height, channels: 3, background: "#f4f4f2" },
  })
    .composite(layers)
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeFile(out, jpeg);
  console.log(`${out}: ${rows.length} cards, ${jpeg.length} bytes`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
