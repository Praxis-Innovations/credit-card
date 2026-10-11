/**
 * Grid image of every card's generated illustration, for review. Rendered
 * locally from the catalog with the same code as assets:generate-card-art, so
 * it needs no Supabase access. Each label shows the content-hashed object path
 * the generator uses, to compare with what is stored.
 *
 *   pnpm --filter api assets:contact-sheet <out.jpg> [--columns 8]
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import sharp, { type OverlayOptions } from "sharp";
import { CARDS } from "@/domain";
import { escapeXml, rasterizeSvg, renderIllustrationSvg } from "./card-art/illustration";
import { illustrationPath } from "./generate-card-art";

const THUMB_W = 256;
const THUMB_H = 161;
const CELL_W = 280;
const CELL_H = 226;
const HEADER_H = 64;
const FONT = "Helvetica Neue, Arial, sans-serif";

function label(id: string, name: string, path: string): Buffer {
  const short = name.length > 40 ? `${name.slice(0, 39)}…` : name;
  const file = path.split("/").pop()!;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="48">
<text x="12" y="17" font-family="${FONT}" font-size="13" font-weight="700" fill="#1d201f">${escapeXml(id)}</text>
<text x="12" y="33" font-family="${FONT}" font-size="11" fill="#4b504d">${escapeXml(short)}</text>
<text x="12" y="47" font-family="${FONT}" font-size="10" fill="#7a7f7c">${escapeXml(file)}</text>
</svg>`,
  );
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

  const cards = [...CARDS].sort((a, b) => a.issuer.localeCompare(b.issuer) || a.name.localeCompare(b.name));
  const width = columns * CELL_W;
  const height = HEADER_H + Math.ceil(cards.length / columns) * CELL_H;
  const header = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEADER_H}">
<text x="14" y="30" font-family="${FONT}" font-size="22" font-weight="700" fill="#1d201f">NorthTap generated card illustrations — ${cards.length} cards</text>
<text x="14" y="52" font-family="${FONT}" font-size="14" fill="#4b504d">rights 'generated' · no issuer art · labels show the stored object name (brand-assets/cards/generated/)</text>
</svg>`,
  );

  const layers: OverlayOptions[] = [{ input: header, left: 0, top: 0 }];
  const paths: string[] = [];
  for (const [i, card] of cards.entries()) {
    const png = await rasterizeSvg(renderIllustrationSvg(card));
    const path = illustrationPath({ ...card, image_url: null, image_alt: null, image_source_url: null, image_rights_status: "placeholder" }, png);
    paths.push(path);
    const left = (i % columns) * CELL_W;
    const top = HEADER_H + Math.floor(i / columns) * CELL_H;
    const thumb = await sharp(png)
      .resize(THUMB_W, THUMB_H, { fit: "contain", background: "#f4f4f2" })
      .flatten({ background: "#f4f4f2" })
      .png()
      .toBuffer();
    layers.push({ input: thumb, left: left + 12, top: top + 10 });
    layers.push({ input: label(card.id, `${card.issuer} ${card.name}`, path), left, top: top + THUMB_H + 16 });
  }

  const jpeg = await sharp({ create: { width, height, channels: 3, background: "#f4f4f2" } })
    .composite(layers)
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeFile(out, jpeg);
  await writeFile(`${out}.paths.txt`, `${paths.sort().join("\n")}\n`);
  console.log(`${out}: ${cards.length} cards, ${jpeg.length} bytes (object paths in ${out}.paths.txt)`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
