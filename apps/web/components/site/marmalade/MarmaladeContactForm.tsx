"use client";

import { useState, type FormEvent } from "react";

/**
 * Marmalade House bespoke contact form — matches the founder's "Postcards"
 * reference layout (first/last, email/phone, room/guests, arrival/nights,
 * message) but posts to the SAME public endpoint the generic contact section uses
 * (/api/website-enquiry → host inbox). The extra trip fields are folded into the
 * message body so they reach the host. In the builder preview (`interactive=false`)
 * the form renders but does not submit. Scoped visually by the parent `.mmcontact`.
 */
export function MarmaladeContactForm({
  websiteId,
  interactive = false,
  rooms = [],
}: {
  websiteId?: string;
  interactive?: boolean;
  rooms?: string[];
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [room, setRoom] = useState("");
  const [guests, setGuests] = useState("2 guests");
  const [arrival, setArrival] = useState("");
  const [nights, setNights] = useState("3");
  const [note, setNote] = useState("");
  const [hp, setHp] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const live = interactive && Boolean(websiteId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!live || status === "sending") return;
    setStatus("sending");
    setError("");

    // Fold the trip details into the message so they reach the host inbox
    // (the enquiry endpoint carries name/email/phone/message only).
    const details = [
      room ? `Room: ${room}` : "",
      guests ? `Guests: ${guests}` : "",
      arrival ? `Approx. arrival: ${arrival}` : "",
      nights ? `Nights: ${nights}` : "",
    ].filter(Boolean);
    const message =
      [note.trim(), details.length ? `\n${details.join("\n")}` : ""]
        .join("")
        .trim()
        .slice(0, 2000) || "(no message)";

    try {
      const res = await fetch("/api/website-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          name: `${first} ${last}`.trim(),
          email,
          phone,
          message,
          hp,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="sent">
        <div style={{ color: "var(--site-accent, #c8702e)" }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: "0 auto" }}
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h3 style={{ fontSize: "1.6rem", marginTop: 12 }}>Message sent</h3>
        <p className="muted" style={{ marginTop: 8 }}>
          Thanks — we&apos;ll be back to you within a day. Keep an eye on your
          inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 24 }}>
      {/* Honeypot — hidden from real users; bots fill it and get dropped. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        aria-hidden
        style={{ display: "none" }}
      />

      <div className="frow">
        <div className="field">
          <label htmlFor="mm-contact-first">First name</label>
          <input
            id="mm-contact-first"
            type="text"
            required
            placeholder="Mia"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="field">
          <label htmlFor="mm-contact-last">Last name</label>
          <input
            id="mm-contact-last"
            type="text"
            placeholder="Daniels"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            maxLength={80}
          />
        </div>
      </div>

      <div className="frow">
        <div className="field">
          <label htmlFor="mm-contact-email">Email</label>
          <input
            id="mm-contact-email"
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="mm-contact-phone">Phone</label>
          <input
            id="mm-contact-phone"
            type="tel"
            placeholder="+27 ..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
          />
        </div>
      </div>

      <div className="frow">
        <div className="field">
          <label htmlFor="mm-contact-room">Room</label>
          <select
            id="mm-contact-room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          >
            <option value="">No preference</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mm-contact-guests">Guests</label>
          <select
            id="mm-contact-guests"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          >
            <option>1 guest</option>
            <option>2 guests</option>
            <option>3 guests</option>
            <option>4 guests</option>
            <option>5 guests</option>
            <option>6+ guests</option>
          </select>
        </div>
      </div>

      <div className="frow">
        <div className="field">
          <label htmlFor="mm-contact-arrival">Approx. arrival</label>
          <input
            id="mm-contact-arrival"
            type="date"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="mm-contact-nights">Nights</label>
          <input
            id="mm-contact-nights"
            type="number"
            min={1}
            value={nights}
            onChange={(e) => setNights(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="mm-contact-note">Anything else?</label>
        <textarea
          id="mm-contact-note"
          placeholder="Anniversary, an early check-in, dietary things, the dog..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1500}
        />
      </div>

      {status === "error" ? (
        <p
          style={{
            color: "#dc2626",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-accent btn-lg"
        disabled={!live || status === "sending"}
        style={!live ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
      {!live ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          This form is interactive on your published site.
        </p>
      ) : null}
    </form>
  );
}
