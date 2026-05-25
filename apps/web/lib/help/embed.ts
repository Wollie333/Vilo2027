import type { HelpVideoProvider } from "./types";

export type ParsedEmbed = {
  provider: HelpVideoProvider;
  id: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
};

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/i,
];
const VIMEO_PATTERNS = [/vimeo\.com\/(?:video\/)?(\d{6,})/i];

export function parseVideoEmbed(input: string): ParsedEmbed | null {
  const value = (input ?? "").trim();
  if (!value) return null;

  for (const re of YT_PATTERNS) {
    const m = value.match(re);
    if (m?.[1]) {
      const id = m[1];
      return {
        provider: "youtube",
        id,
        url: value,
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  for (const re of VIMEO_PATTERNS) {
    const m = value.match(re);
    if (m?.[1]) {
      const id = m[1];
      return {
        provider: "vimeo",
        id,
        url: value,
        embedUrl: `https://player.vimeo.com/video/${id}?byline=0&portrait=0`,
        thumbnailUrl: "",
      };
    }
  }

  return null;
}

export function buildEmbedUrl(
  provider: HelpVideoProvider,
  embedId: string,
): string {
  if (provider === "vimeo") {
    return `https://player.vimeo.com/video/${embedId}?byline=0&portrait=0`;
  }
  return `https://www.youtube.com/embed/${embedId}?rel=0&modestbranding=1`;
}

export function buildThumbnailUrl(
  provider: HelpVideoProvider,
  embedId: string,
): string {
  if (provider === "vimeo") return "";
  return `https://i.ytimg.com/vi/${embedId}/hqdefault.jpg`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
