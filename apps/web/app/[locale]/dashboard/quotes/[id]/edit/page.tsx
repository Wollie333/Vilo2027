import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { QuoteForm } from "../../QuoteForm";
import {
  QuoteRequestCard,
  type QuoteRequestContext,
} from "../../QuoteRequestCard";
import { loadQuoteFormListings } from "../../_listings";

export const metadata: Metadata = {
  title: "Edit quote",
};

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/quotes/${params.id}/edit`);

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) notFound();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, listing_id, status, guest_id, guest_name, guest_email, guest_phone, check_in, check_out, headcount, scope, price_mode, base_amount, cleaning_fee, notes, guests_breakdown, discount_type, discount_value, discount_reason, deposit_type, deposit_pct, balance_due_days, conversation_id, created_at",
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quote) notFound();
  if (quote.status !== "draft" && quote.status !== "sent") {
    redirect(`/dashboard/quotes/${params.id}`);
  }

  const [{ data: qrooms }, { data: qaddons }] = await Promise.all([
    supabase
      .from("quote_rooms")
      .select("room_id, base_amount, cleaning_fee")
      .eq("quote_id", params.id),
    supabase
      .from("quote_addons")
      .select("addon_id, label, quantity, unit_price, kind")
      .eq("quote_id", params.id)
      .order("sort_order"),
  ]);

  const list = await loadQuoteFormListings(supabase, host.id, quote.id);

  // If this quote came from a guest's public "Request a quote" enquiry (only
  // those carry a conversation_id), surface what they originally asked for —
  // their own message, who they are, the requested stay, party + add-ons — as
  // read-only context above the form. This card is the ONLY thing that differs
  // between "new quote" and "respond to a request".
  const matchedListing = list.find((l) => l.id === quote.listing_id) ?? null;
  let requestCtx: QuoteRequestContext | null = null;
  if (quote.conversation_id) {
    const today = new Date().toISOString().slice(0, 10);
    const guestMatch = quote.guest_id
      ? `guest_id.eq.${quote.guest_id}`
      : quote.guest_email
        ? `guest_email.ilike.${quote.guest_email}`
        : null;

    const [
      { data: firstMsg },
      { data: priorBookings },
      { data: gProfile },
      { data: blocks },
    ] = await Promise.all([
      supabase
        .from("messages")
        .select("body")
        .eq("conversation_id", quote.conversation_id)
        .eq("is_system_message", false)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      // Prior stays with THIS host (stays count + most recent past checkout).
      guestMatch
        ? supabase
            .from("bookings")
            .select("check_out, status")
            .eq("host_id", host.id)
            .or(guestMatch)
            .not(
              "status",
              "in",
              "(cancelled_by_host,cancelled_by_guest,declined,expired)",
            )
        : Promise.resolve({
            data: [] as { check_out: string; status: string }[],
          }),
      quote.guest_id
        ? supabase
            .from("user_profiles")
            .select("avatar_url")
            .eq("id", quote.guest_id)
            .maybeSingle()
        : Promise.resolve({
            data: null as { avatar_url: string | null } | null,
          }),
      // Are the requested dates free? Any block in [check_in, check_out) that
      // isn't this quote's own soft-hold means not fully open.
      quote.check_in && quote.check_out
        ? supabase
            .from("blocked_dates")
            .select("date")
            .eq("listing_id", quote.listing_id)
            .gte("date", quote.check_in)
            .lt("date", quote.check_out)
            .or(`quote_id.is.null,quote_id.neq.${quote.id}`)
            .limit(1)
        : Promise.resolve({ data: [] as { date: string }[] }),
    ]);

    const stayRows = (priorBookings ?? []) as {
      check_out: string;
      status: string;
    }[];
    const pastCheckouts = stayRows
      .map((b) => b.check_out)
      .filter((d) => d && d < today)
      .sort();
    const lastCheckout = pastCheckouts[pastCheckouts.length - 1] ?? null;

    const party =
      (quote.guests_breakdown as {
        adults?: number;
        children?: number;
        infants?: number;
        pets?: number;
      } | null) ?? null;

    // Requested rooms → names; draft add-ons → "asked about" labels.
    const roomNameById = new Map(
      (matchedListing?.rooms ?? []).map((r) => [r.id, r.name]),
    );
    const roomNames = (qrooms ?? [])
      .map((r) => roomNameById.get(r.room_id))
      .filter((n): n is string => !!n);
    const requestedAddonLabels = (qaddons ?? [])
      .filter((a) => a.kind !== "age")
      .map((a) => a.label)
      .filter((l): l is string => !!l);

    requestCtx = {
      guestName: quote.guest_name,
      guestEmail: quote.guest_email,
      guestPhone: quote.guest_phone,
      guestAvatarUrl: gProfile?.avatar_url ?? null,
      stays: stayRows.length,
      lastStayedLabel: lastCheckout
        ? new Date(`${lastCheckout}T00:00:00`).toLocaleDateString("en-ZA", {
            month: "short",
            year: "numeric",
          })
        : null,
      listingName: matchedListing?.name ?? null,
      listingCity: matchedListing?.city ?? null,
      roomNames,
      checkIn: quote.check_in,
      checkOut: quote.check_out,
      party,
      headcount: quote.headcount,
      scope: quote.scope,
      requestedAddonLabels,
      message: firstMsg?.body?.trim() || null,
      requestedAt: quote.created_at,
      datesOpen: (blocks ?? []).length === 0,
      conversationId: quote.conversation_id,
    };
  }

  // Split saved add-ons: catalog lines (addon_id still in the listing's catalog)
  // rehydrate the picker; everything else is a custom line.
  const catalogIds = new Set((matchedListing?.addons ?? []).map((a) => a.id));
  const catalogAddons: { addon_id: string; quantity: number }[] = [];
  const customAddons: {
    label: string;
    quantity: number;
    unit_price: number;
  }[] = [];
  for (const a of qaddons ?? []) {
    // Age/pet lines are derived — drop them on rehydration; the form recomputes
    // them from the saved party so they never double-charge.
    if (a.kind === "age") continue;
    if (a.addon_id && catalogIds.has(a.addon_id)) {
      catalogAddons.push({
        addon_id: a.addon_id,
        quantity: Number(a.quantity),
      });
    } else {
      customAddons.push({
        label: a.label,
        quantity: Number(a.quantity),
        unit_price: Number(a.unit_price),
      });
    }
  }

  const initial = {
    id: quote.id,
    listingId: quote.listing_id,
    guestName: quote.guest_name ?? "",
    guestEmail: quote.guest_email ?? "",
    guestPhone: quote.guest_phone ?? "",
    checkIn: quote.check_in ?? "",
    checkOut: quote.check_out ?? "",
    headcount: quote.headcount ?? 2,
    scope: (quote.scope === "rooms" ? "rooms" : "whole_listing") as
      | "whole_listing"
      | "rooms",
    priceMode: (quote.price_mode === "single" ? "single" : "itemised") as
      | "itemised"
      | "single",
    baseAmount: Number(quote.base_amount),
    cleaningFee: Number(quote.cleaning_fee),
    notes: quote.notes ?? "",
    discountType: (quote.discount_type as "percent" | "fixed" | null) ?? null,
    discountValue: Number(quote.discount_value ?? 0),
    discountReason: quote.discount_reason ?? "",
    depositType:
      (quote.deposit_type as "deposit" | "full" | "reserve") ?? "full",
    depositPct: Number(quote.deposit_pct ?? 50),
    balanceDueDays: Number(quote.balance_due_days ?? 7),
    guestsBreakdown:
      (quote.guests_breakdown as {
        adults?: number;
        children?: number;
        infants?: number;
        pets?: number;
      } | null) ?? undefined,
    rooms: (qrooms ?? []).map((r) => ({
      room_id: r.room_id,
      guests: 1,
      base_amount: Number(r.base_amount),
      cleaning_fee: Number(r.cleaning_fee),
    })),
    catalogAddons,
    customAddons,
  };

  const firstName = quote.guest_name?.trim().split(/\s+/)[0] || "the guest";

  return (
    <div className="mx-auto max-w-[880px]">
      <header className="mb-6">
        <Link
          href={
            requestCtx ? "/dashboard/inbox" : `/dashboard/quotes/${quote.id}`
          }
          className="text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          {requestCtx ? "← Back to inbox" : "← Back to quote"}
        </Link>
        {requestCtx ? (
          <>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Quote request
            </div>
            <h1 className="mt-0.5 font-display text-[30px] font-bold tracking-tight text-brand-ink">
              Respond to {firstName}&rsquo;s request
            </h1>
            <p className="mt-1 max-w-xl text-sm text-brand-mute">
              {firstName} asked for a price — review what they want, then build
              and send the quote. When they accept and pay, Vilo turns it into a
              confirmed booking automatically.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 font-display text-[30px] font-bold tracking-tight text-brand-ink">
              Edit quote
            </h1>
            <p className="mt-1 text-sm text-brand-mute">
              {quote.status === "sent"
                ? "This quote has already been sent — saving keeps a copy of the previous version and re-issues an updated PDF."
                : "Make your changes and save the draft."}
            </p>
          </>
        )}
      </header>
      {requestCtx ? (
        <div className="mb-6">
          <QuoteRequestCard ctx={requestCtx} />
        </div>
      ) : null}
      <QuoteForm
        listings={list}
        initial={initial}
        isSentQuote={quote.status === "sent"}
      />
    </div>
  );
}
