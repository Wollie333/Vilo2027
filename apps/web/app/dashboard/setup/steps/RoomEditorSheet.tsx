"use client";

import { ImageIcon, Settings, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent } from "@/components/ui/sheet";

import { fetchRoomEditorDataAction } from "../../listings/[id]/edit/actions";
import type { RoomEditorRoom } from "../../listings/[id]/edit/rooms/[roomId]/RoomEditor";
import { RoomAmenitiesSection } from "../../listings/[id]/edit/rooms/[roomId]/sections/RoomAmenitiesSection";
import { RoomDetailsForm } from "../../listings/[id]/edit/rooms/[roomId]/sections/RoomDetailsForm";
import { RoomPhotosSection } from "../../listings/[id]/edit/rooms/[roomId]/sections/RoomPhotosSection";

type TabId = "details" | "photos" | "amenities";

const TABS: { id: TabId; label: string; icon: typeof Settings }[] = [
  { id: "details", label: "Details", icon: Settings },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "amenities", label: "Amenities", icon: Sparkles },
];

// Blank room used to seed RoomDetailsForm in create mode.
const BLANK_ROOM: RoomEditorRoom = {
  id: "",
  name: "",
  description: null,
  bedrooms: 1,
  bathrooms: 1,
  max_guests: 2,
  min_guests: 1,
  min_nights: 1,
  base_price: 0,
  weekend_price: null,
  cleaning_fee: 0,
  is_active: true,
  room_size_sqm: null,
  bed_type: null,
  view_type: null,
  experiences: [],
  featured_photo_id: null,
  beds: [],
  pricing_mode: "per_room",
  price_per_person: null,
  base_occupancy: null,
  extra_guest_price: null,
  child_price: 0,
  infant_price: 0,
  pet_fee: 0,
  infant_max_age: 2,
  child_max_age: 12,
};

export function RoomEditorSheet({
  listingId,
  open,
  onOpenChange,
  roomId,
  onChanged,
}: {
  listingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new room; otherwise edit this existing room. */
  roomId: string | null;
  /** Fired after any room create / edit (and on close) so the parent can
   *  refresh its room list — keeps the rich room cards in sync. */
  onChanged: () => void;
}) {
  const [room, setRoom] = useState<RoomEditorRoom | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [amenityKeys, setAmenityKeys] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [loading, setLoading] = useState(false);

  function loadRoom(id: string) {
    setLoading(true);
    fetchRoomEditorDataAction(listingId, id).then((res) => {
      setLoading(false);
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Could not load room." : res.error);
        return;
      }
      setRoom(res.data.room);
      setPhotos(res.data.photos);
      setAmenityKeys(res.data.amenityKeys);
    });
  }

  // Load (edit) or reset (create) whenever the sheet opens / target changes.
  useEffect(() => {
    if (!open) return;
    setActiveTab("details");
    if (roomId) {
      loadRoom(roomId);
    } else {
      setRoom(null);
      setPhotos([]);
      setAmenityKeys([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomId, listingId]);

  // Close + tell the parent to refresh its room list.
  function close() {
    onChanged();
    onOpenChange(false);
  }

  const tabCounts: Record<TabId, string | null> = {
    details: null,
    photos: String(photos.length),
    amenities: String(amenityKeys.length),
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onChanged();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-brand-light p-0 sm:max-w-2xl"
      >
        <div className="border-b border-brand-line bg-white px-6 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            {room ? "Edit room" : "Add a room"}
          </div>
          <h2 className="mt-0.5 font-display text-xl font-bold text-brand-ink">
            {room ? room.name || "Room" : "New room"}
          </h2>
          <p className="mt-0.5 text-xs text-brand-mute">
            Set it up exactly like the rooms page — details, photos and per-room
            amenities. Create the room first, then add a featured photo and
            gallery.
          </p>
        </div>

        <div className="space-y-5 p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-brand-mute">
              Loading room…
            </div>
          ) : !room ? (
            // Create the room with the SAME form used to edit it. Photos /
            // amenities unlock once the room exists (they attach to a room id).
            <RoomDetailsForm
              listingId={listingId}
              mode="create"
              room={BLANK_ROOM}
              onCreated={(id) => {
                loadRoom(id);
                onChanged();
              }}
            />
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
                  onSaved={(patch) =>
                    setRoom((r) => (r ? { ...r, ...patch } : r))
                  }
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
                  onClick={close}
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
