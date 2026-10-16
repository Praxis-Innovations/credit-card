import type { Metadata } from "next";
import { StoreCodesConsole } from "@/components/store-codes/store-codes-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { loadStoreCodeList } from "@/lib/store-codes/load";

export const metadata: Metadata = { title: "Store codes" };

export default async function StoreCodesPage() {
  const { supabase } = await requireConsoleSession();
  const { items, error } = await loadStoreCodeList(supabase);

  return <StoreCodesConsole items={items} loadError={error} />;
}
