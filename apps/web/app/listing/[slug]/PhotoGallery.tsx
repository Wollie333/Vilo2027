import { ImageIcon } from "lucide-react";

export type GalleryPhoto = { id: string; url: string };

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-card border border-dashed border-brand-line bg-brand-accent/40 text-brand-mute">
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="h-8 w-8" />
          <span className="text-sm font-medium">No photos yet</span>
        </div>
      </div>
    );
  }

  const [hero, ...rest] = photos;
  const grid = rest.slice(0, 4);

  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:grid-rows-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card sm:row-span-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.url}
          alt="Listing"
          className="h-full w-full object-cover"
        />
      </div>
      {grid.map((p) => (
        <div
          key={p.id}
          className="relative aspect-[4/3] overflow-hidden rounded-card"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt="Listing"
            className="h-full w-full object-cover"
          />
        </div>
      ))}
      {photos.length > 5 ? (
        <div className="pointer-events-none absolute hidden">
          {/* placeholder for "show all photos" lightbox slice */}
        </div>
      ) : null}
    </div>
  );
}
