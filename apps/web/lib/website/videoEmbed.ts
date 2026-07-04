// YouTube / Vimeo link → embed URL. Shared by the free-form video block and the
// block/section BACKGROUND video (autoplay, muted, looping, no chrome).

function parse(url: string): { kind: "youtube" | "vimeo"; id: string } | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (yt) return { kind: "youtube", id: yt[1] };
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "vimeo", id: vimeo[1] };
  return null;
}

/** Standard embeddable URL for a YouTube/Vimeo share link (or null). */
export function toEmbed(url: string): string | null {
  const p = parse(url);
  if (p)
    return p.kind === "youtube"
      ? `https://www.youtube.com/embed/${p.id}`
      : `https://player.vimeo.com/video/${p.id}`;
  // Already an embed URL — pass through.
  if (/(?:youtube\.com\/embed|player\.vimeo\.com)/.test((url ?? "").trim()))
    return (url ?? "").trim();
  return null;
}

/**
 * Background-video embed URL: autoplay + muted + looping + no controls/branding,
 * for a silent cover video behind a section. Null when the URL isn't YouTube/Vimeo.
 */
export function toBackgroundEmbed(url: string): string | null {
  const p = parse(url);
  if (!p) return null;
  if (p.kind === "youtube")
    return (
      `https://www.youtube.com/embed/${p.id}` +
      `?autoplay=1&mute=1&loop=1&playlist=${p.id}&controls=0` +
      `&modestbranding=1&playsinline=1&rel=0&showinfo=0&disablekb=1&iv_load_policy=3`
    );
  return `https://player.vimeo.com/video/${p.id}?background=1&autoplay=1&muted=1&loop=1`;
}
