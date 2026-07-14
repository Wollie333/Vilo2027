import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { hostHasFeature } from "@/lib/products/featureGate";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { loadQuoteFormListings } from "../../../quotes/_listings";
import { LookingForLocked } from "../../_components/LookingForLocked";
import { RespondFormWrapper } from "../../_components/RespondFormWrapper";

interface Props {
  params: Promise<{ postId: string }>;
}

export default async function RespondToPostPage({ params }: Props) {
  const { postId } = await params;
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/dashboard/looking-for/respond/${postId}`);
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  // Signed in but not yet a host (e.g. a guest who clicked "Send a quote"):
  // send them through host signup, carrying the quote intent forward so they
  // land back on THIS request once their profile exists.
  if (!host) {
    redirect(
      `/signup/host?next=${encodeURIComponent(`/dashboard/looking-for/respond/${postId}`)}`,
    );
  }

  const canLookingFor = await hostHasFeature(host.id, "looking_for_access");

  if (!canLookingFor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href="/dashboard/looking-for">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
        <LookingForLocked />
      </div>
    );
  }

  // Fetch the Looking For post
  const { data: post, error: postError } = await supabase
    .from("looking_for_posts")
    .select(
      `
      id,
      title,
      description,
      category,
      check_in_date,
      check_out_date,
      adults,
      children,
      infants,
      location_text,
      status,
      is_public,
      expires_at,
      guest:user_profiles!guest_id(id, full_name, email, phone)
    `,
    )
    .eq("id", postId)
    .single();

  if (postError || !post) {
    notFound();
  }

  // Check if post is still active
  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  if (post.status !== "active" || isExpired) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href="/dashboard/looking-for">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            Request no longer active
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            This request has expired or been fulfilled.
          </p>
        </div>
      </div>
    );
  }

  // Check if host has already quoted this post
  const { data: existingResponse } = await supabase
    .from("looking_for_responses")
    .select("id, quote_id")
    .eq("post_id", postId)
    .eq("host_id", host.id)
    .maybeSingle();

  if (existingResponse?.quote_id) {
    redirect(`/dashboard/quotes/${existingResponse.quote_id}`);
  }

  // Load the host's listings enriched for the quote builder (cover photo, rooms,
  // add-ons, blocked nights) via the SAME loader the New/Edit Quote pages use —
  // the respond flow feeds the identical QuoteForm. The old bespoke query here
  // referenced columns/relations that don't exist (properties.is_active, a
  // `rooms` relation that is actually `property_rooms`), so it errored and every
  // host — even one with a live listing — saw the "profile isn't live" state.
  const listings = await loadQuoteFormListings(supabase, host.id);

  // First-time host whose profile isn't live yet: they have a host row but no
  // active (published) listing, so there's nothing to quote from. Guide them to
  // finish their listing rather than dropping them into an empty quote form.
  // The quote intent is preserved — once a listing is live, this same request
  // link takes them straight to the form.
  if (!listings || listings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href="/looking-for">
              <ArrowLeft className="h-4 w-4" />
              Back to requests
            </Link>
          </Button>
        </div>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            Your profile isn&apos;t live yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-brand-mute">
            You can send quotes as soon as you have one published listing.
            Finish and publish your first listing, then come back to this
            request to quote.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/properties">Finish my listing</Link>
          </Button>
        </div>
      </div>
    );
  }

  const guest = post.guest as unknown as {
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
  } | null;

  // Fetch host's message templates
  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, title, body")
    .eq("host_id", host.id)
    .order("sort_order");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/looking-for">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      {/* Request summary */}
      <div className="rounded-card border border-brand-line bg-brand-accent p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
            <Search className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-brand-mute">Responding to request</p>
            <h2 className="truncate font-medium text-brand-ink">
              {post.title}
            </h2>
            <p className="mt-1 text-sm text-brand-mute">
              {post.location_text ?? post.category}
              {post.check_in_date && (
                <span>
                  {" "}
                  ·{" "}
                  {new Date(post.check_in_date).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
              {post.check_out_date && (
                <span>
                  {" "}
                  –{" "}
                  {new Date(post.check_out_date).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
              {post.adults && (
                <span>
                  {" "}
                  · {post.adults +
                    (post.children ?? 0) +
                    (post.infants ?? 0)}{" "}
                  guests
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Quote form with pre-filled data and template support */}
      <RespondFormWrapper
        listings={listings}
        initial={{
          guestName: guest?.full_name ?? "",
          guestEmail: guest?.email ?? "",
          guestPhone: guest?.phone ?? "",
          checkIn: post.check_in_date ?? "",
          checkOut: post.check_out_date ?? "",
          guestsBreakdown: {
            adults: post.adults ?? 2,
            children: post.children ?? 0,
            infants: post.infants ?? 0,
          },
          headcount:
            (post.adults ?? 2) + (post.children ?? 0) + (post.infants ?? 0),
          notes: post.description ?? "",
          lookingForPostId: post.id,
        }}
        templates={(templates ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          body: t.body,
        }))}
        guestName={guest?.full_name ?? "Guest"}
      />
    </div>
  );
}
