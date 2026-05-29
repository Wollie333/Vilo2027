"use client";

import {
  AlertTriangle,
  Camera,
  Check,
  CreditCard,
  PartyPopper,
  ShieldCheck,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { togglePublishAction } from "../../listings/[id]/edit/actions";
import type {
  BankAccount,
  Host,
  Listing,
  Photo,
  Profile,
  Room,
  SetupStepKey,
} from "../types";

type Props = {
  host: Host;
  profile: Profile;
  listing: Listing;
  photos: Photo[];
  rooms: Room[];
  bankAccounts: BankAccount[];
  done: Record<SetupStepKey, boolean>;
};

export function StepReview({
  host,
  profile,
  listing,
  photos,
  rooms,
  bankAccounts,
  done,
}: Props) {
  const router = useRouter();
  const [pending, startPublish] = useTransition();

  // Blockers — must be satisfied before publish.
  const issues: string[] = [];
  if (!host.avatar_url) issues.push("Add a profile photo.");
  if (!host.bio) issues.push("Add a short bio.");
  if (bankAccounts.length === 0)
    issues.push("Add a bank account so we can route guest payments to you.");
  if (photos.length === 0)
    issues.push("Add at least one photo to your listing.");
  if (!listing.base_price) issues.push("Set a base price for your listing.");
  if (!listing.max_guests)
    issues.push("Set the max guest count for your listing.");
  if (!listing.cancellation_policy) issues.push("Pick a cancellation policy.");
  if (listing.listing_type === "accommodation") {
    if (!listing.check_in_time) issues.push("Set a check-in time.");
    if (!listing.check_out_time) issues.push("Set a check-out time.");
  }

  const canPublish = issues.length === 0;

  function onPublish() {
    if (!canPublish) {
      toast.error("Fix the issues above first.");
      return;
    }
    startPublish(async () => {
      const result = await togglePublishAction(listing.id, true);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Your listing is live!");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          Icon={User}
          title="Your profile"
          status={done.profile ? "done" : "missing"}
          items={[
            { label: "Display name", value: host.display_name },
            { label: "Email", value: profile.email },
            { label: "Phone", value: profile.phone || "Not set" },
            {
              label: "Languages",
              value:
                host.languages_spoken.length > 0
                  ? host.languages_spoken.join(", ")
                  : "Not set",
            },
            { label: "Bio", value: host.bio ? "✓ Added" : "Missing" },
            {
              label: "Photo",
              value: host.avatar_url ? "✓ Uploaded" : "Missing",
            },
          ]}
        />

        <SummaryCard
          Icon={CreditCard}
          title="Banking"
          status={done.banking ? "done" : "missing"}
          items={
            bankAccounts.length > 0
              ? [
                  {
                    label: "Default account",
                    value: `${bankAccounts[0].bank_name} ···· ${bankAccounts[0].account_number.replace(/\s/g, "").slice(-4)}`,
                  },
                  {
                    label: "Account holder",
                    value: bankAccounts[0].account_holder,
                  },
                ]
              : [{ label: "Status", value: "No bank account on file" }]
          }
        />

        <SummaryCard
          Icon={Camera}
          title="Listing"
          status={done.listing ? "done" : "missing"}
          items={[
            { label: "Name", value: listing.name },
            { label: "Photos", value: `${photos.length} uploaded` },
            {
              label: "Base price",
              value: listing.base_price
                ? `R ${listing.base_price.toLocaleString("en-ZA").replace(/,/g, " ")} / night`
                : "Not set",
            },
            {
              label: "Max guests",
              value: listing.max_guests?.toString() ?? "Not set",
            },
            ...(rooms.length > 0
              ? [{ label: "Rooms", value: `${rooms.length} configured` }]
              : []),
          ]}
        />

        <SummaryCard
          Icon={ShieldCheck}
          title="Policies"
          status={done.policies ? "done" : "missing"}
          items={[
            {
              label: "Cancellation",
              value: listing.cancellation_policy
                ? capitalize(listing.cancellation_policy)
                : "Not set",
            },
            ...(listing.listing_type === "accommodation"
              ? [
                  {
                    label: "Check-in",
                    value: listing.check_in_time || "Not set",
                  },
                  {
                    label: "Check-out",
                    value: listing.check_out_time || "Not set",
                  },
                ]
              : []),
            {
              label: "House rules",
              value: listing.house_rules ? "✓ Added" : "Not set",
            },
          ]}
        />
      </div>

      {/* Blockers */}
      {!canPublish ? (
        <div className="rounded-card border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold text-brand-ink">
                A few things still need attention
              </div>
              <ul className="mt-2 space-y-1">
                {issues.map((i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12.5px] text-brand-ink"
                  >
                    <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-600" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-semibold text-brand-ink">
                You&rsquo;re ready to go live.
              </div>
              <p className="mt-1 text-sm text-brand-mute">
                Publishing makes{" "}
                <span className="font-mono font-semibold text-brand-ink">
                  viloplatform.com/{host.handle}
                </span>{" "}
                bookable. You can unpublish any time from the listing editor.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-line pt-5">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
        >
          Save & finish later
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish || pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish & go live"}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  Icon,
  title,
  status,
  items,
}: {
  Icon: typeof User;
  title: string;
  status: "done" | "missing";
  items: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="font-display text-sm font-semibold text-brand-ink">
            {title}
          </div>
        </div>
        {status === "done" ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <Check className="h-3 w-3" strokeWidth={3} /> Done
          </span>
        ) : (
          <span className="rounded-pill bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Incomplete
          </span>
        )}
      </div>
      <dl className="space-y-1.5">
        {items.map((i) => (
          <div
            key={i.label}
            className="flex items-baseline justify-between gap-3 text-[12px]"
          >
            <dt className="text-brand-mute">{i.label}</dt>
            <dd className="truncate text-right font-medium text-brand-ink">
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
