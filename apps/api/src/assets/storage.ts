import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSET_BUCKET, ASSET_KINDS, UsageError, type AssetKind } from "./assets";

/** Current values of `columns` on one catalog row; throws if the row is missing. */
export async function readAssetRow(
  client: SupabaseClient,
  kind: AssetKind,
  id: string,
  columns: string[],
): Promise<Record<string, unknown>> {
  const { table } = ASSET_KINDS[kind];
  const { data, error } = await client
    .from(table)
    .select(["id", ...columns].join(", "))
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new UsageError(`${table}/${id} does not exist`);
  return data as unknown as Record<string, unknown>;
}

export function publicUrlFor(client: SupabaseClient, path: string): string {
  return client.storage.from(ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Upload to the brand-assets bucket (content-hashed paths, so a year of CDN cache is safe). */
export async function uploadObject(
  client: SupabaseClient,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await client.storage.from(ASSET_BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw error;
  return publicUrlFor(client, path);
}

export async function removeObject(
  client: SupabaseClient,
  path: string | null,
): Promise<void> {
  if (!path) return;
  const { error } = await client.storage.from(ASSET_BUCKET).remove([path]);
  if (error) console.warn(`warning: could not remove ${path}: ${error.message}`);
}

/**
 * Upload `bytes` to `path`, apply `patch` (built from the resulting public URL)
 * to the row, then delete `previousPath` if it was replaced. If the row update
 * fails, the new object is removed again.
 */
export async function replaceAsset(
  client: SupabaseClient,
  input: {
    kind: AssetKind;
    id: string;
    path: string;
    bytes: Uint8Array;
    contentType: string;
    previousPath: string | null;
    patch: (publicUrl: string) => Record<string, unknown>;
  },
): Promise<string> {
  const { table } = ASSET_KINDS[input.kind];
  const publicUrl = await uploadObject(
    client,
    input.path,
    input.bytes,
    input.contentType,
  );
  const { error } = await client
    .from(table)
    .update(input.patch(publicUrl))
    .eq("id", input.id);
  if (error) {
    if (input.path !== input.previousPath) await removeObject(client, input.path);
    throw error;
  }
  if (input.previousPath !== input.path) {
    await removeObject(client, input.previousPath);
  }
  return publicUrl;
}
