/**
 * Sanitise a free-text search term before it is interpolated into a PostgREST
 * `.or(...)` / `.filter(...)` filter STRING.
 *
 * Why this exists: supabase-js sends `.or("col.ilike.%value%")` as one string.
 * PostgREST URL-decodes it and THEN parses the `column.operator.value` grammar,
 * so a raw `,` `(` `)` in `value` is read as filter structure — a user could
 * inject extra OR-conditions (filter manipulation / error disclosure / DoS).
 * `.eq(col, val)` and the two-argument `.ilike(col, pattern)` forms send the
 * value as a separate parameterised component and do NOT need this.
 *
 * Strips the PostgREST filter metacharacters `,` `(` `)` `*`, the LIKE
 * wildcards `%` `_`, and the backslash escape; collapses whitespace; and caps
 * length so a giant term can't blow up the query. This is the ONE source of
 * truth — every `.or()` search site must run its user term through it.
 */
export function sanitizeSearch(term: string, maxLen = 80): string {
  return term
    .replace(/[,()*%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}
