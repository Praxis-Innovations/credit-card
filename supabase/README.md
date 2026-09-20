# NorthTap Supabase backend

Local Postgres + Auth + RLS for the NorthTap MVP. This directory stands alone (SQL migrations + config only) so it merges cleanly with the JS/TS monorepo workspace.

**MVP scope:** accounts + which credit cards a user owns (`user_cards`), so the Expo "My Cards" list syncs across devices. No spend tracking, bank linking, or welcome-bonus tracking yet.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (required by the local stack)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`, or `npx supabase`)

## Local development

From the repo root:

```bash
# Start local Supabase (Postgres, Auth, Studio, PostgREST, etc.)
npx supabase start

# Apply migrations after editing SQL (or after a fresh start)
npx supabase db reset
# — or, against an already-running local DB without wiping data:
npx supabase migration up
```

`supabase start` prints local API URL, `anon` key, and Studio URL. Use those in app env vars (never commit real project keys).

Stop the stack:

```bash
npx supabase stop
```

## Linking a remote project (later)

When a hosted Supabase project exists:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

No live credentials are required for this repo today — migrations are the source of truth.

## Schema overview

| Table | Purpose |
| --- | --- |
| `profiles` | One public row per `auth.users` user (`id`, `created_at`, `display_name`). Created by trigger on signup. |
| `user_cards` | Owned cards: `user_id`, `card_id` (text slug e.g. `amex-cobalt`), `added_at`. Unique on `(user_id, card_id)`. |

RLS is enabled on both tables: authenticated users may only select/insert/update/delete their own rows (`auth.uid()`).

Card catalog data lives in the frontend `packages/core` dataset — there is no `cards` table and no FK on `card_id`.

Optional snapshot for humans: [`schema.sql`](./schema.sql).

## Client integration (Expo / Next.js)

Apps talk to Supabase directly via `@supabase/supabase-js` (Auth + PostgREST). No custom backend server for this MVP.

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,      // or NEXT_PUBLIC_…
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
)
```

**Auth:** `supabase.auth.signUp` / `signInWithPassword` (email/password now; OAuth later). A `profiles` row is inserted automatically on signup.

**My Cards sync (authenticated session required):**

```ts
// List
const { data } = await supabase
  .from('user_cards')
  .select('id, card_id, added_at')
  .order('added_at', { ascending: true })

// Add
await supabase.from('user_cards').insert({ user_id: user.id, card_id: 'amex-cobalt' })

// Remove
await supabase.from('user_cards').delete().eq('card_id', 'amex-cobalt')
```

RLS scopes every query to the signed-in user; always use the anon key in the client, never the service role.

The web marketing tool stays intentionally stateless (no login). Persist "My Cards" only in the authenticated mobile (and any future logged-in) clients.
