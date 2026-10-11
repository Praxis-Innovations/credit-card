/**
 * Admin CLI for catalog images (card art, brand / program logos).
 *
 *   pnpm --filter api assets:upload <kind> <id> <file> --alt … --source-url … --rights …
 *   pnpm --filter api assets:clear  <kind> <id>
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Rights policy: docs/data/ASSETS.md.
 */
import { readFile } from "node:fs/promises";
import { createServiceClient } from "../data-pipeline/supabase";
import {
  ASSET_BUCKET,
  ASSET_KINDS,
  UPLOAD_USAGE,
  UsageError,
  buildClearPatch,
  buildUploadPatch,
  objectPathFor,
  parseClearArgs,
  parseUploadArgs,
  storagePathFromPublicUrl,
  validateAssetBytes,
  type AssetKind,
} from "./assets";
import { readAssetRow, removeObject, replaceAsset } from "./storage";

type Client = ReturnType<typeof createServiceClient>;

async function currentUrl(
  client: Client,
  kind: AssetKind,
  id: string,
): Promise<string | null> {
  const column = `${ASSET_KINDS[kind].prefix}_url`;
  const row = await readAssetRow(client, kind, id, [column]);
  return (row[column] as string | null) ?? null;
}

async function upload(argv: string[]): Promise<void> {
  const opts = parseUploadArgs(argv);
  const bytes = new Uint8Array(await readFile(opts.file));
  const contentType = validateAssetBytes(opts.file, bytes);
  const path = objectPathFor(opts.kind, opts.id, opts.file, bytes);
  const { table } = ASSET_KINDS[opts.kind];

  if (opts.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          upload: { bucket: ASSET_BUCKET, path, contentType, bytes: bytes.length },
          update: {
            table,
            id: opts.id,
            patch: buildUploadPatch(opts, `<public url of ${path}>`, new Date()),
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const client = createServiceClient();
  const previousPath = storagePathFromPublicUrl(
    await currentUrl(client, opts.kind, opts.id),
  );

  const publicUrl = await replaceAsset(client, {
    kind: opts.kind,
    id: opts.id,
    path,
    bytes,
    contentType,
    previousPath,
    patch: (url) => buildUploadPatch(opts, url, new Date()),
  });
  console.log(`${table}/${opts.id} → ${publicUrl}`);
}

async function clear(argv: string[]): Promise<void> {
  const opts = parseClearArgs(argv);
  const { table } = ASSET_KINDS[opts.kind];
  const patch = buildClearPatch(opts, new Date());

  if (opts.dryRun) {
    console.log(
      JSON.stringify({ dryRun: true, update: { table, id: opts.id, patch } }, null, 2),
    );
    return;
  }

  const client = createServiceClient();
  const previousPath = storagePathFromPublicUrl(
    await currentUrl(client, opts.kind, opts.id),
  );
  const { error } = await client.from(table).update(patch).eq("id", opts.id);
  if (error) throw error;
  await removeObject(client, previousPath);
  console.log(`${table}/${opts.id} → placeholder`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "upload") return upload(rest);
  if (command === "clear") return clear(rest);
  throw new UsageError(`unknown command "${command ?? ""}"`);
}

main().catch((err: unknown) => {
  if (err instanceof UsageError || (err as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")) {
    console.error(`error: ${(err as Error).message}\n\n${UPLOAD_USAGE}`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
