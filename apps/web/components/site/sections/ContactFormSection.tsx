"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted } from "./_shared";

type Props = Extract<WebsiteSection, { type: "contact_form" }>["props"];

const fieldStyle: CSSProperties = {
  background: "var(--site-bg)",
  borderColor: "var(--site-line)",
  color: "var(--site-ink)",
  borderRadius: "var(--site-radius)",
};

/**
 * Public lead-capture form. On submit it posts the live website id to
 * /api/website-enquiry, which opens a "Website Enquiry" in the host inbox (the
 * host is resolved server-side — nothing here is trusted). In the builder preview
 * (`interactive=false`) the form renders but does not submit.
 */
export function ContactFormSection({
  props,
  websiteId,
  interactive = false,
}: {
  props: Props;
  websiteId?: string;
  interactive?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
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
    try {
      const res = await fetch("/api/website-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          name,
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
      <SectionShell surface width="narrow">
        <div
          style={{
            borderColor: "var(--site-line)",
            background: "var(--site-surface)",
            borderRadius: "var(--site-radius)",
          }}
          className="border p-8 text-center"
        >
          <p
            style={{ color: "var(--site-ink)" }}
            className="text-lg font-semibold"
          >
            {props.success_message}
          </p>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell surface width="narrow">
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {props.body ? (
        <Muted className="mb-8 text-center text-base">{props.body}</Muted>
      ) : null}

      <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4">
        {/* Honeypot — hidden from real users; bots fill it and get dropped. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="hidden"
          aria-hidden
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={120}
            style={fieldStyle}
            className="w-full border px-4 py-3 text-sm outline-none"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            maxLength={200}
            style={fieldStyle}
            className="w-full border px-4 py-3 text-sm outline-none"
          />
        </div>
        {props.show_phone ? (
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            maxLength={40}
            style={fieldStyle}
            className="w-full border px-4 py-3 text-sm outline-none"
          />
        ) : null}
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          maxLength={2000}
          rows={5}
          style={fieldStyle}
          className="w-full resize-y border px-4 py-3 text-sm outline-none"
        />

        {status === "error" ? (
          <p className="text-sm font-medium text-red-600">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={!live || status === "sending"}
          style={{
            background: "var(--site-btn-primary-bg)",
            color: "var(--site-btn-primary-color)",
            border: "var(--site-btn-primary-border)",
            borderRadius: "var(--site-btn-primary-radius)",
          }}
          className="inline-flex w-full items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          {status === "sending" ? "Sending…" : props.submit_label}
        </button>
        {!live ? (
          <p style={{ color: "var(--site-mute)" }} className="text-xs">
            This form is interactive on your published site.
          </p>
        ) : null}
      </form>
    </SectionShell>
  );
}
