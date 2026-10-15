import type { SupabaseClient } from "@supabase/supabase-js";

export const ADMIN_ROLES = ["viewer", "validator", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  viewer: "Viewer",
  validator: "Validator",
  admin: "Admin",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** Mirrors public.is_admin(min_role): viewer < validator < admin. */
export function hasRole(role: AdminRole, minRole: AdminRole): boolean {
  return ADMIN_ROLES.indexOf(role) >= ADMIN_ROLES.indexOf(minRole);
}

/**
 * The signed-in user's console role from the database allow-list, or null
 * when they are not an active admin user. Any error counts as "no role".
 */
export async function fetchAdminRole(supabase: SupabaseClient): Promise<AdminRole | null> {
  const { data, error } = await supabase.rpc("current_admin_role");
  if (error) return null;
  return isAdminRole(data) ? data : null;
}
