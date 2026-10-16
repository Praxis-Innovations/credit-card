/**
 * PostgREST / Supabase caps each response at max_rows (1000 in config.toml).
 * Page with .range() until a short page comes back so catalogs over that cap load fully.
 */
export const SUPABASE_PAGE_SIZE = 1000;

export type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Call `fetchPage(from, to)` with inclusive range indexes until fewer than
 * `pageSize` rows return (or an error). Order must be stable in the caller.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: [], error };
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return { data: all, error: null };
    from += pageSize;
  }
}
