import sharp from "sharp";
import { MAX_ASSET_BYTES } from "../assets";
import { CARD_ASPECT, checkCardShape } from "./select";

/** Stored card art width; 2× the largest size the app draws a card at. */
export const OUTPUT_WIDTH = 640;

export type NormalizeResult =
  | {
      ok: true;
      bytes: Uint8Array;
      width: number;
      height: number;
      /**
       * Transparent corners (rounded card on alpha) or a uniform margin that was
       * trimmed away — typical of product art, rare in photos.
       */
      cardEdges: boolean;
      source: { width: number; height: number; trimmed: boolean; rotated: boolean };
    }
  | { ok: false; reason: string };

/**
 * Crop away empty margins. With an alpha channel the crop is the box of
 * mostly-opaque pixels, which drops soft drop shadows; otherwise it's sharp's
 * trim of a uniform border.
 */
async function cropMargins(
  input: Uint8Array,
): Promise<{ data: Buffer; info: { width: number; height: number } }> {
  const meta = await sharp(input).metadata();
  if (meta.hasAlpha) {
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    let top = height, left = width, bottom = -1, right = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * channels + channels - 1]! >= 200) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    if (bottom >= 0) {
      return sharp(input)
        .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
        .toBuffer({ resolveWithObject: true });
    }
  }
  return sharp(input).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
}

/** True when all four corner pixels (2 px in) are transparent. */
async function transparentCorners(input: Uint8Array): Promise<boolean> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const inset = 2;
  const alphaAt = (x: number, y: number) => data[(y * width + x) * channels + channels - 1]!;
  return [
    [inset, inset],
    [width - 1 - inset, inset],
    [inset, height - 1 - inset],
    [width - 1 - inset, height - 1 - inset],
  ].every(([x, y]) => alphaAt(x!, y!) < 40);
}

/** Decoded and re-encoded to PNG, so the upload is always a plain PNG. SVG is refused. */
const RASTER_FORMATS = new Set(["png", "jpeg", "webp", "avif", "heif"]);

/**
 * Validate downloaded bytes as card art and re-encode them as a PNG at
 * OUTPUT_WIDTH. Transparent / flat margins are trimmed when that brings the
 * image closer to the card ratio. Rejects anything not card-shaped.
 */
export async function normalizeCardArt(input: Uint8Array): Promise<NormalizeResult> {
  let original: { width: number; height: number };
  try {
    const meta = await sharp(input).metadata();
    if (!RASTER_FORMATS.has(meta.format ?? "")) {
      return { ok: false, reason: `not a raster image (${meta.format ?? "unknown"})` };
    }
    original = { width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch {
    return { ok: false, reason: "not an image" };
  }

  let chosen = input;
  let dim = original;
  let trimmed = false;
  try {
    const { data, info } = await cropMargins(input);
    const distance = (d: { width: number; height: number }) =>
      Math.abs(landscape(d).width / landscape(d).height - CARD_ASPECT);
    if (
      (info.width !== original.width || info.height !== original.height) &&
      checkCardShape(landscape(info)).ok &&
      distance(info) <= distance(original)
    ) {
      chosen = new Uint8Array(data);
      dim = { width: info.width, height: info.height };
      trimmed = true;
    }
  } catch {
    // Nothing to trim (uniform image) — keep the original.
  }

  // Vertical card designs (Neo) are stored turned to landscape, like the rest.
  const rotated = dim.height > dim.width && checkCardShape(landscape(dim)).ok;
  if (rotated) dim = landscape(dim);

  const shape = checkCardShape(dim);
  if (!shape.ok) return { ok: false, reason: shape.reason };

  const out = await (rotated ? sharp(chosen).rotate(-90) : sharp(chosen))
    .resize({ width: OUTPUT_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer({ resolveWithObject: true });
  let bytes = new Uint8Array(out.data);
  if (bytes.length > MAX_ASSET_BYTES) {
    bytes = new Uint8Array(
      await sharp(out.data).png({ compressionLevel: 9, palette: true }).toBuffer(),
    );
  }
  if (bytes.length > MAX_ASSET_BYTES) {
    return { ok: false, reason: `still ${bytes.length} bytes after re-encoding` };
  }
  return {
    ok: true,
    bytes,
    width: out.info.width,
    height: out.info.height,
    cardEdges: trimmed || (await transparentCorners(chosen)),
    source: { ...original, trimmed, rotated },
  };
}

function landscape(d: { width: number; height: number }): { width: number; height: number } {
  return d.width >= d.height ? d : { width: d.height, height: d.width };
}

/** Rasterise a generated SVG to a PNG at OUTPUT_WIDTH (the bucket refuses SVG). */
export async function rasterizeSvg(svg: string): Promise<Uint8Array> {
  const data = await sharp(Buffer.from(svg), { density: 144 })
    .resize({ width: OUTPUT_WIDTH })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return new Uint8Array(data);
}
