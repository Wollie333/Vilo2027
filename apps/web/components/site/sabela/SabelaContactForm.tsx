"use client";

import { useState, type FormEvent } from "react";

import { siteThankYouHref } from "@/lib/site/thankYouHref";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import type { SabelaCtx } from "./SabelaSections";

type ContactFormProps = Extract<
  WebsiteSection,
  { type: "contact_form" }
>["props"];

/**
 * The Sabela Lodge ("sabela" theme) contact band — a REAL lead-capture form.
 * On submit it posts the live website id to /api/website-enquiry (the host is
 * resolved server-side — nothing here is trusted), opens a "Website Enquiry" in
 * the host inbox, then redirects to the themed enquiry thank-you page so the
 * Sabela form completes the same conversion-goal loop as the generic `form`
 * block. In the builder canvas / preview (`interactive=false`) it renders but
 * does not submit. Styling stays scoped to `.wielo-sabela` (the `.contact-grid`/
 * `.contact-aside`/`.field` classes live in sabela.css), driven by `--site-*`.
 */
export function SabelaContactForm({
  props,
  ctx,
  websiteId,
  interactive = false,
}: {
  props: ContactFormProps;
  ctx?: SabelaCtx;
  websiteId?: string;
  interactive?: boolean;
}) {
  const email = ctx?.contactEmail?.trim();
  const phone = ctx?.contactPhone?.trim();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [phoneVal, setPhoneVal] = useState("");
  const [arrival, setArrival] = useState("");
  const [nights, setNights] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  const live = interactive && Boolean(websiteId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!live || status === "sending") return;
    setStatus("sending");
    setError("");
    const name = `${first} ${last}`.trim();
    const extra = [
      arrival ? `Approx. arrival: ${arrival}` : "",
      nights ? `Nights: ${nights}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const fullMessage =
      [message.trim(), extra].filter(Boolean).join("\n\n") ||
      "Enquiry from the website.";
    try {
      const res = await fetch("/api/website-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          name,
          email: emailVal,
          phone: phoneVal,
          message: fullMessage,
          hp,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        window.location.assign(
          siteThankYouHref({
            goal: "enquiry",
            name: first.trim() || undefined,
          }),
        );
        return;
      }
      setStatus("error");
      setError(data.error || "Something went wrong. Please try again.");
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Please try again.");
    }
  }

  const custom = props.details?.filter((d) => d.title?.trim()) ?? [];
  const detailRows =
    custom.length > 0
      ? custom.map((d, i) => (
          <div key={d.title + i} className="contact-item">
            <span className="ci-ic">
              {d.icon?.trim() ? (
                <span style={{ fontSize: 20, lineHeight: 1 }}>{d.icon}</span>
              ) : (
                PIN_ICON
              )}
            </span>
            <div>
              <div className="t">{d.title}</div>
              {d.label?.trim() ? <div className="d">{d.label}</div> : null}
            </div>
          </div>
        ))
      : [
          phone ? (
            <div key="auto-phone" className="contact-item">
              <span className="ci-ic">{PHONE_ICON}</span>
              <div>
                <div className="t">{phone}</div>
                <div className="d">Reservations</div>
              </div>
            </div>
          ) : null,
          email ? (
            <div key="auto-email" className="contact-item">
              <span className="ci-ic">{EMAIL_ICON}</span>
              <div>
                <div className="t">{email}</div>
                <div className="d">We reply within one day</div>
              </div>
            </div>
          ) : null,
        ];

  return (
    <section className="section" data-section="form">
      <div className="wrap">
        <div className="contact-grid">
          <div>
            <span className="eyebrow">{props.eyebrow || "Send a message"}</span>
            <h2
              style={{
                marginTop: 16,
                fontSize: "clamp(1.9rem,3.6vw,2.8rem)",
              }}
            >
              {props.heading || "Enquire & hold dates"}
            </h2>
            {props.body ? (
              <p className="muted" style={{ marginTop: 16, maxWidth: "52ch" }}>
                {props.body}
              </p>
            ) : null}
            <form style={{ marginTop: 30 }} onSubmit={onSubmit}>
              {/* Honeypot — hidden from real users; bots fill it and get dropped. */}
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                style={{ display: "none" }}
                aria-hidden
              />
              <div className="field-row">
                <div className="field">
                  <label>First name</label>
                  <input
                    type="text"
                    placeholder="First name"
                    required
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Last name</label>
                  <input
                    type="text"
                    placeholder="Last name"
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="you@email.com"
                    required
                    value={emailVal}
                    onChange={(e) => setEmailVal(e.target.value)}
                  />
                </div>
                {props.show_phone !== false ? (
                  <div className="field">
                    <label>Phone</label>
                    <input
                      type="tel"
                      placeholder="+27 ..."
                      value={phoneVal}
                      onChange={(e) => setPhoneVal(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Approx. arrival</label>
                  <input
                    type="date"
                    value={arrival}
                    onChange={(e) => setArrival(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Nights</label>
                  <input
                    type="number"
                    min="1"
                    value={nights}
                    onChange={(e) => setNights(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label>Anything we should know?</label>
                <textarea
                  placeholder="Dates, the occasion, dietary needs, transfers..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              {status === "error" ? (
                <p
                  style={{ color: "#e07a5f", fontSize: 14, marginBottom: 14 }}
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={!live || status === "sending"}
              >
                <span>
                  {status === "sending"
                    ? "Sending…"
                    : props.submit_label || "Send enquiry"}
                </span>
              </button>
              {!live ? (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: "var(--site-mute)",
                  }}
                >
                  This form is interactive on your published site.
                </p>
              ) : null}
            </form>
          </div>
          {props.show_details !== false ? (
            <div className="contact-aside">
              {detailRows}
              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: "var(--site-accent)", flexShrink: 0 }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <p style={{ fontSize: 14, color: "var(--site-mute)" }}>
                  Book direct and you pay exactly what we quote — no agents, no
                  booking fees, no commission.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const PHONE_ICON = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
const EMAIL_ICON = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </svg>
);
const PIN_ICON = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
