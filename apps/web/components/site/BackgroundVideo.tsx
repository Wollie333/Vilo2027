import { toBackgroundEmbed } from "@/lib/website/videoEmbed";

/**
 * A silent, looping YouTube/Vimeo video that COVERS its positioned parent (the
 * parent must be `position:relative; overflow:hidden`). Purely decorative — inert
 * to pointer + keyboard so it never steals interaction from the content above it.
 * The cover uses the standard viewport-ratio sizing (works best on tall/hero bands).
 */
export function BackgroundVideo({ url }: { url: string }) {
  const src = toBackgroundEmbed(url);
  if (!src) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <iframe
        src={src}
        title=""
        tabIndex={-1}
        allow="autoplay; encrypted-media; picture-in-picture"
        frameBorder={0}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "max(100%, 177.78vh)",
          height: "max(100%, 56.25vw)",
          border: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
