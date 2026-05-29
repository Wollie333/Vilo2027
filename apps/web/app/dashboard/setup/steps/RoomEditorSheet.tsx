"use client";

import { ImageIcon, Settings, Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent } from "@/components/ui/sheet";

import {
  createRoomAction,
  fetchRoomEditorDataAction,
} from "../../listings/[id]/edit/actions";
import type { RoomEditorRoom } from "../../listings/[id]/edit/rooms/[roomId]/RoomEditor";
import { RoomAmenitiesSection } from "../../listings/[id]/edit/rooms/[roomId]/sections/RoomAmenitiesSection";
import { RoomDetailsForm } from "../../listings/[id]/edit/rooms/[roomId]/sections/RoomDetailsForm";
import { RoomPhotosSection } from "../../listings/[id]/edit/rooms/[roomId]/sections/RoomPhotosSection";
import type { Room } from "../types";

type TabId = "details" | "photos" | "amenities";

const TABS: { id: TabId; label: string; icon: typeof Settings }[] = [
  { id: "details", label: "Details", icon: Settings },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "amenities", label: "Amenities", icon: Sparkles },
];

// Maps the full editor room down to the lightweight summary the wizard tracks.
function toSummary(r: RoomEditorRoom): Room {
  return {
    id: r.id,
    name: r.name,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    max_guests: r.max_guests,
    base_price: r.base_price,
    is_active: r.is_active,
  };
}

