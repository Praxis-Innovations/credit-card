import { test as base, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiKey, E2E_USERS, urls } from "./env";
import { createAnonClient, createServiceClient, signInAs } from "./helpers/supabase";

type WorkerFixtures = {
  urls: typeof urls;
  apiKey: string;
  users: typeof E2E_USERS;
  supabaseAnon: SupabaseClient;
  supabaseService: SupabaseClient;
  signInAs: typeof signInAs;
};

/**
 * Shared Playwright fixtures for every project. Import `test` / `expect`
 * from here (not `@playwright/test`) so helpers stay consistent.
 */
export const test = base.extend<WorkerFixtures>({
  urls: async ({}, use) => {
    await use(urls);
  },
  apiKey: async ({}, use) => {
    await use(apiKey());
  },
  users: async ({}, use) => {
    await use(E2E_USERS);
  },
  supabaseAnon: async ({}, use) => {
    await use(createAnonClient());
  },
  supabaseService: async ({}, use) => {
    await use(createServiceClient());
  },
  signInAs: async ({}, use) => {
    await use(signInAs);
  },
});

export { expect };
