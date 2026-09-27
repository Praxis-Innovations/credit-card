import { createHash } from "node:crypto";
import { userInfo } from "node:os";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { SERVABLE_ASSET_RIGHTS, type AssetRightsStatus } from "@/domain";

export const ASSET_BUCKET = "brand-assets";
/** Mirrors storage.buckets.file_size_limit in the catalog_assets migration. */
export const MAX_ASSET_BYTES = 1024 * 1024;

export const ASSET_KINDS = {
  card: { table: "cards", prefix: "image", folder: "cards" },
  "merchant-brand": {
    table: "merchant_brands",
    prefix: "logo",
    folder: "merchant-brands",
  },
  "loyalty-program": {
    table: "loyalty_programs",
    prefix: "logo",
    folder: "loyalty-programs",
  },
} as const;

export type AssetKind = keyof typeof ASSET_KINDS;

/** Must stay within storage.buckets.allowed_mime_types (no SVG). */
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const UPLOAD_USAGE = `Usage:
  pnpm --filter api assets:upload <kind> <id> <file> \\
    --alt "<alt text>" --source-url <url> --rights licensed|issuer_provided \\
    [--by github:<login>] [--dry-run]

  pnpm --filter api assets:clear <kind> <id> [--by github:<login>] [--dry-run]

kind: ${Object.keys(ASSET_KINDS).join(" | ")}
file: .png, .jpg/.jpeg or .webp, at most ${MAX_ASSET_BYTES / 1024} KiB

Only upload images you have the right to display — see docs/data/ASSETS.md.`;

export class UsageError extends Error {}

export interface UploadOptions {
  kind: AssetKind;
  id: string;
  file: string;
  alt: string;
  sourceUrl: string;
  rights: AssetRightsStatus;
  by: string;
  dryRun: boolean;
}

export interface ClearOptions {
  kind: AssetKind;
  id: string;
  by: string;
  dryRun: boolean;
}

function parseKind(value: string | undefined): AssetKind {
  if (value && value in ASSET_KINDS) return value as AssetKind;
  throw new UsageError(
    `kind must be one of: ${Object.keys(ASSET_KINDS).join(", ")}`,
  );
}

function parseId(value: string | undefined): string {
  if (value && SLUG.test(value)) return value;
  throw new UsageError("id must be a catalog slug (e.g. amex-cobalt)");
}

function defaultBy(): string {
  return `local:${userInfo().username}`;
}

export function parseUploadArgs(argv: string[]): UploadOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      alt: { type: "string" },
      "source-url": { type: "string" },
      rights: { type: "string" },
      by: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const [kind, id, file, ...extra] = positionals;
  if (extra.length > 0 || !file) {
    throw new UsageError("expected exactly: <kind> <id> <file>");
  }

  const alt = values.alt?.trim();
  if (!alt) throw new UsageError("--alt is required (accessible description)");

  const sourceUrl = values["source-url"]?.trim() ?? "";
  if (!/^https?:\/\//i.test(sourceUrl) || !URL.canParse(sourceUrl)) {
    throw new UsageError(
      "--source-url must be the http(s) URL documenting where the asset / permission came from",
    );
  }

  const rights = values.rights as AssetRightsStatus | undefined;
  if (!rights || !SERVABLE_ASSET_RIGHTS.includes(rights)) {
    throw new UsageError(
      `--rights must be one of: ${SERVABLE_ASSET_RIGHTS.join(", ")}`,
    );
  }

  contentTypeFor(file);

  return {
    kind: parseKind(kind),
    id: parseId(id),
    file,
    alt,
    sourceUrl,
    rights,
    by: values.by?.trim() || defaultBy(),
    dryRun: values["dry-run"] ?? false,
  };
}

export function parseClearArgs(argv: string[]): ClearOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      by: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const [kind, id, ...extra] = positionals;
  if (extra.length > 0 || !id) {
    throw new UsageError("expected exactly: <kind> <id>");
  }
  return {
    kind: parseKind(kind),
    id: parseId(id),
    by: values.by?.trim() || defaultBy(),
    dryRun: values["dry-run"] ?? false,
  };
}

export function contentTypeFor(file: string): string {
  const type = CONTENT_TYPES[extname(file).toLowerCase()];
  if (!type) {
    throw new UsageError(
      `unsupported file type "${extname(file)}" — use ${Object.keys(CONTENT_TYPES).join(", ")}`,
    );
  }
  return type;
}

/** Content type from magic bytes, so a renamed file can't slip past the extension check. */
export function sniffContentType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === "RIFF" &&
    String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateAssetBytes(file: string, bytes: Uint8Array): string {
  const declared = contentTypeFor(file);
  if (bytes.length === 0) throw new UsageError("file is empty");
  if (bytes.length > MAX_ASSET_BYTES) {
    throw new UsageError(
      `file is ${bytes.length} bytes; limit is ${MAX_ASSET_BYTES}`,
    );
  }
  const sniffed = sniffContentType(bytes);
  if (sniffed !== declared) {
    throw new UsageError(
      `file contents (${sniffed ?? "unrecognised"}) do not match extension (${declared})`,
    );
  }
  return declared;
}

/**
 * Content-addressed object path. Public URLs are CDN-cached, so a new image
 * must get a new path rather than overwrite the old one.
 */
export function objectPathFor(
  kind: AssetKind,
  id: string,
  file: string,
  bytes: Uint8Array,
): string {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const raw = extname(file).toLowerCase();
  const ext = raw === ".jpeg" ? ".jpg" : raw;
  return `${ASSET_KINDS[kind].folder}/${id}-${hash}${ext}`;
}

/** Row update (snake_case columns) after a successful upload. */
export function buildUploadPatch(
  opts: Pick<UploadOptions, "kind" | "alt" | "sourceUrl" | "rights" | "by">,
  publicUrl: string,
  now: Date,
): Record<string, string> {
  const p = ASSET_KINDS[opts.kind].prefix;
  return {
    [`${p}_url`]: publicUrl,
    [`${p}_alt`]: opts.alt,
    [`${p}_source_url`]: opts.sourceUrl,
    [`${p}_rights_status`]: opts.rights,
    [`${p}_updated_at`]: now.toISOString(),
    [`${p}_updated_by`]: opts.by,
  };
}

/** Row update that reverts an asset to the placeholder state. */
export function buildClearPatch(
  opts: Pick<ClearOptions, "kind" | "by">,
  now: Date,
): Record<string, string | null> {
  const p = ASSET_KINDS[opts.kind].prefix;
  return {
    [`${p}_url`]: null,
    [`${p}_alt`]: null,
    [`${p}_source_url`]: null,
    [`${p}_rights_status`]: "placeholder",
    [`${p}_updated_at`]: now.toISOString(),
    [`${p}_updated_by`]: opts.by,
  };
}

/** Object path inside the bucket for one of our public URLs, else null. */
export function storagePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${ASSET_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]!);
  return path || null;
}
