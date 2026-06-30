"use client";

import { useState, type FormEvent } from "react";

import { siteThankYouHref } from "@/lib/site/thankYouHref";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import type { MarmaladeCtx } from "./MarmaladeSections";

type ContactFormProps = Extract<
  WebsiteSection,
  { type: "contact_form" }
>["props"];

/**
 * The Marmalade House ("marmalade" theme) contact band — a REAL lead-capture form.
 * Posts the live website id to /api/website-enquiry (host resolved server-side),
 * then redirects to the themed enquiry thank-you page (same conversion-goal loop
 * as the generic `form` block). In the builder/preview it renders but does not
 * submit. Styling stays scoped to `.wielo-marmalade` (.cgrid / .dcard / .drow /
 * .field / .frow), driven by `--site-*`.
 */
export function MarmaladeContactForm({
  props,
  ctx,
  websiteId,
  interactive = false,
}: {
  props: ContactFormProps;
  ctx?: MarmaladeCtx;
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
  const [hp, setHp] = useState("");
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
          <div key={d.title + i} className="drow">
            <span className="ic">
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
            <div key="auto-phone" className="drow">
              <span className="ic">{PHONE_ICON}</span>
              <div>
                <div className="t">{phone}</div>
                <div className="d">Reservations</div>
              </div>
            </div>
          ) : null,
          email ? (
            <div key="auto-email" className="drow">
              <span className="ic">{EMAIL_ICON}</span>
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
        <div className="cgrid">
          <div>
            <span className="tag">{props.eyebrow || "Send a message"}</span>
            <h2 className="lg" style={{ marginTop: 12 }}>
              {props.heading || "Say hello"}
            </h2>
            {props.body ? (
              <p className="muted" style={{ marginTop: 14, maxWidth: "52ch" }}>
                {props.body}
              </p>
            ) : null}
            <form style={{ marginTop: 28 }} onSubmit={onSubmit}>
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
              <div className="frow">
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
              <div className="frow">
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
              <div className="frow">
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
                <label>Anything else?</label>
                <textarea
                  placeholder="Dates, the occasion, what you are hoping for..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              {status === "error" ? (
                <p
                  style={{ color: "#d9534f", fontSize: 14, marginBottom: 14 }}
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="btn btn-coral btn-lg"
                disabled={!live || status === "sending"}
              >
                <span>
                  {status === "sending"
                    ? "Sending…"
                    : props.submit_label || "Send message"}
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
            <div className="dcard">{detailRows}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const PHONE_ICON = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
const EMAIL_ICON = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
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
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
