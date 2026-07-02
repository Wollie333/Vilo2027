"use client";

// Builder V2 — Phase 4b-3. The "Edit amenities" modal for the property-sourced
// `amenities` (Wielo) block. Like rooms, amenities are SYSTEM-fed: they live in
// property_amenities, not on the website. This modal loads the published amenity
// catalog + the property's current selection and writes the chosen keys back via
// the existing `replaceAmenitiesAction` (the Properties-manager SSOT). The live
// site + builder canvas then reflect it (router.refresh).
import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import {
  fetchBuilderAmenitiesAction,
  type BuilderAmenityGroup,
  type BuilderPropertyAmenities,
} from "@/app/[locale]/dashboard/website/actions";
import { replaceAmenitiesAction } from "@/app/[locale]/dashboard/properties/[id]/edit/actions";

export function AmenitiesDataModal({
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
  const [groups, setGroups] = useState<BuilderAmenityGroup[] | null>(null);
  const [properties, setProperties] = useState<BuilderPropertyAmenities[]>([]);
  const [propId, setPropId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setGroups(null);
    setError(null);
    const res = await fetchBuilderAmenitiesAction(websiteId);
    if (!res.ok) {
      setError("Couldn't load your amenities.");
      setGroups([]);
      return;
    }
    setGroups(res.groups);
    setProperties(res.properties);
    const first = res.properties[0];
    setPropId(first?.id ?? "");
    setSelected(new Set(first?.keys ?? []));
  }, [websiteId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const pickProperty = (id: string) => {
    setPropId(id);
    const p = properties.find((x) => x.id === id);
    setSelected(new Set(p?.keys ?? []));
    setError(null);
  };

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const count = selected.size;
  const totalItems = useMemo(
    () => (groups ?? []).reduce((n, g) => n + g.items.length, 0),
    [groups],
  );

  const save = async () => {
    if (!propId) return setError("Pick a property first.");
    setSaving(true);
    setError(null);
    const res = await replaceAmenitiesAction(propId, [...selected]);
    setSaving(false);
    if (!res.ok) return setError(res.error || "Couldn't save amenities.");
    // Keep the local property snapshot in sync so switching away + back is correct.
    setProperties((prev) =>
      prev.map((p) => (p.id === propId ? { ...p, keys: [...selected] } : p)),
    );
    toast("Amenities saved — your live site now shows them.");
    router.refresh(); // reflect on the builder canvas without a manual reload
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit amenities"
      onClick={onClose}
      style={S.backdrop}
    >
      <div onClick={(e) => e.stopPropagation()} style={S.panel}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Edit amenities</div>
            <div style={S.sub}>
              Sets your property’s real amenities (from the property). The
              builder preview shows sample content for layout.
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

        {groups === null ? (
          <div style={S.state}>Loading amenities…</div>
        ) : properties.length === 0 ? (
          <div style={S.state}>
            You don’t have a property yet. Create one in{" "}
            <b>Dashboard → Properties</b>, then choose its amenities here.
          </div>
        ) : (
          <>
            <div style={S.toolbar}>
              {properties.length > 1 && (
                <select
                  style={S.sel}
                  value={propId}
                  onChange={(e) => pickProperty(e.target.value)}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <span style={S.counter}>
                {count} of {totalItems} selected
              </span>
            </div>

            <div style={S.body}>
              {(groups ?? []).map((g) => (
                <div key={g.label} style={S.group}>
                  <div style={S.groupLabel}>{g.label}</div>
                  <div style={S.grid}>
                    {g.items.map((it) => (
                      <label key={it.key} style={S.check}>
                        <input
                          type="checkbox"
                          checked={selected.has(it.key)}
                          onChange={() => toggle(it.key)}
                        />
                        <span>{it.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={S.foot}>
              {error && <span style={S.err}>{error}</span>}
              <div style={{ flex: 1 }} />
              <button type="button" onClick={onClose} style={S.btnGhost}>
                Close
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                style={{ ...S.btn, ...(saving ? S.btnBusy : null) }}
              >
                {saving ? "Saving…" : "Save amenities"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
    width: "min(720px, 96vw)",
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
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 18px",
    borderBottom: "1px solid #f0f2f0",
  },
  sel: {
    border: "1px solid #d5ddd8",
    borderRadius: 8,
    padding: "7px 9px",
    fontSize: 13,
    color: "#0f1f17",
    fontFamily: "inherit",
    background: "#fff",
  },
  counter: { fontSize: 12, color: "#6b7a72" },
  body: { padding: 18, overflow: "auto", flex: 1 },
  group: { marginBottom: 16 },
  groupLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    color: "#6b7a72",
    marginBottom: 8,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "6px 12px",
  },
  check: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#31413a",
  },
  foot: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 18px",
    borderTop: "1px solid #e8ece9",
  },
  err: { fontSize: 12.5, color: "#b3261e", fontWeight: 500 },
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
