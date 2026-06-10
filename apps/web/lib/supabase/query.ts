import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Await a Supabase query and throw if it errored, instead of the codebase's
 * usual `const { data } = await query` which silently swallows the error and
 * renders an empty/zero state — hiding real bugs (e.g. a schema change making
 * an embed ambiguous looks identical to "no rows").
 *
 * On error it logs to the server (so failures show up in Vercel logs / alerts
 * even when nobody is watching the page) and throws, letting the nearest
 * `error.tsx` boundary show a loud failure. Use for the queries whose empty
 * result would be misleading — lists, counts, money figures.
 *
 *   const bookings = await throwOnError(
 *     supabase.from("bookings").select("*").eq("host_id", host.id),
 *     "dashboard/bookings",
 *   );
 */
export async function throwOnError<T>(
  query: PromiseLike<{ data: T; error: PostgrestError | null }>,
  context: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    logQueryError(context, error);
    throw new Error(`Query failed (${context}): ${error.message}`);
  }
  return data;
}

/**
 * Like {@link throwOnError} but preserves the row count for paginated lists
 * (queries built with `{ count: "exact" }`). Returns `{ data, count }`.
 */
export async function throwOnErrorWithCount<T>(
  query: PromiseLike<{
    data: T;
    count: number | null;
    error: PostgrestError | null;
  }>,
  context: string,
): Promise<{ data: T; count: number | null }> {
  const { data, count, error } = await query;
  if (error) {
    logQueryError(context, error);
    throw new Error(`Query failed (${context}): ${error.message}`);
  }
  return { data, count };
}

function logQueryError(context: string, error: PostgrestError): void {
  console.error(
    `[query:${context}] ${error.code ?? "ERROR"}: ${error.message}`,
    error.details ? { details: error.details, hint: error.hint } : "",
  );
}
