import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgePercent,
  CalendarDays,
  Mail,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { ClaimForm } from "./ClaimForm";

export const metadata: Metadata = {
  title: "Claim your account · Vilo",
};

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams?: { c?: string; next?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Reached only via the magic link in the enquiry email / submit redirect,
  // which signs the lead in. No session → send them to log in.
  if (!user) redirect("/login?next=/claim");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, is_lead")
    .eq("id", user.id)
    .maybeSingle();

  const alreadyClaimed = profile ? profile.is_lead === false : false;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  // The enquiry thread to drop them into after claiming (passed as ?c=). Where
  // they land = the thread that holds the quote request they just sent.
  const conversationId = searchParams?.c ?? null;
  const target =
    searchParams?.next ||
    (conversationId ? `/portal/inbox/${conversationId}` : "/portal/trips");

  // Pull a small summary of that enquiry so they can SEE what they just sent.
  let enquiry: {
    hostName: string;
    listingName: string | null;
    checkIn: string | null;
    checkOut: string | null;
  } | null = null;
  if (conversationId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, host:hosts ( display_name ), listing:listings ( name )")
      .eq("id", conversationId)
      .eq("guest_id", user.id)
      .maybeSingle();
    if (conv) {
      const host = one(
        (
          conv as {
            host: { display_name: string } | { display_name: string }[] | null;
          }
        ).host,
      );
      const listing = one(
        (conv as { listing: { name: string } | { name: string }[] | null })
          .listing,
      );
      // Dates live on the quote, which guests can't read via RLS — fetch with
      // the admin client (scoped to this verified-owned conversation).
      const admin = createAdminClient();
      const { data: q } = await admin
        .from("quotes")
        .select("check_in, check_out")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      enquiry = {
        hostName: host?.display_name ?? "the host",
        listingName: listing?.name ?? null,
        checkIn: q?.check_in ?? null,
        checkOut: q?.check_out ?? null,
      };
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-light px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-brand-line bg-white p-6 shadow-card sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-gradient text-lg font-bold text-white">
            V
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-brand-ink">
            {alreadyClaimed
              ? "Your account is ready"
              : enquiry
                ? `Thanks${firstName ? `, ${firstName}` : ""} — your request is in!`
                : "Claim your account"}
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            {alreadyClaimed
              ? "You've already set a password — you can sign in any time."
              : enquiry
                ? "We've sent your details straight to the host. You'll get their reply by email and WhatsApp — usually within a few hours."
                : `Set a password${
                    firstName ? `, ${firstName}` : ""
                  } to track this quote and message the host any time.`}
          </p>
        </div>

        {/* What they just sent */}
        {enquiry ? (
          <div className="mt-5 rounded-card border border-brand-line bg-brand-light/50 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
              <MessageSquare className="h-4 w-4 text-brand-primary" />
              Request sent to {enquiry.hostName}
            </div>
            {enquiry.listingName ? (
              <div className="mt-1 text-[12.5px] text-brand-mute">
                {enquiry.listingName}
              </div>
            ) : null}
            {enquiry.checkIn ? (
              <div className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-brand-mute">
                <CalendarDays className="h-3.5 w-3.5" />
                {fmtDate(enquiry.checkIn)} → {fmtDate(enquiry.checkOut)}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          {alreadyClaimed ? (
            <Link
              href={target}
              className="inline-flex w-full items-center justify-center rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary"
            >
              {conversationId ? "Go to your request" : "Go to my trips"}
            </Link>
          ) : (
            <ClaimForm next={target} />
          )}
        </div>
      </div>
    </div>
  );
}