export function RoomEditorSheet({
  listingId,
  open,
  onOpenChange,
  roomId,
  onSaved,
}: {
  listingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new room; otherwise edit this existing room. */
  roomId: string | null;
  onSaved: (room: Room) => void;
}) {
  const [room, setRoom] = useState<RoomEditorRoom | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [amenityKeys, setAmenityKeys] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [loading, setLoading] = useState(false);

  // Create-form state (only used when roomId is null and no room exists yet).
  const [name, setName] = useState("");
  const [guests, setGuests] = useState("2");
  const [beds, setBeds] = useState("1");
  const [baths, setBaths] = useState("1");
  const [price, setPrice] = useState("");
  const [creating, startCreate] = useTransition();

  // Load / reset whenever the sheet opens or its target room changes.
  useEffect(() => {
    if (!open) return;
    setActiveTab("details");
    if (roomId) {
      setLoading(true);
      fetchRoomEditorDataAction(listingId, roomId).then((res) => {
        setLoading(false);
        if (!res.ok || !res.data) {
          toast.error(res.ok ? "Could not load room." : res.error);
          onOpenChange(false);
          return;
        }
        setRoom(res.data.room);
        setPhotos(res.data.photos);
        setAmenityKeys(res.data.amenityKeys);
      });
    } else {
      // Fresh create — clear everything.
      setRoom(null);
      setPhotos([]);
      setAmenityKeys([]);
      setName("");
      setGuests("2");
      setBeds("1");
      setBaths("1");
      setPrice("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomId, listingId]);

  function createDraft() {
    const p = Number(price);
    const g = Number(guests);
    if (!name.trim()) return toast.error("Room needs a name.");
    if (!Number.isFinite(p) || p <= 0)
      return toast.error("Room needs a base price.");
    if (!Number.isInteger(g) || g < 1)
      return toast.error("Max guests must be at least 1.");
    startCreate(async () => {
      const res = await createRoomAction(listingId, {
        name: name.trim(),
        max_guests: g,
        bedrooms: Number(beds),
        bathrooms: Number(baths),
        base_price: p,
      });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Could not create room." : res.error);
        return;
      }
      const draft: RoomEditorRoom = {
        id: res.data.id,
        name: name.trim(),
        description: null,
        bedrooms: Number(beds),
        bathrooms: Number(baths),
        max_guests: g,
        base_price: p,
        weekend_price: null,
        cleaning_fee: 0,
        is_active: true,
        room_size_sqm: null,
        bed_type: null,
        view_type: null,
        experiences: [],
        featured_photo_id: null,
      };
      setRoom(draft);
      onSaved(toSummary(draft));
      toast.success("Room created — add photos and amenities below.");
    });
  }

  const tabCounts: Record<TabId, string | null> = {
    details: null,
    photos: String(photos.length),
    amenities: String(amenityKeys.length),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-brand-light p-0 sm:max-w-2xl"
      >
        <div className="border-b border-brand-line bg-white px-6 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            {room ? "Edit room" : "Add a room"}
          </div>
          <h2 className="mt-0.5 font-display text-xl font-bold text-brand-ink">
            {room ? room.name : "New room"}
          </h2>
          <p className="mt-0.5 text-xs text-brand-mute">
            Set it up exactly like the rooms page — details, photos and per-room
            amenities. Each section saves on its own.
          </p>
        </div>

        <div className="space-y-5 p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-brand-mute">
              Loading room…
            </div>
          ) : !room ? (
            // ── Create basics first (a room must exist before photos /
            //    amenities can attach to it) ──
            <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <div className="grid gap-3 sm:grid-cols-2">
                <CreateField label="Room name" className="sm:col-span-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Garden Suite"
                    className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
                  />
                </CreateField>
                <CreateField label="Base price · per night">
                  <div className="flex items-stretch overflow-hidden rounded border border-brand-line focus-within:border-brand-primary">
                    <span className="flex items-center bg-brand-light px-3 font-mono text-sm text-brand-mute">
                      R
                    </span>
                    <input
                      inputMode="decimal"
                      value={price}
                      onChange={(e) =>
                        setPrice(e.target.value.replace(/[^0-9.]/g, ""))
                      }
                      placeholder="0"
                      className="num flex-1 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </CreateField>
                <CreateField label="Max guests">
                  <input
                    type="number"
                    min={1}
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
                  />
                </CreateField>
                <CreateField label="Bedrooms">
                  <input
                    type="number"
                    min={0}
                    value={beds}
                    onChange={(e) => setBeds(e.target.value)}
                    className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
                  />
                </CreateField>
                <CreateField label="Bathrooms">
                  <input
                    type="number"
                    min={0}
                    value={baths}
                    onChange={(e) => setBaths(e.target.value)}
                    className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
                  />
                </CreateField>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={createDraft}
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create room"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-0.5 overflow-x-auto rounded-card border border-brand-line bg-white p-1.5 shadow-card">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  const count = tabCounts[tab.id];
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                        active
                          ? "bg-brand-accent font-semibold text-brand-secondary"
                          : "font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                      {count !== null ? (
                        <span
                          className={`rounded-pill px-1.5 py-0.5 text-[9.5px] font-bold ${
                            active
                              ? "bg-white/80 text-brand-secondary"
                              : "bg-brand-line text-brand-mute"
                          }`}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {activeTab === "details" ? (
                <RoomDetailsForm
                  listingId={listingId}
                  room={room}
                  onSaved={(patch) => {
                    const next = { ...room, ...patch };
                    setRoom(next);
                    onSaved(toSummary(next));
                  }}
                />
              ) : null}

              {activeTab === "photos" ? (
                <RoomPhotosSection
                  listingId={listingId}
                  roomId={room.id}
                  featuredPhotoId={room.featured_photo_id}
                  photos={photos}
                  onPhotosChange={setPhotos}
                  onFeaturedChange={(id) =>
                    setRoom((r) => (r ? { ...r, featured_photo_id: id } : r))
                  }
                />
              ) : null}

              {activeTab === "amenities" ? (
                <RoomAmenitiesSection
                  listingId={listingId}
                  roomId={room.id}
                  amenityKeys={amenityKeys}
                  onChange={setAmenityKeys}
                />
              ) : null}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreateField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="mb-1 font-display text-[12.5px] font-semibold text-brand-ink">
        {label}
      </div>
      {children}
    </label>
  );
}
