import type { CSSProperties } from "react";

import type { RoomCard } from "@/lib/site/types";

import { elColor, SiteIcon } from "../sections/_shared";

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
  const iconSize =
    typeof props.icon_size === "string" && props.icon_size !== "auto"
      ? Number(props.icon_size)
      : 34;
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
      <SiteIcon
        value={glyph}
        size={iconSize}
        style={{ fontSize: iconSize, lineHeight: 1, color }}
      />
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
  const sz = LOGO_SIZE[String(props.size ?? "md")] ?? LOGO_SIZE.md;
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
            width: sz.mono,
            height: sz.mono,
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
            fontSize: sz.name,
            color: "var(--site-ink)",
          }}
        >
          {brandName}
        </span>
      ) : null}
    </div>
  );
}
const LOGO_SIZE: Record<string, { mono: number; name: string }> = {
  sm: { mono: 28, name: "1.05rem" },
  md: { mono: 36, name: "1.2rem" },
  lg: { mono: 48, name: "1.5rem" },
};

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
  const chip =
    typeof props.icon_size === "string" && props.icon_size !== "auto"
      ? Number(props.icon_size)
      : 38;
  return (
    <div
      style={{ display: "flex", gap: 10, justifyContent: alignItems(align) }}
    >
      {nets.map((n, i) => (
        <span
          key={i}
          title={n}
          style={{
            width: chip,
            height: chip,
            borderRadius: round ? 999 : 10,
            background: color,
            color: "var(--site-bg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(chip * 0.34),
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

// ── Booking form (checkout /book) ─────────────────────────────
// A faithful STATIC preview of the on-site checkout, for the builder canvas. The
// LIVE /book route renders the real interactive SiteCheckoutForm, which reads the
// SAME `--el-<key>-*` vars — so styling here previews exactly what ships. Data
// (rooms/add-ons/pricing/payment) is route-driven; the host styles only.
const bookingField: CSSProperties = {
  background: "var(--el-field-bg, var(--site-bg))",
  border: "var(--el-field-bd, 1px solid var(--site-line))",
  color: "var(--el-field-fg, var(--site-ink))",
  borderRadius: "var(--el-field-radius, var(--site-radius, 10px))",
  padding: "10px 12px",
  fontSize: 13,
};

export function BookingFormLeaf({ props }: { props: Record<string, unknown> }) {
  const heading = String(props.heading ?? "Complete your booking");
  const addonCard: CSSProperties = {
    background: "var(--el-addon-bg, var(--site-surface))",
    border: "var(--el-addon-bd, 1px solid var(--site-line))",
    borderRadius: "var(--el-addon-radius, var(--site-radius, 10px))",
    padding: 12,
    display: "flex",
    gap: 10,
    alignItems: "center",
  };
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <h2
        style={{
          fontFamily: "var(--site-font-heading)",
          fontSize: "var(--el-title-size, var(--site-h3))",
          fontWeight:
            "var(--el-title-weight, var(--site-weight-heading))" as unknown as number,
          color: "var(--el-title-fg, var(--site-ink))",
          margin: "0 0 18px",
        }}
      >
        {heading}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <label style={{ display: "grid", gap: 5 }}>
          <FieldLabel>Check in</FieldLabel>
          <div style={bookingField}>Select date</div>
        </label>
        <label style={{ display: "grid", gap: 5 }}>
          <FieldLabel>Check out</FieldLabel>
          <div style={bookingField}>Select date</div>
        </label>
        <label style={{ display: "grid", gap: 5 }}>
          <FieldLabel>Guests</FieldLabel>
          <div style={bookingField}>2 guests</div>
        </label>
        <label style={{ display: "grid", gap: 5 }}>
          <FieldLabel>Full name</FieldLabel>
          <div style={bookingField}>Your name</div>
        </label>
      </div>
      <FieldLabel style={{ marginBottom: 8 }}>Add extras</FieldLabel>
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {["Airport transfer", "Breakfast basket"].map((a) => (
          <div key={a} style={addonCard}>
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "var(--site-line)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--site-ink)",
              }}
            >
              {a}
            </span>
            <span style={{ fontSize: 13, color: "var(--site-mute)" }}>
              + R250
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          background: "var(--el-summary-bg, var(--site-surface))",
          border: "var(--el-summary-bd, 1px solid var(--site-line))",
          borderRadius: "var(--el-summary-radius, var(--site-radius, 12px))",
          boxShadow: "var(--el-summary-shadow, none)",
          padding: 16,
        }}
      >
        <SummaryRow label="2 nights">R2,900</SummaryRow>
        <SummaryRow label="Airport transfer">R250</SummaryRow>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid var(--site-line)",
            marginTop: 10,
            paddingTop: 12,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--site-ink)" }}>
            Total
          </span>
          <span
            style={{
              fontSize: "var(--el-price-size, 1.15rem)",
              fontWeight: "var(--el-price-weight, 700)" as unknown as number,
              color: "var(--el-price-fg, var(--site-ink))",
            }}
          >
            R3,150
          </span>
        </div>
        <button
          type="button"
          disabled
          style={{
            marginTop: 14,
            width: "100%",
            padding: "12px 16px",
            background: "var(--el-button-bg, var(--site-accent))",
            color: "var(--el-button-fg, var(--site-accentInk, #fff))",
            border: "var(--el-button-bd, none)",
            borderRadius: "var(--el-button-radius, var(--site-radius, 10px))",
            fontWeight: 700,
            fontSize: 14,
            cursor: "default",
          }}
        >
          Reserve now
        </button>
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--site-mute)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        color: "var(--site-mute)",
        marginBottom: 6,
      }}
    >
      <span>{label}</span>
      <span style={{ color: "var(--site-ink)" }}>{children}</span>
    </div>
  );
}

