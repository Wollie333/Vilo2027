import "./marmaladeRoom.css";

import { siteImageUrl } from "@/lib/site/image";

import type {
  ReviewsData,
  RoomCard,
  RoomDetail,
  SeasonalPricingData,
} from "@/lib/site/types";

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

type GoodToKnow = { title: string; body: string };

/**
 * Marmalade House room-detail page — the founder's bespoke "Postcards" reference
 * design, wired to the host's real room: mosaic gallery + lightbox, title/specs,
 * "in the room" amenities, seasonal rate cards, a "good to know" list, a sticky
 * booking card, pinned-postcard reviews and an "other rooms" postcard row.
 * Renders INSIDE the themed chrome (nav/footer come from SiteChrome). Scoped
 * under `.mmroom`. Reuses the shared interactive gallery + booking card (styled
 * here under `.mmroom`); everything else is server-rendered marmalade markup.
 */
export function MarmaladeRoomDetail({
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
        .map((p) => p.trim())
        .filter(Boolean)
    : [];
  const lead = paras[0] ?? "";
  const bodyParas = paras.slice(1);

  // Specs — guests first (from maxGuests), then up to three more from the facts.
  const specs: { value: string; label: string }[] = [];
  if (room.maxGuests)
    specs.push({ value: String(room.maxGuests), label: "Guests" });
  for (const f of room.facts) {
    if (specs.length >= 4) break;
    const s = splitFact(f);
    if (/guest/i.test(s.label) && s.value === String(room.maxGuests ?? ""))
      continue;
    specs.push(s);
  }

  // Rating line for the booking card + review header.
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
      title: "Pets",
      body: `${p.pets ? "Pets welcome" : "Assistance animals only"} · non-smoking`,
    });
  }

  // Review items (live) — shown as pinned postcards.
  const items = reviews?.items ?? [];

  // Other rooms — each unique room ONCE, dropping the current room and any dupes.
  const seenRoomIds = new Set<string>([room.id]);
  const others: RoomCard[] = [];
  for (const r of otherRooms ?? []) {
    if (seenRoomIds.has(r.id)) continue;
    seenRoomIds.add(r.id);
    others.push(r);
  }
  const otherList = others.slice(0, 3);

  const tag =
    room.facts[0] && !/^sleeps/i.test(room.facts[0]) ? room.facts[0] : null;

  return (
    <div className="mmroom">
      {/* breadcrumbs */}
      <section className="wrap">
        <nav className="rcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span className="sep">·</span>
          {roomsHref ? <a href={roomsHref}>Rooms</a> : <span>Rooms</span>}
          <span className="sep">·</span>
          <span className="cur">{room.name}</span>
        </nav>
      </section>

      {/* gallery (mosaic + lightbox) */}
      <section className="wrap">
        <OceansRoomGallery images={room.images} roomName={room.name} />
      </section>

      {/* title + booking */}
      <section
        className="section"
        style={{ paddingTop: "clamp(36px,4vw,56px)" }}
      >
        <div className="wrap">
          <div className="rlay">
            <div>
              <div className="rhead">
                <span className="eyebrow">
                  {tag ??
                    (room.maxGuests ? `Sleeps ${room.maxGuests}` : "The room")}
                </span>
                {ratingLabel ? (
                  <span className="rrate">
                    <span className="stars">★★★★★</span> {ratingLabel}
                  </span>
                ) : null}
              </div>
              <h1>{room.name}</h1>
              {lead ? (
                <p className="lead" style={{ marginTop: 16 }}>
                  {lead}
                </p>
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
                <div style={{ marginTop: specs.length ? 0 : 24 }}>
                  {bodyParas.map((para, i) => (
                    <p
                      key={i}
                      className="muted"
                      style={{
                        marginTop: i === 0 ? 0 : 16,
                        maxWidth: "58ch",
                        lineHeight: 1.6,
                      }}
                    >
                      {para}
                    </p>
                  ))}
                </div>
              ) : null}

              {room.amenities.length > 0 ? (
                <div style={{ marginTop: 40 }} data-reveal>
                  <h2
                    className="lg"
                    style={{ fontSize: "clamp(1.5rem,3vw,2.1rem)" }}
                  >
                    In the room
                  </h2>
                  <div className="amen" style={{ marginTop: 20 }}>
                    {room.amenities.map((a, i) => (
                      <div className="a" key={i}>
                        <Check />
                        {a.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {seasons.length > 0 ? (
                <div style={{ marginTop: 40 }} data-reveal>
                  <h2
                    className="lg"
                    style={{ fontSize: "clamp(1.5rem,3vw,2.1rem)" }}
                  >
                    Rates &amp; seasons
                  </h2>
                  <p
                    className="muted"
                    style={{ marginTop: 12, maxWidth: "56ch" }}
                  >
                    Our nightly rate shifts with the seasons — the price you see
                    always includes every tax, with no booking fees.
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
                              <span
                                className="sbadge"
                                style={{ background: "var(--site-secondary)" }}
                              >
                                Peak
                              </span>
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
                <div style={{ marginTop: 40 }} data-reveal>
                  <h2
                    className="lg"
                    style={{ fontSize: "clamp(1.5rem,3vw,2.1rem)" }}
                  >
                    Good to know
                  </h2>
                  <div className="gtk" style={{ marginTop: 16 }}>
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
            <aside>
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

      {/* reviews (pinned postcards) */}
      {items.length > 0 ? (
        <section className="section soft">
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="hand">the guest book</span>
              <h2>
                {count
                  ? `Loved by ${commas(count)} guest${count === 1 ? "" : "s"}`
                  : "What guests write home"}
              </h2>
            </div>
            <div className="reviews" data-reveal>
              {items.slice(0, 3).map((r, i) => (
                <div className="review" key={i}>
                  <span
                    className={i === 1 ? "tape b" : "tape"}
                    style={{
                      left: "50%",
                      top: -12,
                      transform: "translateX(-50%) rotate(-3deg)",
                    }}
                  />
                  <div className="stars">
                    {"★".repeat(Math.max(1, Math.min(5, Math.round(r.rating))))}
                  </div>
                  <p>{r.body}</p>
                  <div className="who">
                    <span className="av">{initials(r.author)}</span>
                    <div>
                      <div className="nm">{r.author}</div>
                      {r.date ? <div className="lo">{r.date}</div> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* other rooms (postcards) */}
      {otherList.length > 0 ? (
        <section className="section">
          <div className="wrap">
            <div className="sec-head center" data-reveal>
              <span className="hand">also free those nights</span>
              <h2>The other rooms</h2>
            </div>
            <div className="pcgrid" data-reveal>
              {otherList.map((r) => (
                <a
                  href={r.detailHref || r.bookHref || roomsHref || "#"}
                  className="pc"
                  key={r.id}
                >
                  <div className="pi">
                    {money(r.price, r.currency) ? (
                      <span className="pcprice">
                        {money(r.price, r.currency)}
                      </span>
                    ) : null}
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
                  <div className="cap">{r.name}</div>
                  {r.facts?.length ? (
                    <div className="meta">
                      {r.facts.slice(0, 2).join(" · ")}
                    </div>
                  ) : null}
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
