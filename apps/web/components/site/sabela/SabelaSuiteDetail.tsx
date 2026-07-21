import "./sabelaSuite.css";

import type { CSSProperties } from "react";

import type {
  ReviewsData,
  RoomCard,
  RoomDetail,
  SeasonalPricingData,
} from "@/lib/site/types";

import { siteImageUrl } from "@/lib/site/image";

import { OceansBookCard } from "../oceansview/OceansBookCard";
import { OceansRoomGallery } from "../oceansview/OceansRoomGallery";

// ── formatting helpers (server-rendered — Intl-free, deterministic) ──────────
function commas(n: number): string {
  const s = String(Math.round(n));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
}
function money(n?: number | null, currency?: string | null): string | null {
  if (n == null) return null;
  const ccy = currency ?? "ZAR";
  const sym = ccy === "ZAR" ? "R" : `${ccy} `;
  return `${sym}${commas(n)}`;
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "★";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
/** Split a fact like "Sleeps 2" / "36 m²" into a big value + a small label. */
function splitFact(fact: string): { value: string; label: string } {
  const f = fact.trim();
  const lead = f.match(/^(\d[\d.,]*\s*m²?|\d[\d.,]*°?)\s*(.*)$/);
  if (lead) return { value: lead[1].trim(), label: lead[2].trim() };
  const sleeps = f.match(/^sleeps\s+(\d+)$/i);
  if (sleeps) return { value: sleeps[1], label: "Guests" };
  const num = f.match(/^(\d[\d.,]*)\s+(.*)$/);
  if (num) return { value: num[1], label: num[2] };
  return { value: f, label: "" };
}

const Check = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ArrowSm = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

type GoodToKnow = { title: string; body: string };

/**
 * Sabela Lodge SUITE-DETAIL page — the founder's bespoke DARK-EDITORIAL "Lodge"
 * skin over the OceansView room-detail INFORMATION ARCHITECTURE (its professional
 * reference): breadcrumb → hero mosaic gallery → a two-column overview (eyebrow +
 * rating, display title, lead, key-spec strip + fact chips, body, "in the suite"
 * amenities, seasonal rate cards, "good to know") with a STICKY booking card, a
 * review summary with a live star-distribution + review cards, and an "other
 * suites" cross-sell strip. Every block is derived + omitted exactly as OceansView
 * does, just re-skinned to Sabela's warm-bone ink (#F1EADB) on deep ebony
 * (#14120D) with a gold (#C9A24A) accent. Renders INSIDE the `.sbchrome` themed
 * chrome (`hotel` preset). Scoped under `.sbsuite`. Reuses the shared interactive
 * gallery + booking card (re-skinned HERE, so neither oceansRoom.css nor
 * marmaladeRoom.css is imported).
 */
export function SabelaSuiteDetail({
  room,
  reviews,
  seasonal,
  otherRooms,
  roomsHref,
}: {
  room: RoomDetail;
  reviews?: ReviewsData | null;
  seasonal?: SeasonalPricingData | null;
  otherRooms?: RoomCard[] | null;
  roomsHref?: string | null;
}) {
  // Title / lead / body split — first paragraph is the lead, the rest is body.
  const desc = (room.description ?? "").trim();
  const paras = desc
    ? desc
        .split(/\n{2,}/)
        .map((para) => para.trim())
        .filter(Boolean)
    : [];
  const lead = paras[0] ?? "";
  const bodyParas = paras.slice(1);

  // Facts → a big-number spec strip (guests + numeric facts) and descriptive
  // chips (non-numeric facts). Keeps the two rows from repeating each other.
  const specs: { value: string; label: string }[] = [];
  if (room.maxGuests)
    specs.push({ value: String(room.maxGuests), label: "Guests" });
  const chips: string[] = [];
  for (const f of room.facts ?? []) {
    const s = splitFact(f);
    const isNumeric = /^\d/.test(s.value.trim());
    if (isNumeric) {
      if (specs.length >= 4) continue;
      if (/guest/i.test(s.label) && s.value === String(room.maxGuests ?? ""))
        continue;
      specs.push(s);
    } else if (chips.length < 5) {
      chips.push(f);
    }
  }

  // Rating line for the booking card + review header/summary.
  const avg = reviews?.average ?? null;
  const count = reviews?.count ?? reviews?.items?.length ?? 0;
  const ratingLabel =
    avg != null
      ? `${avg.toFixed(1)}${count ? ` · ${commas(count)} stay${count === 1 ? "" : "s"}` : ""}`
      : null;

  // Seasonal cards — mark the cheapest "Best value" and the dearest "Peak".
  const seasons = (seasonal?.seasons ?? []).filter((s) => s.priceFrom != null);
  const prices = seasons.map((s) => s.priceFrom as number);
  const minP = prices.length ? Math.min(...prices) : null;
  const maxP = prices.length ? Math.max(...prices) : null;

  // Good-to-know from the room's policies (only rows that have data).
  const p = room.policies ?? null;
  const gtk: GoodToKnow[] = [];
  if (p?.checkIn || p?.checkOut) {
    const bits = [
      p.checkIn ? `From ${p.checkIn}` : null,
      p.checkOut ? `until ${p.checkOut}` : null,
    ].filter(Boolean);
    gtk.push({ title: "Check-in / out", body: bits.join(" · ") });
  }
  if (p?.cancellation) {
    gtk.push({ title: "Cancellation", body: p.cancellation });
  }
  if (room.maxGuests || p?.children != null) {
    const bits = [
      room.maxGuests ? `Sleeps ${room.maxGuests}` : null,
      p?.children === true
        ? "children welcome"
        : p?.children === false
          ? "no children"
          : null,
    ].filter(Boolean);
    gtk.push({
      title: "Guests",
      body: bits.join(" · ") || "Ask us about your party",
    });
  }
  if (p?.pets != null) {
    gtk.push({
      title: "Pets & smoking",
      body: `${p.pets ? "Pets welcome" : "Assistance animals only"} · non-smoking`,
    });
  }

  // Reviews — live average + a star distribution (5→1) plus editorial cards.
  const items = reviews?.items ?? [];
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const n = items.filter((r) => Math.round(r.rating) === star).length;
    return {
      star,
      n,
      pct: items.length ? Math.round((n / items.length) * 100) : 0,
    };
  });
  const hasBars = items.length >= 3;
  const hasReviews = avg != null || items.length > 0;

  // Other suites — each unique room ONCE, dropping the current room and any dupes,
  // capped at three refined dark cards (no marquee at this scale).
  const seenRoomIds = new Set<string>([room.id]);
  const others: RoomCard[] = [];
  for (const r of otherRooms ?? []) {
    if (seenRoomIds.has(r.id)) continue;
    seenRoomIds.add(r.id);
    others.push(r);
  }
  const otherList = others.slice(0, 3);

  const eyebrow = room.propertyName?.trim() || "The suite";

  return (
    <div className="sbsuite">
      {/* breadcrumb + hero gallery */}
      <section className="gallery-sec" data-section="room_gallery">
        <div className="wrap">
          <nav className="crumb" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span aria-hidden>/</span>
            {roomsHref ? <a href={roomsHref}>Suites</a> : <span>Suites</span>}
            <span aria-hidden>/</span>
            <span className="cur">{room.name}</span>
          </nav>
          <OceansRoomGallery images={room.images} roomName={room.name} />
        </div>
      </section>

      {/* overview + sticky booking */}
      <section
        className="section overview"
        style={{ paddingTop: "clamp(40px,5vw,64px)" }}
        data-section="room_overview"
      >
        <div className="wrap">
          <div className="rd-grid">
            <div className="rd-main">
              <div className="rd-head">
                <span className="eyebrow">{eyebrow}</span>
                {ratingLabel ? (
                  <span className="rating-inline">
                    <span className="stars">★★★★★</span>
                    <span className="muted">{ratingLabel}</span>
                  </span>
                ) : null}
              </div>

              <h1 className="suite-title">{room.name}</h1>

              {lead ? <p className="lead">{lead}</p> : null}

              {chips.length ? (
                <div className="chips-row">
                  {chips.map((c, i) => (
                    <span className="chip" key={i}>
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}

              {specs.length > 0 ? (
                <div className="specs">
                  {specs.map((s, i) => (
                    <div key={i}>
                      <b>{s.value}</b>
                      {s.label ? <span>{s.label}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {bodyParas.length > 0 ? (
                <div className="rd-body">
                  {bodyParas.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ) : null}

              {room.amenities.length > 0 ? (
                <div
                  className="rd-sec"
                  data-section="room_amenities"
                  data-reveal
                >
                  <h2>In the suite</h2>
                  <div className="amenities">
                    {room.amenities.map((a, i) => (
                      <div className="amenity" key={i}>
                        <i>
                          <Check />
                        </i>
                        {a.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {seasons.length > 0 ? (
                <div className="rd-sec" data-reveal>
                  <h2>Rates &amp; seasons</h2>
                  <p>
                    Our nightly rate shifts with the seasons — the price you see
                    always includes every tax.
                  </p>
                  <div className="seas">
                    {seasons.map((s, i) => {
                      const best = s.priceFrom === minP && seasons.length > 1;
                      const peak = s.priceFrom === maxP && maxP !== minP;
                      return (
                        <div className={best ? "scard best" : "scard"} key={i}>
                          <div className="sh">
                            <span className="sn">{s.label}</span>
                            {best ? (
                              <span className="sbadge">Best value</span>
                            ) : peak ? (
                              <span className="sbadge peak">Peak</span>
                            ) : null}
                          </div>
                          {s.dates ? (
                            <div className="smo">{s.dates}</div>
                          ) : null}
                          <div className="sp">
                            {money(s.priceFrom, s.currency)}
                            <small> /night</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {gtk.length > 0 ? (
                <div
                  className="rd-sec"
                  data-section="room_policies"
                  data-reveal
                >
                  <h2>Good to know</h2>
                  <div className="gtk">
                    {gtk.map((k, i) => (
                      <div className="row" key={i}>
                        <span className="k">{k.title}</span>
                        <span className="v">{k.body}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* sticky booking card */}
            <aside data-section="room_rate">
              <OceansBookCard
                price={room.price}
                currency={room.currency}
                bookHref={room.bookHref}
                maxGuests={room.maxGuests}
                ratingLabel={ratingLabel}
              />
            </aside>
          </div>
        </div>
      </section>

      {/* reviews — summary + live distribution + cards */}
      {hasReviews ? (
        <section className="section soft-bg" data-section="reviews">
          <div className="wrap">
            <div className="sec-head" data-reveal>
              <span className="eyebrow">The guest book</span>
              <h2>
                {count
                  ? `Loved by ${commas(count)} guest${count === 1 ? "" : "s"}`
                  : "What guests write home"}
              </h2>
            </div>

            <div className={hasBars ? "revsum" : "revsum solo"} data-reveal>
              <div className="score">
                <b>{avg != null ? avg.toFixed(1) : "—"}</b>
                <span className="stars">★★★★★</span>
                <span>
                  {count
                    ? `${commas(count)} verified stay${count === 1 ? "" : "s"}`
                    : "Verified stays"}
                </span>
              </div>
              {hasBars ? (
                <div className="revbars">
                  {dist.map((d) => (
                    <div className="revbar" key={d.star}>
                      <span>
                        {d.star} star{d.star === 1 ? "" : "s"}
                      </span>
                      <div className="track">
                        <div className="fill" style={{ width: `${d.pct}%` }} />
                      </div>
                      <span className="pct">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {items.length > 0 ? (
              <div className="reviews-grid">
                {items.slice(0, 3).map((r, i) => (
                  <div
                    className="review"
                    key={i}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 3) * 90}ms` } as CSSProperties
                    }
                  >
                    <div className="rvt">
                      <span className="stars">
                        {"★".repeat(
                          Math.max(1, Math.min(5, Math.round(r.rating))),
                        )}
                      </span>
                      {r.date ? <span className="dt">{r.date}</span> : null}
                    </div>
                    <p>“{r.body}”</p>
                    <div className="who">
                      <span className="avatar">{initials(r.author)}</span>
                      <div>
                        <div className="nm">{r.author}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* other suites (cross-sell) */}
      {otherList.length > 0 ? (
        <section
          className={hasReviews ? "section" : "section soft-bg"}
          data-section="rooms_preview"
        >
          <div className="wrap">
            <div className="sec-head between" data-reveal>
              <div>
                <span className="eyebrow">You might also like</span>
                <h2>Other suites along the riverbed</h2>
              </div>
              {roomsHref ? (
                <a href={roomsHref} className="link-arrow">
                  View all suites <i>{ArrowSm}</i>
                </a>
              ) : null}
            </div>
            <div className="rooms-grid">
              {otherList.map((r, i) => {
                const price = money(r.price, r.currency);
                const facts = (r.facts ?? []).filter(Boolean);
                const tag =
                  r.badge || facts.find((f) => /sleep/i.test(f)) || null;
                return (
                  <a
                    href={r.detailHref || r.bookHref || roomsHref || "#"}
                    className="room-card"
                    key={r.id}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 3) * 90}ms` } as CSSProperties
                    }
                  >
                    <div className="rc-img">
                      {tag ? <span className="rc-tag">{tag}</span> : null}
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={siteImageUrl(r.imageUrl, { width: 800 })}
                          alt={r.name}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                    </div>
                    <div className="rc-body">
                      <h3>{r.name}</h3>
                      {facts.length ? (
                        <div className="rc-meta">
                          {facts.slice(0, 2).map((f, i) => (
                            <span key={i}>{f}</span>
                          ))}
                        </div>
                      ) : null}
                      {r.description ? (
                        <p className="rc-desc">{r.description}</p>
                      ) : null}
                      <div className="rc-foot">
                        <div className="price">
                          {price ?? "Enquire"}
                          {price ? <small> / night</small> : null}
                        </div>
                        <span className="link-arrow">
                          View <i>{ArrowSm}</i>
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