// ── Booking confirmation (thank-you /book/thank-you) ──────────
// Static preview of the confirmed-booking card; the live route reads the same
// `--el-<key>-*` vars. Data (reference/dates/total/banking) is route-driven.
export function BookingConfirmationLeaf({
  props,
}: {
  props: Record<string, unknown>;
}) {
  const heading = String(props.heading ?? "You're booked in 🎉");
  const rows: [string, string][] = [
    ["Reference", "WLO-4821"],
    ["Dates", "12 Aug → 14 Aug"],
    ["Guests", "2"],
  ];
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
      <h2
        style={{
          fontFamily: "var(--site-font-heading)",
          fontSize: "var(--el-title-size, var(--site-h3))",
          fontWeight:
            "var(--el-title-weight, var(--site-weight-heading))" as unknown as number,
          color: "var(--el-title-fg, var(--site-ink))",
          textAlign: "center",
          margin: "0 0 8px",
        }}
      >
        {heading}
      </h2>
      <p
        style={{
          textAlign: "center",
          color: "var(--site-mute)",
          margin: "0 0 24px",
        }}
      >
        A confirmation is on its way to your email.
      </p>
      <div
        style={{
          background: "var(--el-card-bg, var(--site-surface))",
          border: "var(--el-card-bd, 1px solid var(--site-line))",
          borderRadius: "var(--el-card-radius, var(--site-radius, 12px))",
          boxShadow: "var(--el-card-shadow, none)",
          padding: 24,
        }}
      >
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: "var(--el-label-size, 0.875rem)",
                color: "var(--el-label-fg, var(--site-mute))",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: "var(--el-value-size, 0.875rem)",
                fontWeight: "var(--el-value-weight, 500)" as unknown as number,
                color: "var(--el-value-fg, var(--site-ink))",
              }}
            >
              {value}
            </span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid var(--site-line)",
            marginTop: 6,
            paddingTop: 12,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--site-ink)" }}>
            Total
          </span>
          <span
            style={{
              fontSize: "var(--el-price-size, 1.15rem)",
              fontWeight: "var(--el-price-weight, 700)" as unknown as number,
              color: "var(--el-price-fg, var(--site-ink))",
            }}
          >
            R3,150
          </span>
        </div>
      </div>
    </div>
  );
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
