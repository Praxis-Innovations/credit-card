import type { Metadata } from "next";
import { ImportConsole } from "@/components/review/import-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Import research CSV" };

export default async function ImportResearchPage() {
  const { role } = await requireConsoleSession();
  return <ImportConsole canImport={hasRole(role, "admin")} />;
}
