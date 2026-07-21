/** "Best match" is the default sort now that the ranking is computed and
 *  sortable. It lives in its own module so client components (the filter sheet,
 *  the search bar) can import it without pulling the server-side search loader
 *  — and its admin Supabase client — into the browser bundle. */
export const DEFAULT_SORT = "recommended";
