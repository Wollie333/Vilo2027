"use client";

import { MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createPoiAction,
  createThemeAction,
  deletePoiAction,
  deleteThemeAction,
} from "./actions";

export type ExtrasListing = { id: string; name: string };
export type PoiItem = {
  id: string;
  listingId: string;
  category: "eat" | "do" | "travel";
  name: string;
  travelTime: string | null;
};
export type ThemeItem = {
  id: string;
  listingId: string;
  label: string;
  iconKey: string;
  mentionCount: number | null;
};

const CATEGORIES: { key: PoiItem["category"]; label: string }[] = [
  { key: "eat", label: "Eat" },
  { key: "do", label: "Do" },
  { key: "travel", label: "Travel" },
];

const ICON_KEYS = [
  "sparkles",
  "grape",
  "heart-handshake",
  "ear-off",
  "coffee",
  "moon-star",
  "bath",
  "package",
  "armchair",
];

export function ExtrasManager({
  listings,
  initialPois,
  initialThemes,
}: {
  listings: ExtrasListing[];
  initialPois: PoiItem[];
  initialThemes: ThemeItem[];
}) {
  const [listingId, setListingId] = useState(listings[0]?.id ?? "");
  const [pois, setPois] = useState(initialPois);
  const [themes, setThemes] = useState(initialThemes);

  const listingPois = useMemo(
    () => pois.filter((p) => p.listingId === listingId),
    [pois, listingId],
  );
  const listingThemes = useMemo(
    () => themes.filter((t) => t.listingId === listingId),
    [themes, listingId],
  );

  return (
    <div className="space-y-6">
      {/* Listing picker */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-brand-ink">Listing</label>
        <select
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
        >
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Neighbourhood */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-primary" />
          <h2 className="font-display text-lg font-bold text-brand-ink">
            Where you&rsquo;ll be
          </h2>
        </div>
        <p className="mt-0.5 text-sm text-brand-mute">
          Nearby spots shown in the guest&rsquo;s Location section, grouped by
          Eat / Do / Travel.
        </p>

        <PoiAdder
          listingId={listingId}
          onAdd={(p) => setPois((prev) => [...prev, p])}
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const items = listingPois.filter((p) => p.category === c.key);
            return (
              <div key={c.key} className="rounded border border-brand-line p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
                  {c.label}
                </div>
                {items.length === 0 ? (
                  <div className="mt-2 text-xs text-brand-mute">
                    Nothing yet.
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {items.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 text-sm text-brand-ink"
                      >
                        <span className="min-w-0 truncate">
                          {p.name}
                          {p.travelTime ? (
                            <span className="ml-1 font-mono text-xs text-brand-mute">
                              {p.travelTime}
                            </span>
                          ) : null}
                        </span>
                        <DeleteButton
                          onDelete={async () => {
                            const r = await deletePoiAction(p.id);
                            if (r.ok)
                              setPois((prev) =>
                                prev.filter((x) => x.id !== p.id),
                              );
                            else toast.error(r.error);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Review themes */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-primary" />
          <h2 className="font-display text-lg font-bold text-brand-ink">
            Guests mention
          </h2>
        </div>
        <p className="mt-0.5 text-sm text-brand-mute">
          Short chips shown in the reviews section. Count is optional.
        </p>

        <ThemeAdder
          listingId={listingId}
          onAdd={(t) => setThemes((prev) => [...prev, t])}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {listingThemes.length === 0 ? (
            <div className="text-xs text-brand-mute">No themes yet.</div>
          ) : (
            listingThemes.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-2.5 py-1 text-[12px] font-semibold text-brand-secondary"
              >
                {t.label}
                {t.mentionCount != null ? (
                  <span className="font-mono text-brand-mute">
                    {t.mentionCount}
                  </span>
                ) : null}
                <DeleteButton
                  onDelete={async () => {
                    const r = await deleteThemeAction(t.id);
                    if (r.ok)
                      setThemes((prev) => prev.filter((x) => x.id !== t.id));
                    else toast.error(r.error);
                  }}
                />
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PoiAdder({
  listingId,
  onAdd,
}: {
  listingId: string;
  onAdd: (p: PoiItem) => void;
}) {
  const [category, setCategory] = useState<PoiItem["category"]>("eat");
  const [name, setName] = useState("");
  const [travelTime, setTravelTime] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim()) {
      toast.error("Add a name.");
      return;
    }
    start(async () => {
      const r = await createPoiAction({
        listing_id: listingId,
        category,
        name: name.trim(),
        travel_time: travelTime.trim() || null,
      });
      if (r.ok) {
        onAdd({
          id: r.data.id,
          listingId,
          category,
          name: name.trim(),
          travelTime: travelTime.trim() || null,
        });
        setName("");
        setTravelTime("");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as PoiItem["category"])}
        className="rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
      >
        {CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Place name"
        className="min-w-[160px] flex-1 rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />
      <input
        value={travelTime}
        onChange={(e) => setTravelTime(e.target.value)}
        placeholder="e.g. 8 min"
        className="w-28 rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-60"
      >
        <Plus className="h-4 w-4" /> Add
      </button>
    </div>
  );
}

function ThemeAdder({
  listingId,
  onAdd,
}: {
  listingId: string;
  onAdd: (t: ThemeItem) => void;
}) {
  const [label, setLabel] = useState("");
  const [iconKey, setIconKey] = useState("sparkles");
  const [count, setCount] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!label.trim()) {
      toast.error("Add a label.");
      return;
    }
    const mention = count.trim() === "" ? null : Number(count);
    start(async () => {
      const r = await createThemeAction({
        listing_id: listingId,
        label: label.trim(),
        icon_key: iconKey,
        mention_count:
          mention != null && Number.isFinite(mention) ? mention : null,
      });
      if (r.ok) {
        onAdd({
          id: r.data.id,
          listingId,
          label: label.trim(),
          iconKey,
          mentionCount:
            mention != null && Number.isFinite(mention) ? mention : null,
        });
        setLabel("");
        setCount("");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Spotless"
        className="min-w-[160px] flex-1 rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />
      <select
        value={iconKey}
        onChange={(e) => setIconKey(e.target.value)}
        className="rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
      >
        {ICON_KEYS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <input
        value={count}
        onChange={(e) => setCount(e.target.value)}
        placeholder="count"
        inputMode="numeric"
        className="w-24 rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-60"
      >
        <Plus className="h-4 w-4" /> Add
      </button>
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(onDelete)}
      className="shrink-0 rounded p-1 text-brand-mute hover:bg-brand-light hover:text-status-cancelled disabled:opacity-50"
      aria-label="Remove"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
