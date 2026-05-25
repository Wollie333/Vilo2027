export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(base: string, existing: Set<string>): string {
  const seed = slugify(base) || "untitled";
  if (!existing.has(seed)) return seed;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${seed}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${seed}-${Date.now()}`;
}
