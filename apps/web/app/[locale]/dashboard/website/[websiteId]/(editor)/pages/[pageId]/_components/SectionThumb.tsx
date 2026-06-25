import { MapPin } from "lucide-react";

import type { SectionType } from "@/lib/website/sections.schema";

// Tiny schematic previews for the section library — pure CSS/divs (no assets),
// using brand tokens so they read as miniatures of each section's layout.

function Bar({ w = "w-full", muted = false }: { w?: string; muted?: boolean }) {
  return (
    <div
      className={`h-1.5 rounded-full ${w} ${muted ? "bg-brand-mute/60" : "bg-brand-line"}`}
    />
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[76px] w-full flex-col gap-1.5 overflow-hidden rounded-[8px] border border-brand-line bg-brand-light/50 p-2">
      {children}
    </div>
  );
}

function MiniStars() {
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-1.5 w-1.5 rounded-[1px] bg-brand-accent" />
      ))}
    </div>
  );
}

export function SectionThumb({ type }: { type: SectionType }) {
  switch (type) {
    case "hero":
      return (
        <Frame>
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded bg-brand-line/30">
            <Bar w="w-1/2" muted />
            <Bar w="w-1/3" />
            <div className="mt-0.5 h-2 w-8 rounded-full bg-brand-accent" />
          </div>
        </Frame>
      );
    case "intro":
    case "rich_text":
      return (
        <Frame>
          <div className="flex flex-1 flex-col items-center justify-center gap-1">
            <Bar w="w-1/3" muted />
            <Bar w="w-3/4" />
            <Bar w="w-2/3" />
          </div>
        </Frame>
      );
    case "highlights":
    case "values":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1 rounded bg-white p-1">
                <div className="h-2.5 w-2.5 rounded-full bg-brand-accent" />
                <Bar />
                <Bar w="w-2/3" />
              </div>
            ))}
          </div>
        </Frame>
      );
    case "stats":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-3 items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-3 w-6 rounded bg-brand-accent" />
                <Bar w="w-2/3" muted />
              </div>
            ))}
          </div>
        </Frame>
      );
    case "gallery":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded bg-brand-line/70" />
            ))}
          </div>
        </Frame>
      );
    case "logos":
      return (
        <Frame>
          <div className="flex flex-1 items-center justify-center gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-2.5 w-7 rounded bg-brand-line" />
            ))}
          </div>
        </Frame>
      );
    case "rooms_preview":
    case "specials_preview":
    case "blog_preview":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded bg-white"
              >
                <div className="h-5 w-full bg-brand-line/70" />
                <div className="flex flex-col gap-1 p-1">
                  <Bar />
                  <Bar w="w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </Frame>
      );
    case "location":
      return (
        <Frame>
          <div className="flex flex-1 gap-1.5">
            <div className="flex flex-1 items-center justify-center rounded bg-brand-line/50">
              <MapPin className="h-4 w-4 text-brand-mute" />
            </div>
            <div className="flex w-1/3 flex-col justify-center gap-1">
              <Bar />
              <Bar w="w-2/3" />
              <Bar w="w-1/2" />
            </div>
          </div>
        </Frame>
      );
    case "map":
      return (
        <Frame>
          <div className="flex flex-1 items-center justify-center rounded bg-brand-line/50">
            <MapPin className="h-5 w-5 text-brand-mute" />
          </div>
        </Frame>
      );
    case "reviews":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-2 gap-1.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-1 rounded bg-white p-1.5"
              >
                <MiniStars />
                <Bar />
                <Bar w="w-3/4" />
              </div>
            ))}
          </div>
        </Frame>
      );
    case "cta":
      return (
        <Frame>
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded bg-brand-accent/20">
            <Bar w="w-1/2" muted />
            <div className="mt-0.5 h-2.5 w-10 rounded-full bg-brand-accent" />
          </div>
        </Frame>
      );
    case "host_bio":
      return (
        <Frame>
          <div className="flex flex-1 items-center gap-2">
            <div className="h-8 w-8 shrink-0 rounded-full bg-brand-line" />
            <div className="flex flex-1 flex-col gap-1">
              <Bar w="w-1/2" muted />
              <Bar />
              <Bar w="w-2/3" />
            </div>
          </div>
        </Frame>
      );
    case "faq":
      return (
        <Frame>
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-white px-1.5 py-1"
              >
                <Bar w="w-1/2" />
                <span className="text-[10px] leading-none text-brand-accent">
                  +
                </span>
              </div>
            ))}
          </div>
        </Frame>
      );
    case "contact_form":
    case "form":
      return (
        <Frame>
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="h-3 rounded border border-brand-line bg-white" />
              <div className="h-3 rounded border border-brand-line bg-white" />
            </div>
            <div className="h-4 rounded border border-brand-line bg-white" />
            <div className="h-2.5 w-10 rounded-full bg-brand-accent" />
          </div>
        </Frame>
      );
    case "amenities":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded bg-white px-1.5"
              >
                <div className="h-2 w-2 shrink-0 rounded-full bg-brand-accent" />
                <Bar w="w-2/3" />
              </div>
            ))}
          </div>
        </Frame>
      );
    case "pricing":
      return (
        <Frame>
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-white px-1.5 py-1"
              >
                <Bar w="w-1/3" />
                <div className="h-2 w-5 rounded bg-brand-accent" />
              </div>
            ))}
          </div>
        </Frame>
      );
    case "video":
      return (
        <Frame>
          <div className="flex flex-1 items-center justify-center rounded bg-brand-line/50">
            <div className="h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-brand-accent" />
          </div>
        </Frame>
      );
    case "trust":
      return (
        <Frame>
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
            <MiniStars />
            <Bar w="w-1/4" muted />
            <div className="mt-0.5 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 rounded-full border border-brand-line bg-white px-1.5 py-0.5"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
                  <div className="h-1 w-4 rounded-full bg-brand-line" />
                </div>
              ))}
            </div>
          </div>
        </Frame>
      );
    case "booking_search":
      return (
        <Frame>
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-4 rounded border border-brand-line bg-white"
                />
              ))}
            </div>
            <div className="mx-auto h-3 w-16 rounded-full bg-brand-accent" />
          </div>
        </Frame>
      );
    case "availability_calendar":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-7 grid-rows-3 gap-[3px]">
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-[2px] ${
                  i === 4 || i === 9 || i === 15
                    ? "bg-brand-line/70"
                    : "bg-white"
                }`}
              />
            ))}
          </div>
        </Frame>
      );
    case "rate_table":
      return (
        <Frame>
          <div className="flex flex-1 flex-col justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-white px-1.5 py-1"
              >
                <Bar w="w-1/3" />
                <div className="flex items-center gap-1">
                  <div className="h-2 w-5 rounded bg-brand-line" />
                  <div className="h-2 w-4 rounded bg-brand-accent" />
                </div>
              </div>
            ))}
          </div>
        </Frame>
      );
    case "room_rates":
      return (
        <Frame>
          <div className="flex flex-1 flex-col justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-white px-1.5 py-1"
              >
                <Bar w="w-1/2" />
                <div className="h-2 w-6 rounded bg-brand-accent" />
              </div>
            ))}
          </div>
        </Frame>
      );
    case "seasonal_pricing":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-1 rounded bg-white py-1"
              >
                <Bar w="w-2/3" muted />
                <div className="h-2 w-4 rounded bg-brand-accent" />
              </div>
            ))}
          </div>
        </Frame>
      );
    case "el_heading":
      return (
        <Frame>
          <div className="flex flex-1 items-center">
            <div className="h-2.5 w-2/3 rounded-full bg-brand-mute/60" />
          </div>
        </Frame>
      );
    case "el_text":
      return (
        <Frame>
          <div className="flex flex-1 flex-col justify-center gap-1">
            <Bar />
            <Bar w="w-5/6" />
            <Bar w="w-2/3" />
          </div>
        </Frame>
      );
    case "el_image":
      return (
        <Frame>
          <div className="flex-1 rounded bg-brand-line/50" />
        </Frame>
      );
    case "el_button":
      return (
        <Frame>
          <div className="flex flex-1 items-center">
            <div className="h-3.5 w-12 rounded bg-brand-accent" />
          </div>
        </Frame>
      );
    case "el_spacer":
      return (
        <Frame>
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-px bg-brand-line" />
          </div>
        </Frame>
      );
    case "el_divider":
      return (
        <Frame>
          <div className="flex flex-1 items-center">
            <div className="h-px w-full bg-brand-mute/50" />
          </div>
        </Frame>
      );
    case "columns":
      return (
        <Frame>
          <div className="grid flex-1 grid-cols-2 gap-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-1 rounded bg-white p-1">
                <Bar w="w-2/3" muted />
                <Bar />
                <Bar w="w-3/4" />
              </div>
            ))}
          </div>
        </Frame>
      );
    default:
      return (
        <Frame>
          <div className="flex-1 rounded bg-brand-line/40" />
        </Frame>
      );
  }
}
