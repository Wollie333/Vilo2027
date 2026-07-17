import "./oceansRoom.css";

import type {
  ReviewsData,
  RoomCard,
  RoomDetail,
  SeasonalPricingData,
} from "@/lib/site/types";

import { OceansBookCard } from "./OceansBookCard";
import { OceansRoomGallery } from "./OceansRoomGallery";

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
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

type GoodToKnow = { icon: React.ReactNode; title: string; body: string };

/**
 * Oceans View room-detail page — the founder's bespoke reference design, wired
 * to the host's real room: mosaic gallery + lightbox, title/specs, "in the room"
 * amenities, seasonal rate cards, a "good to know" grid, a sticky booking card,
 * a review summary with a live star-distribution, and an "other rooms" marquee.
 * Renders INSIDE the themed chrome (nav/footer come from SiteChrome).
 */
export function OceansViewRoomDetail({
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
    // Skip a fact that just repeats the guest count.
    if (/guest/i.test(s.label) && s.value === String(room.maxGuests ?? ""))
      continue;
    specs.push(s);
  }

  // Rating line for the booking card + review summary.
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

  // Good-to-know from the room's policies (only cards that have data).
  const p = room.policies ?? null;
  const gtk: GoodToKnow[] = [];
  if (p?.checkIn || p?.checkOut) {
    const bits = [
      p.checkIn ? `From ${p.checkIn}` : null,
      p.checkOut ? `until ${p.checkOut}` : null,
    ].filter(Boolean);
    gtk.push({
      title: "Check-in & out",
      body: bits.join(" · "),
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      ),
    });
  }
  if (p?.cancellation) {
    gtk.push({
      title: "Cancellation",
      body: p.cancellation,
      icon: <Check />,
    });
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
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    });
  }
  if (p?.pets != null) {
    gtk.push({
      title: "Pets & smoking",
      body: `${p.pets ? "Pets welcome" : "Assistance animals only"} · non-smoking`,
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M10 5.5c1.8-2 4.7-2 6.5 0 1.8 2 1.8 5 0 7L12 17l-4.5-4.5c-1.8-2-1.8-5 0-7 .9-1 2.1-1.5 3.2-1.5" />
        </svg>
      ),
    });
  }

  // Review star distribution (live) — % of ratings at each star, 5→1.
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

  // Other rooms — dedupe the current room out, then build the marquee track:
  // repeat the set until it comfortably overflows the viewport (so it never runs
  // out and looks static/left-aligned), then duplicate that whole run ONCE so the
  // leftward scroll loops seamlessly (the track animates by exactly -50%).
  const others = (otherRooms ?? []).filter((r) => r.id !== room.id);
  const base = others.length
    ? Array.from({ length: Math.max(2, Math.ceil(5 / others.length)) }).flatMap(
        () => others,
      )
    : [];
  const loop = base.length ? [...base, ...base] : [];

  const tag =
    room.facts[0] && !/^sleeps/i.test(room.facts[0]) ? room.facts[0] : null;

  return (
    <div className="ovroom">
      {/* breadcrumbs */}
      <section className="wrap">
        <nav className="rcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span className="sep">/</span>
          {roomsHref ? <a href={roomsHref}>Rooms</a> : <span>Rooms</span>}
          <span className="sep">/</span>
          <span className="cur">{room.name}</span>
        </nav>
      </section>

      {/* gallery */}
      <section className="wrap">
        <OceansRoomGallery images={room.images} roomName={room.name} />
      </section>

      {/* title + booking */}
      <section
        className="section"
        style={{ paddingTop: "clamp(44px,5vw,64px)" }}
      >
        <div className="wrap">
          <div className="rlayout">
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                {tag ? <span className="tag">{tag}</span> : null}
                {ratingLabel ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--site-mute)",
                    }}
                  >
                    <span className="stars">★★★★★</span> {ratingLabel}
                  </span>
                ) : null}
              </div>
              <h1
                className="xl"
                style={{ marginTop: 14, fontSize: "clamp(2.4rem,5vw,4rem)" }}
              >
                {room.name}
              </h1>
              {lead ? (
                <p className="lead" style={{ marginTop: 18 }}>
                  {lead}
                </p>
              ) : null}

              {specs.length > 0 ? (
                <div className="specs">
                  {specs.map((s, i) => (
                    <div className="spec" key={i}>
                      <b>{s.value}</b>
                      {s.label ? <span>{s.label}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {bodyParas.length > 0 ? (
                <div style={{ marginTop: specs.length ? 8 : 24 }}>
                  {bodyParas.map((para, i) => (
                    <p
                      key={i}
                      className="muted"
                      style={{
                        marginTop: i === 0 ? 0 : 16,
                        maxWidth: "60ch",
                        lineHeight: 1.6,
                      }}
                    >
                      {para}
                    </p>
                  ))}
                </div>
              ) : null}

              {room.amenities.length > 0 ? (
                <div style={{ marginTop: 44 }}>
                  <h2
                    className="lg"
                    style={{ fontSize: "clamp(1.6rem,3vw,2.3rem)" }}
                  >
                    In the room
                  </h2>
                  <div className="amen" style={{ marginTop: 22 }}>
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
                <div style={{ marginTop: 44 }}>
                  <h2
                    className="lg"
                    style={{ fontSize: "clamp(1.6rem,3vw,2.3rem)" }}
                  >
                    Seasonal rates
                  </h2>
                  <p
                    className="muted"
                    style={{ marginTop: 14, maxWidth: "56ch" }}
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
                <div style={{ marginTop: 44 }}>
                  <h2
                    className="lg"
                    style={{ fontSize: "clamp(1.6rem,3vw,2.3rem)" }}
                  >
                    Good to know
                  </h2>
                  <div className="gtk">
                    {gtk.map((k, i) => (
                      <div className="k" key={i}>
                        {k.icon}
                        <div>
                          <b>{k.title}</b>
                          <span>{k.body}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* booking card */}
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

      {/* reviews */}
      {avg != null || items.length > 0 ? (
        <section
          className="section sand"
          style={{ paddingTop: "clamp(56px,7vw,96px)" }}
        >
          <div className="wrap">
            <div
              className="sec-head"
              style={{ maxWidth: "none", marginBottom: "clamp(28px,4vw,44px)" }}
            >
              <span className="tag">Guest reviews</span>
              <h2 className="lg" style={{ marginTop: 16 }}>
                {count
                  ? `Loved by ${commas(count)} guest${count === 1 ? "" : "s"}`
                  : "What guests say"}
              </h2>
            </div>

            <div className={hasBars ? "revsum" : "revsum solo"}>
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
              <div className="revgrid">
                {items.slice(0, 4).map((r, i) => (
                  <div className="rvc" key={i}>
                    <div className="rvt">
                      <span className="stars">
                        {"★★★★★".slice(0, Math.max(1, Math.round(r.rating)))}
                      </span>
                      {r.date ? <span className="rvd">{r.date}</span> : null}
                    </div>
                    <p>“{r.body}”</p>
                    <div className="who">
                      <span className="av">{initials(r.author)}</span>
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

      {/* other rooms */}
      {others.length > 0 ? (
        <section className="section">
          <div className="wrap">
            <div
              className="sec-head"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                maxWidth: "none",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div>
                <span className="tag">Also available</span>
                <h2 className="lg" style={{ marginTop: 16 }}>
                  The other rooms
                </h2>
              </div>
              {roomsHref ? (
                <a href={roomsHref} className="alink">
                  All rooms
                  <svg
                    width="17"
                    height="17"
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
                </a>
              ) : null}
            </div>
          </div>
          <div className="marquee" aria-label="More rooms">
            <div className="marquee-track">
              {loop.map((r, i) => (
                <a
                  href={r.bookHref || roomsHref || "#"}
                  className="room"
                  key={i}
                  aria-hidden={i >= others.length ? true : undefined}
                >
                  <div className="room-img">
                    {money(r.price, r.currency) ? (
                      <span className="room-price">
                        {money(r.price, r.currency)}
                        <small>/night</small>
                      </span>
                    ) : null}
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageUrl} alt={r.name} />
                    ) : null}
                  </div>
                  <div className="room-body">
                    <h3>{r.name}</h3>
                    {r.facts && r.facts.length > 0 ? (
                      <div className="room-feat">
                        {r.facts.slice(0, 2).map((f, j) => (
                          <span className="chip" key={j}>
                            {f}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {r.description ? <p>{r.description}</p> : null}
                    <div className="room-foot">
                      <span className="alink">
                        View room
                        <svg
                          width="16"
                          height="16"
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
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
