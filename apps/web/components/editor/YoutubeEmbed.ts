// Self-contained YouTube embed node for the shared RichTextEditor.
//
// We deliberately do NOT depend on `@tiptap/extension-youtube` (not installed;
// pnpm won't resolve `@tiptap/core` directly either) — `@tiptap/react`
// re-exports the core Node API, so this stays dependency-free.
//
// It renders a privacy-friendly youtube-nocookie iframe wrapped in a
// `.help-video` box (16:9). The wrapper class is styled by the editor (builder)
// and by `help-article.css` on the live page. The render-side sanitiser
// (`lib/help/sanitize.ts`) allow-lists YouTube/Vimeo iframe hosts so the same
// HTML survives to the published article.
import { Node, mergeAttributes } from "@tiptap/react";

export type YoutubeEmbedOptions = {
  HTMLAttributes: Record<string, unknown>;
};

/** Extract a YouTube/Vimeo embed URL from any common share/watch/embed URL. */
export function toEmbedUrl(input: string): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  const yt = value.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i,
  );
  if (yt?.[1]) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
  if (vimeo?.[1]) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export const YoutubeEmbed = Node.create<YoutubeEmbedOptions>({
  name: "youtubeEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [
      { tag: "div[data-youtube-video] iframe" },
      { tag: 'iframe[src*="youtube-nocookie.com/embed"]' },
      { tag: 'iframe[src*="youtube.com/embed"]' },
      { tag: 'iframe[src*="player.vimeo.com"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = (HTMLAttributes.src as string) ?? "";
    return [
      "div",
      { class: "help-video", "data-youtube-video": "" },
      [
        "iframe",
        mergeAttributes(this.options.HTMLAttributes, {
          src,
          frameborder: "0",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          allowfullscreen: "true",
          loading: "lazy",
        }),
      ],
    ];
  },
});
