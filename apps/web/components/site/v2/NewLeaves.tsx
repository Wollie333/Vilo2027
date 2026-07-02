import type { CSSProperties } from "react";

import type { RoomCard } from "@/lib/site/types";

import { elColor } from "../sections/_shared";

// Builder V2 — token-driven leaves for the FIVE new widget types. Each reads the
// scoped `--site-*` vars only (brand-safe, themes per tenant). Live binding
// (Brand Studio identity, the Nav-builder menu, a live room) is wired in Phase 5;
// for now these render from their own props with sensible placeholders.

type Align = "left" | "center" | "right";
const alignItems = (a: Align): CSSProperties["alignItems"] =>
  a === "center" ? "center" : a === "right" ? "flex-end" : "flex-start";
const textAlign = (a: Align): CSSProperties["textAlign"] => a;

type ElColorKey = "default" | "muted" | "accent" | "secondary";

// ── Icon box ──────────────────────────────────────────────────
export function IconLeaf({
  props,
  variant,
}: {
  props: Record<string, unknown>;
  variant?: string;
}) {
  const glyph = String(props.glyph ?? "★");
  const title = String(props.title ?? "");
  const body = String(props.body ?? "");
  const color = elColor(props.color as ElColorKey, "var(--site-accent)");
  const align = (props.align as Align) ?? "center";
  const inline = variant === "inline";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: inline ? "row" : "column",
        alignItems: inline ? "flex-start" : alignItems(align),
        gap: inline ? 14 : 10,
        textAlign: inline ? "left" : textAlign(align),
        maxWidth: 360,
        marginInline: align === "center" && !inline ? "auto" : undefined,
      }}
    >
      <div style={{ fontSize: 34, lineHeight: 1, color }}>{glyph}</div>
      <div>
        {title ? (
          <h3
            style={{
              margin: "0 0 6px",
              fontFamily: "var(--site-font-heading)",
              fontWeight: "var(--site-weight-heading)" as unknown as number,
              fontSize: "var(--site-h4)",
              color: "var(--site-ink)",
            }}
          >
            {title}
          </h3>
        ) : null}
        {body ? (
          <p style={{ margin: 0, color: "var(--site-mute)", lineHeight: 1.55 }}>
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Logo ──────────────────────────────────────────────────────
// Reads Brand Studio identity live in Phase 5; placeholder name/mono for now.
export function LogoLeaf({
  props,
  brandName = "Your brand",
  monogram,
}: {
  props: Record<string, unknown>;
  brandName?: string;
  monogram?: string;
}) {
  const style = String(props.style ?? "markName");
  const align = (props.align as Align) ?? "left";
  const mono = (monogram ?? brandName[0] ?? "W").slice(0, 2);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: alignItems(align),
        gap: 10,
      }}
    >
      {style !== "name" ? (
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--site-radius, 9px)",
            background: "var(--site-accent)",
            color: "var(--site-accentInk, #fff)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--site-font-heading)",
            fontWeight: 700,
          }}
        >
          {mono}
        </span>
      ) : null}
      {style !== "mark" ? (
        <span
          style={{
            fontFamily: "var(--site-font-heading)",
            fontSize: "1.2rem",
            color: "var(--site-ink)",
          }}
        >
          {brandName}
        </span>
      ) : null}
    </div>
  );
}

// ── Nav menu ──────────────────────────────────────────────────
// Header/menu are governed by the Nav builder; this leaf is for the footer /
// in-page. Custom items render now; the "menu" source binds in Phase 5.
export function NavLeaf({
  props,
  items,
}: {
  props: Record<string, unknown>;
  items?: string[];
}) {
  const list =
    items ??
    String(props.items ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  if (!list.length) return null;
  const color = elColor(props.color as ElColorKey, "var(--site-ink)");
  const align = (props.align as Align) ?? "center";
  const variant = String(
    (props as { variant?: string }).variant ?? "underline",
  );
  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: alignItems(align),
      }}
    >
      {list.map((label, i) => (
        <a
          key={i}
          href="#"
          style={{
            color:
              variant === "pill" && i === 0
                ? "var(--site-accentInk, #fff)"
                : color,
            background:
              variant === "pill" && i === 0
                ? "var(--site-accent)"
                : "transparent",
            padding: "8px 12px",
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 600,
            boxShadow:
              variant === "underline" && i === 0
                ? "inset 0 -2px 0 var(--site-accent)"
                : undefined,
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

// ── Social icons ──────────────────────────────────────────────
// Reads Brand Studio socials live in Phase 5; renders provided/typed networks.
export function SocialLeaf({
  props,
  networks,
}: {
  props: Record<string, unknown>;
  networks?: string[];
}) {
  const nets =
    networks ??
    String(props.networks ?? "instagram, facebook, x")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  if (!nets.length) return null;
  const color = elColor(props.color as ElColorKey, "var(--site-ink)");
  const align = (props.align as Align) ?? "left";
  const round =
    String((props as { variant?: string }).variant ?? "round") === "round";
  return (
    <div
      style={{ display: "flex", gap: 10, justifyContent: alignItems(align) }}
    >
      {nets.map((n, i) => (
        <span
          key={i}
          title={n}
          style={{
            width: 38,
            height: 38,
            borderRadius: round ? 999 : 10,
            background: color,
            color: "var(--site-bg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            textTransform: "capitalize",
          }}
        >
          {n[0]?.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

// ── Room card ─────────────────────────────────────────────────
// Renders ONE room bound live via SiteData (chosen by props.room_id, else the
// first/featured room). With no data (empty site) it falls back to a placeholder
// so the block stays visible + selectable in the builder.
function money(price: number | null | undefined, currency?: string | null) {
  if (price == null) return null;
  const code = currency || "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${code} ${price}`;
  }
}

export function RoomCardLeaf({
  props,
  variant,
  room,
}: {
  props: Record<string, unknown>;
  variant?: string;
  room?: RoomCard;
}) {
  const showPrice = props.show_price !== false;
  const showMeta = props.show_meta !== false;
  const overlay = variant === "overlay";

  const name = room?.name ?? "A lovely room";
  const meta = room?.facts?.length
    ? room.facts.join(" · ")
    : (room?.description ?? "Sleeps 2 · garden-facing");
  const priceLabel = room ? money(room.price, room.currency) : "from R1,450";

  return (
    <div
      style={{
        background: "var(--site-surface)",
        borderRadius: "var(--site-card-radius, 12px)",
        overflow: "hidden",
        boxShadow: "var(--site-card-shadow, 0 24px 50px -30px rgba(0,0,0,.4))",
        textAlign: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          aspectRatio: "4 / 3",
          background: room?.imageUrl
            ? `center / cover no-repeat url(${JSON.stringify(room.imageUrl)})`
            : "linear-gradient(135deg, var(--site-line), var(--site-surface))",
        }}
      />
      <div style={{ padding: overlay ? "0" : "12px 12px 16px" }}>
        <div
          style={{
            fontFamily: "var(--site-font-heading)",
            fontSize: "1.3rem",
            color: "var(--site-ink)",
            marginTop: 8,
          }}
        >
          {name}
        </div>
        {showMeta && meta ? (
          <div
            style={{ fontSize: 13, color: "var(--site-mute)", marginTop: 2 }}
          >
            {meta}
          </div>
        ) : null}
        {showPrice && priceLabel ? (
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--site-font-heading)",
              color: "var(--site-accent)",
            }}
          >
            {room ? `from ${priceLabel}` : priceLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
