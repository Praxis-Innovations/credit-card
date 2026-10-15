import { existsSync } from "node:fs";
import path from "node:path";
import { OUTPUT_ROOT } from "./output";

/** Loads apps/crawler/.env.local then .env; variables already in the environment win. */
export function loadEnv() {
  const root = path.resolve(OUTPUT_ROOT, "..");
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
