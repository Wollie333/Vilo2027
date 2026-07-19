// Cookie name for the directory's selected country. In its own client-safe
// module (no "server-only") so both the server resolver and the client selector
// can import it. An empty value means "All destinations" (no prioritisation).
export const DIRECTORY_COUNTRY_COOKIE = "vilo_directory_country";
