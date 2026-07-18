/**
 * Sanitise a host-supplied CSS VALUE before it is interpolated into a `<style>`
 * body that gets rendered via `dangerouslySetInnerHTML` (the website builder's
 * PageDocRenderer + BookingStyleOverlay emit `--el-*` / frame declarations this
 * way).
 *
 * Without this, a value like `bg: "x}</style><script>alert(1)</script>"` closes
 * the `<style>` element in the SSR'd HTML and injects an executing script on the
 * host's public site for every guest — a stored host→guest XSS.
 *
 * Strips the characters that can terminate a declaration/rule or break out of
 * the `<style>` element — `< > { } ; \ " '` — while preserving legitimate values
 * (hex/rgb/hsl colours, `rgba()`, gradients, `url()` targets). Length-capped as
 * a backstop. Apply at the point of interpolation, not at save time, so stored
 * values that bypass the save action (theme seeding, restore points) are also
 * defended.
 */
export function sanitizeCssValue(value: string, maxLen = 400): string {
  return value.replace(/[<>{};\\"']/g, "").slice(0, maxLen);
}
