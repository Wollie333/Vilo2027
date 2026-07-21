import "./safariRoom.css";

import type { CSSProperties } from "react";

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
  if (parts.length === 0) return "—";
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
    width="18"
    height="18"
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

const Arrow = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

type GoodToKnow = { icon: React.ReactNode; title: string; body: string };

/**
 * Safari (NenGama Lodge) room-detail page (preset `safari`) — its own component
 * + stylesheet (`.sfroom` / safariRoom.css): an editorial, left-aligned lodge
 * treatment (oversized serif title, hairline-ruled spec row, editorial section
 * heads) distinct from the OceansView + Royal room-detail. Reuses the shared
 * OceansRoomGallery (inline lightbox) + OceansBookCard. Wired to the host's real
 * room: gallery, title/specs, amenities, seasonal rates, good-to-know, a sticky
 * booking card, a live review summary, and an "other rooms" strip. Phase B.
 */
export function SafariRoomDetail({
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

  // Other rooms — each unique room shown ONCE (drop the current room + dedupe).
  const seenRoomIds = new Set<string>([room.id]);
  const others: RoomCard[] = [];
  for (const r of otherRooms ?? []) {
    if (seenRoomIds.has(r.id)) continue;
    seenRoomIds.add(r.id);
    others.push(r);
  }

  const tag =
    room.facts[0] && !/^sleeps/i.test(room.facts[0]) ? room.facts[0] : null;

  return (
    <div className="sfroom">
      {/* breadcrumbs */}
      <section className="wrap">
        <div className="sf-coverline">
          <span className="sf-folio">The Field Journal · {room.name}</span>
        </div>
        <nav className="sf-crumbs" aria-label="Breadcrumb">
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
      <section className="sf-sec sf-sec-top">
        <div className="wrap">
          <div className="sf-layout">
            <div className="sf-main">
              <div className="sf-title-meta">
                {tag ? <span className="sf-eyebrow">{tag}</span> : null}
                {ratingLabel ? (
                  <span className="sf-rating">
                    <em className="stars">★</em> {ratingLabel}
                  </span>
                ) : null}
              </div>
              <h1>{room.name}</h1>
              {lead ? <p className="sf-lead sf-drop">{lead}</p> : null}

              {specs.length > 0 ? (
                <div className="sf-specs">
                  {specs.map((s, i) => (
                    <div className="sf-spec" key={i}>
                      <b>{s.value}</b>
                      {s.label ? <span>{s.label}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {bodyParas.length > 0 ? (
                <div className="sf-body">
                  {bodyParas.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ) : null}

              {room.amenities.length > 0 ? (
                <div className="sf-block" data-reveal>
                  <h2 className="sf-h3">In the room</h2>
                  <div className="sf-amen">
                    {room.amenities.map((a, i) => (
                      <div className="sf-a" key={i}>
                        <Check />
                        {a.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {seasons.length > 0 ? (
                <div className="sf-block" data-reveal>
                  <h2 className="sf-h3">Seasonal rates</h2>
                  <p className="sf-muted">
                    Our nightly rate shifts with the seasons — the price you see
                    always includes every tax.
                  </p>
                  <div className="sf-seas">
                    {seasons.map((s, i) => {
                      const best = s.priceFrom === minP && seasons.length > 1;
                      const peak = s.priceFrom === maxP && maxP !== minP;
                      return (
                        <div
                          className={best ? "sf-scard best" : "sf-scard"}
                          key={i}
                        >
                          <div className="sf-sh">
                            <span className="sf-sn">{s.label}</span>
                            {best ? (
                              <span className="sf-sbadge">Best value</span>
                            ) : peak ? (
                              <span className="sf-sbadge peak">Peak</span>
                            ) : null}
                          </div>
                          {s.dates ? (
                            <div className="sf-smo">{s.dates}</div>
                          ) : null}
                          <div className="sf-sp">
                            {money(s.priceFrom, s.currency)}
                            <small> / night</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {gtk.length > 0 ? (
                <div className="sf-block" data-reveal>
                  <h2 className="sf-h3">Good to know</h2>
                  <div className="sf-gtk">
                    {gtk.map((k, i) => (
                      <div className="sf-k" key={i}>
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
            <aside className="sf-aside">
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
        <section className="sf-sec sf-sand">
          <div className="wrap">
            <div className="sf-sechead" data-reveal>
              <span className="sf-secnum" aria-hidden>
                I
              </span>
              <span className="sf-eyebrow">Guest words</span>
              <h2 className="sf-h2">
                {count
                  ? `Loved by ${commas(count)} guest${count === 1 ? "" : "s"}`
                  : "What guests say"}
              </h2>
            </div>

            <div
              className={hasBars ? "sf-revsum" : "sf-revsum solo"}
              data-reveal
            >
              <div className="sf-score">
                <b>{avg != null ? avg.toFixed(1) : "—"}</b>
                <span className="stars">★★★★★</span>
                <span className="sf-score-c">
                  {count
                    ? `${commas(count)} verified stay${count === 1 ? "" : "s"}`
                    : "Verified stays"}
                </span>
              </div>
              {hasBars ? (
                <div className="sf-revbars">
                  {dist.map((d) => (
                    <div className="sf-revbar" key={d.star}>
                      <span>
                        {d.star} star{d.star === 1 ? "" : "s"}
                      </span>
                      <div className="sf-track">
                        <div
                          className="sf-fill"
                          style={{ width: `${d.pct}%` }}
                        />
                      </div>
                      <span className="sf-pct">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {items.length > 0 ? (
              <div className="sf-revgrid">
                {items.slice(0, 4).map((r, i) => (
                  <figure
                    className="sf-rvc"
                    key={i}
                    data-reveal
                    style={
                      { "--reveal-delay": `${(i % 2) * 90}ms` } as CSSProperties
                    }
                  >
                    <div className="sf-rvt">
                      <span className="stars">
                        {"★★★★★".slice(0, Math.max(1, Math.round(r.rating)))}
                      </span>
                      {r.date ? <span className="sf-rvd">{r.date}</span> : null}
                    </div>
                    <blockquote>{r.body}</blockquote>
                    <figcaption>
                      <span className="sf-av">{initials(r.author)}</span>
                      <b>{r.author}</b>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* other rooms */}
      {others.length > 0 ? (
        <section className="sf-sec">
          <div className="wrap">
            <div className="sf-sechead sf-sechead-row" data-reveal>
              <div>
                <span className="sf-secnum" aria-hidden>
                  II
                </span>
                <span className="sf-eyebrow">Also available</span>
                <h2 className="sf-h2">The other rooms</h2>
              </div>
              {roomsHref ? (
                <a href={roomsHref} className="sf-alink">
                  All rooms {Arrow}
                </a>
              ) : null}
            </div>
            <div className="sf-others">
              {others.slice(0, 3).map((r, i) => (
                <a
                  href={r.detailHref || r.bookHref || roomsHref || "#"}
                  className="sf-oc"
                  key={i}
                  data-reveal
                  style={
                    { "--reveal-delay": `${(i % 3) * 80}ms` } as CSSProperties
                  }
                >
                  <div className="sf-oc-fig">
                    {money(r.price, r.currency) ? (
                      <span className="sf-oc-price">
                        {money(r.price, r.currency)}
                        <small>/night</small>
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
                  <div className="sf-oc-body">
                    <h3>{r.name}</h3>
                    {r.facts && r.facts.length > 0 ? (
                      <div className="sf-oc-facts">
                        {r.facts.slice(0, 2).map((f, j) => (
                          <span key={j}>{f}</span>
                        ))}
                      </div>
                    ) : null}
                    <span className="sf-alink">View room {Arrow}</span>
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
