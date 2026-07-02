"use client";

// Builder V2 — Phase 4a. The "Edit room data" modal for property-sourced (Wielo)
// room blocks. Wielo blocks are theme-styled but SYSTEM-fed: their data lives in
// `property_rooms`, not on the website. So this modal loads the host's REAL rooms
// (RLS-scoped) and writes edits straight back to `property_rooms` via the existing
// `updateRoomAction` — the same SSOT the Properties manager uses. The live site
// then reflects the change; the builder canvas keeps sample content for layout
// (real-data-on-canvas is a later slice).
import { useCallback, useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import {
  fetchBuilderRoomsAction,
  type BuilderRoom,
  type BuilderProperty,
} from "@/app/[locale]/dashboard/website/actions";
import {
  updateRoomAction,
  createRoomAction,
} from "@/app/[locale]/dashboard/properties/[id]/edit/actions";

type Draft = {
  name: string;
  base_price: string;
  max_guests: string;
  description: string;
  is_active: boolean;
};
// A new-room draft carries the property to attach it to (createRoomAction needs it).
type AddDraft = Draft & { property_id: string };

const toDraft = (r: BuilderRoom): Draft => ({
  name: r.name,
  base_price: String(r.basePrice),
  max_guests: String(r.maxGuests),
  description: r.description ?? "",
  is_active: r.isActive,
});
const blankAdd = (propertyId: string): AddDraft => ({
  property_id: propertyId,
  name: "",
  base_price: "",
  max_guests: "2",
  description: "",
  is_active: true,
});

export function RoomDataModal({
  open,
  onClose,
  toast,
  websiteId,
}: {
  open: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
  websiteId: string;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState<BuilderRoom[] | null>(null);
  const [properties, setProperties] = useState<BuilderProperty[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [addDraft, setAddDraft] = useState<AddDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (selectId?: string) => {
      setRooms(null);
      setError(null);
      const res = await fetchBuilderRoomsAction(websiteId);
      if (!res.ok) {
        setError("Couldn't load your rooms.");
        setRooms([]);
        return;
      }
      setRooms(res.rooms);
      setProperties(res.properties);
      // Land on the requested room (e.g. a just-created one), else the first. With
      // NO rooms yet, drop straight into "add" (the missing-data case) when the host
      // has a property to attach to.
      const target =
        (selectId && res.rooms.find((r) => r.id === selectId)) || res.rooms[0];
      if (!target && res.properties[0]) {
        setAddDraft(blankAdd(res.properties[0].id));
        setSelId(null);
        setDraft(null);
      } else {
        setAddDraft(null);
        setSelId(target?.id ?? null);
        setDraft(target ? toDraft(target) : null);
      }
    },
    [websiteId],
  );

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const select = (r: BuilderRoom) => {
    setSelId(r.id);
    setDraft(toDraft(r));
    setAddDraft(null);
    setError(null);
  };

  const startAdd = () => {
    setAddDraft(blankAdd(properties[0]?.id ?? ""));
    setSelId(null);
    setDraft(null);
    setError(null);
  };

  const addRoom = async () => {
    if (!addDraft) return;
    const name = addDraft.name.trim();
    const price = Number(addDraft.base_price);
    const guests = Number(addDraft.max_guests);
    if (!addDraft.property_id)
      return setError("Pick a property for this room.");
    if (!name) return setError("A room needs a name.");
    if (!Number.isFinite(price) || price < 0)
      return setError("Enter a valid price.");
    if (!Number.isInteger(guests) || guests < 1)
      return setError("Max guests must be at least 1.");
    setSaving(true);
    setError(null);
    const res = await createRoomAction(addDraft.property_id, {
      name,
      base_price: price,
      max_guests: guests,
      description: addDraft.description.trim() || null,
      is_active: addDraft.is_active,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error || "Couldn't create the room.");
    toast("Room added — it’s now on your live site.");
    await load(res.data?.id);
    router.refresh(); // reflect the new room on the builder canvas
  };

  const save = async () => {
    if (!draft || !selId || !rooms) return;
    const room = rooms.find((r) => r.id === selId);
    if (!room) return;
    const name = draft.name.trim();
    const price = Number(draft.base_price);
    const guests = Number(draft.max_guests);
    if (!name) return setError("A room needs a name.");
    if (!Number.isFinite(price) || price < 0)
      return setError("Enter a valid price.");
    if (!Number.isInteger(guests) || guests < 1)
      return setError("Max guests must be at least 1.");
    setSaving(true);
    setError(null);
    const res = await updateRoomAction(room.propertyId, room.id, {
      name,
      base_price: price,
      max_guests: guests,
      description: draft.description.trim() || null,
      is_active: draft.is_active,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Couldn't save the room.");
      return;
    }
    // Reflect the save in the local list so the picker + summary stay in sync.
    setRooms((prev) =>
      (prev ?? []).map((r) =>
        r.id === room.id
          ? {
              ...r,
              name,
              basePrice: price,
              maxGuests: guests,
              description: draft.description.trim() || null,
              isActive: draft.is_active,
            }
          : r,
      ),
    );
    toast("Room saved — your live site now shows it.");
    // Re-run the server load so the builder CANVAS (initialData) reflects the edit
    // without a manual reload. The working doc is client state, so it's preserved.
    router.refresh();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit room data"
      onClick={onClose}
      style={S.backdrop}
    >
      <div onClick={(e) => e.stopPropagation()} style={S.panel}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Edit room data</div>
            <div style={S.sub}>
              Edits your live rooms (from the property). The builder preview
              shows sample content for layout.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={S.x}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {rooms === null ? (
          <div style={S.state}>Loading your rooms…</div>
        ) : rooms.length === 0 && properties.length === 0 ? (
          <div style={S.state}>
            You don’t have a property yet. Create one in{" "}
            <b>Dashboard → Properties</b>, then add rooms here and on your site.
          </div>
        ) : (
          <div style={S.body}>
            <div style={S.list}>
              <button
                type="button"
                onClick={startAdd}
                disabled={properties.length === 0}
                style={{
                  ...S.addBtn,
                  ...(addDraft ? S.addBtnOn : null),
                }}
              >
                + New room
              </button>
              {rooms.length === 0 ? (
                <div style={S.listEmpty}>No rooms yet — add your first.</div>
              ) : (
                rooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => select(r)}
                    style={{
                      ...S.listItem,
                      ...(r.id === selId ? S.listItemOn : null),
                    }}
                  >
                    <span style={S.roomName}>{r.name || "Untitled room"}</span>
                    <span style={S.roomMeta}>
                      R {r.basePrice} · sleeps {r.maxGuests}
                      {r.isActive ? "" : " · hidden"}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div style={S.form}>
              {addDraft ? (
                <>
                  <div style={S.formTitle}>Add a new room</div>
                  {properties.length > 1 && (
                    <label style={S.field}>
                      <span style={S.lbl}>Property</span>
                      <select
                        style={S.inp}
                        value={addDraft.property_id}
                        onChange={(e) =>
                          setAddDraft({
                            ...addDraft,
                            property_id: e.target.value,
                          })
                        }
                      >
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label style={S.field}>
                    <span style={S.lbl}>Room name</span>
                    <input
                      style={S.inp}
                      value={addDraft.name}
                      onChange={(e) =>
                        setAddDraft({ ...addDraft, name: e.target.value })
                      }
                    />
                  </label>
                  <div style={S.row2}>
                    <label style={S.field}>
                      <span style={S.lbl}>Base price / night (R)</span>
                      <input
                        style={S.inp}
                        inputMode="numeric"
                        value={addDraft.base_price}
                        onChange={(e) =>
                          setAddDraft({
                            ...addDraft,
                            base_price: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label style={S.field}>
                      <span style={S.lbl}>Max guests</span>
                      <input
                        style={S.inp}
                        inputMode="numeric"
                        value={addDraft.max_guests}
                        onChange={(e) =>
                          setAddDraft({
                            ...addDraft,
                            max_guests: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label style={S.field}>
                    <span style={S.lbl}>Description</span>
                    <textarea
                      style={{ ...S.inp, minHeight: 72, resize: "vertical" }}
                      value={addDraft.description}
                      onChange={(e) =>
                        setAddDraft({
                          ...addDraft,
                          description: e.target.value,
                        })
                      }
                    />
                  </label>
                  {error && <div style={S.err}>{error}</div>}
                  <div style={S.actions}>
                    <button
                      type="button"
                      onClick={() => load(selId ?? undefined)}
                      style={S.btnGhost}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addRoom}
                      disabled={saving}
                      style={{ ...S.btn, ...(saving ? S.btnBusy : null) }}
                    >
                      {saving ? "Adding…" : "Add room"}
                    </button>
                  </div>
                </>
              ) : null}
              {draft && (
                <>
                  <label style={S.field}>
                    <span style={S.lbl}>Room name</span>
                    <input
                      style={S.inp}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </label>
                  <div style={S.row2}>
                    <label style={S.field}>
                      <span style={S.lbl}>Base price / night (R)</span>
                      <input
                        style={S.inp}
                        inputMode="numeric"
                        value={draft.base_price}
                        onChange={(e) =>
                          setDraft({ ...draft, base_price: e.target.value })
                        }
                      />
                    </label>
                    <label style={S.field}>
                      <span style={S.lbl}>Max guests</span>
                      <input
                        style={S.inp}
                        inputMode="numeric"
                        value={draft.max_guests}
                        onChange={(e) =>
                          setDraft({ ...draft, max_guests: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label style={S.field}>
                    <span style={S.lbl}>Description</span>
                    <textarea
                      style={{ ...S.inp, minHeight: 72, resize: "vertical" }}
                      value={draft.description}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                    />
                  </label>
                  <label style={S.check}>
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(e) =>
                        setDraft({ ...draft, is_active: e.target.checked })
                      }
                    />
                    <span>
                      Show this room on the site (active &amp; bookable)
                    </span>
                  </label>

                  {error && <div style={S.err}>{error}</div>}

                  <div style={S.actions}>
                    <button type="button" onClick={onClose} style={S.btnGhost}>
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      style={{ ...S.btn, ...(saving ? S.btnBusy : null) }}
                    >
                      {saving ? "Saving…" : "Save room"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Self-contained inline styles so the modal never depends on the .wb-scoped chrome
// CSS (it renders above the whole builder).
const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    background: "rgba(6,20,14,.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    width: "min(760px, 96vw)",
    maxHeight: "88vh",
    overflow: "hidden",
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 30px 80px -20px rgba(6,40,28,.5)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "inherit",
  },
  head: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "16px 18px",
    borderBottom: "1px solid #e8ece9",
  },
  title: { fontSize: 16, fontWeight: 700, color: "#0f1f17" },
  sub: { fontSize: 12, color: "#6b7a72", marginTop: 2, maxWidth: 560 },
  x: {
    border: "none",
    background: "transparent",
    fontSize: 16,
    cursor: "pointer",
    color: "#6b7a72",
    lineHeight: 1,
  },
  state: { padding: 28, textAlign: "center", color: "#6b7a72", fontSize: 14 },
  body: { display: "flex", minHeight: 0, flex: 1 },
  list: {
    width: 240,
    borderRight: "1px solid #e8ece9",
    overflow: "auto",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  listItem: {
    textAlign: "left",
    border: "1px solid transparent",
    background: "transparent",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  listItemOn: { background: "#eef5f1", border: "1px solid #cfe3d8" },
  roomName: { fontSize: 13, fontWeight: 600, color: "#0f1f17" },
  roomMeta: { fontSize: 11, color: "#6b7a72" },
  addBtn: {
    border: "1px dashed #b9ccc1",
    background: "#fff",
    color: "#064E3B",
    fontWeight: 700,
    fontSize: 12.5,
    borderRadius: 8,
    padding: "9px 10px",
    cursor: "pointer",
    marginBottom: 4,
  },
  addBtnOn: { background: "#eef5f1", borderColor: "#064E3B" },
  listEmpty: { fontSize: 12, color: "#6b7a72", padding: "8px 10px" },
  form: { flex: 1, padding: 18, overflow: "auto" },
  formTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f1f17",
    marginBottom: 12,
  },
  field: { display: "block", marginBottom: 12 },
  row2: { display: "flex", gap: 12 },
  lbl: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#31413a",
    marginBottom: 4,
  },
  inp: {
    width: "100%",
    border: "1px solid #d5ddd8",
    borderRadius: 8,
    padding: "9px 11px",
    fontSize: 13,
    color: "#0f1f17",
    fontFamily: "inherit",
    background: "#fff",
  },
  check: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#31413a",
    marginTop: 4,
  },
  err: {
    marginTop: 10,
    fontSize: 12.5,
    color: "#b3261e",
    fontWeight: 500,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
  },
  btn: {
    border: "none",
    background: "#064E3B",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    borderRadius: 9,
    padding: "10px 16px",
    cursor: "pointer",
  },
  btnBusy: { opacity: 0.6, cursor: "default" },
  btnGhost: {
    border: "1px solid #d5ddd8",
    background: "#fff",
    color: "#31413a",
    fontWeight: 600,
    fontSize: 13,
    borderRadius: 9,
    padding: "10px 16px",
    cursor: "pointer",
  },
};
