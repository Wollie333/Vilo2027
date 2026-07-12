"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageIcon,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import {
  fetchRoomEditorDataAction,
  setRoomAmenitiesAction,
} from "../../properties/[id]/edit/actions";
import type { RoomEditorRoom } from "../../properties/[id]/edit/rooms/[roomId]/RoomEditor";
import { RoomAmenitiesSection } from "../../properties/[id]/edit/rooms/[roomId]/sections/RoomAmenitiesSection";
import {
  RoomDetailsForm,
  type RoomDetailsFormHandle,
} from "../../properties/[id]/edit/rooms/[roomId]/sections/RoomDetailsForm";
import { RoomPhotosSection } from "../../properties/[id]/edit/rooms/[roomId]/sections/RoomPhotosSection";

type StepId = 1 | 2 | 3;

const STEPS: { id: StepId; label: string; icon: typeof Settings }[] = [
  { id: 1, label: "Details", icon: Settings },
  { id: 2, label: "Photos", icon: ImageIcon },
  { id: 3, label: "Amenities", icon: Sparkles },
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
  allow_children: true,
  allow_infants: true,
  allow_pets: true,
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
  const [step, setStep] = useState<StepId>(1);
  const [loading, setLoading] = useState(false);
  const detailsRef = useRef<RoomDetailsFormHandle>(null);
  const [saving, setSaving] = useState(false);

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

  // Load (edit) or reset (create) whenever the modal opens / target changes.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (roomId) {
      loadRoom(roomId);
    } else {
      setRoom(null);
      setPhotos([]);
      setAmenityKeys([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomId, listingId]);

  // Persist the room's amenities as ONE batch (the section defers per-toggle
  // saves via `deferSave`, so the host picks everything and it saves here).
  // Idempotent + safe to call on any close; no-op until the room exists.
  async function persistAmenities() {
    if (!room?.id) return;
    const res = await setRoomAmenitiesAction(listingId, room.id, amenityKeys);
    if (!res.ok) toast.error(res.error);
  }

  // Close + persist amenities + tell the parent to refresh its room list.
  async function close() {
    await persistAmenities();
    onChanged();
    onOpenChange(false);
  }

  const stepLabel = STEPS.find((s) => s.id === step)?.label ?? "";

  // Footer "Next": on the Details step, persist via the form's imperative handle
  // before advancing (create mints the room → step 2; edit saves → step 2).
  // Photos save themselves as the host edits; amenities are batch-saved on
  // "Save room" (or on close) via persistAmenities — so these just advance.
  async function handleNext() {
    if (step === 1) {
      setSaving(true);
      const ok = await detailsRef.current?.save();
      setSaving(false);
      if (!ok) return;
      if (room) setStep(2); // create mode advances itself via onCreated
      return;
    }
    if (step === 2) setStep(3);
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) void persistAmenities().then(onChanged);
        onOpenChange(next);
      }}
      title={room ? room.name || "Edit room" : "Add a room"}
      description={`Step ${step} of 3 · ${stepLabel}`}
      size="lg"
    >
      {/* Stepper — three steps; 2 & 3 unlock once the room exists. */}
      <div className="mb-5 flex items-center gap-1">
        {STEPS.map((s, i) => {
          const reachable = !!room || s.id === 1;
          const isCurrent = s.id === step;
          const isDone = !!room && s.id < step;
          const Icon = s.icon;
          return (
            <div key={s.id} className="flex flex-1 items-center gap-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(s.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-card border px-2 py-2 text-[12px] font-semibold transition ${
                  isCurrent
                    ? "border-brand-primary bg-brand-accent text-brand-secondary"
                    : isDone
                      ? "border-brand-primary/40 bg-white text-brand-secondary"
                      : "border-brand-line bg-white text-brand-mute"
                } ${reachable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {s.id}. {s.label}
              </button>
              {i < STEPS.length - 1 ? (
                <span className="h-px w-2 shrink-0 bg-brand-line" />
              ) : null}
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-brand-mute">
          Loading room…
        </div>
      ) : !room ? (
        // Step 1, create: same form used to edit. Creating the room unlocks
        // photos + amenities (they attach to a room id) and advances to step 2.
        <RoomDetailsForm
          ref={detailsRef}
          hideSubmit
          listingId={listingId}
          mode="create"
          room={BLANK_ROOM}
          onCreated={(id) => {
            loadRoom(id);
            onChanged();
            setStep(2);
          }}
        />
      ) : step === 1 ? (
        <RoomDetailsForm
          ref={detailsRef}
          hideSubmit
          listingId={listingId}
          room={room}
          onSaved={(patch) => setRoom((r) => (r ? { ...r, ...patch } : r))}
        />
      ) : step === 2 ? (
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
      ) : (
        <RoomAmenitiesSection
          listingId={listingId}
          roomId={room.id}
          amenityKeys={amenityKeys}
          onChange={setAmenityKeys}
          deferSave
        />
      )}

      <FormModalFooter>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as StepId) : s))}
            className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <FormModalCancel>Cancel</FormModalCancel>
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
          >
            {saving ? "Saving…" : "Next"} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSaving(true);
              void close().finally(() => setSaving(false));
            }}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
          >
            <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save room"}
          </button>
        )}
      </FormModalFooter>
    </FormModal>
  );
}
