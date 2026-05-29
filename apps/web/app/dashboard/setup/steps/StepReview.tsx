"use client";

import {
  AlertTriangle,
  BedDouble,
  Camera,
  Check,
  CreditCard,
  ImageIcon,
  PartyPopper,
  Pencil,
  ShieldCheck,
  Star,
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
  onEditStep: (key: SetupStepKey) => void;
};

function formatRand(n: number): string {
  return `R ${Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

// Light confetti burst on publish — pure DOM so it survives the redirect tick.
function fireConfetti() {
  if (typeof document === "undefined") return;
  const colors = ["#10B981", "#064E3B", "#D1FAE5", "#34D399", "#A7F3D0"];
  for (let i = 0; i < 44; i++) {
    const piece = document.createElement("div");
    piece.className = "setup-confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 240}px`);
    piece.style.setProperty("--d", `${2 + Math.random() * 1.4}s`);
    piece.style.setProperty("--delay", `${Math.random() * 0.4}s`);
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 3600);
  }
}

export function StepReview({
  host,
  profile,
  listing,
  photos,
  rooms,
  bankAccounts,
  done,
  onEditStep,
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
      fireConfetti();
      toast.success("🎉 Your listing is live!");
      // Let the confetti play for a beat before navigating away.
      window.setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1100);
    });
  }

  const cover = photos[0];
  const stripPhotos = photos.slice(1, 5);
  const activeRooms = rooms.filter((r) => r.is_active);

  return (
    <div className="space-y-6">
      {/* ── Visitor preview: how guests will see the listing ── */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-brand-line bg-brand-light/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-brand-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Guest preview
            </span>
          </div>
          <button
            type="button"
            onClick={() => onEditStep("listing")}
            className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-2.5 py-1 text-[11.5px] font-medium text-brand-ink transition hover:bg-brand-accent"
          >
            <Pencil className="h-3 w-3" /> Edit listing
          </button>
        </div>

        {/* Photo hero */}
        {cover ? (
          <div className="grid grid-cols-4 grid-rows-2 gap-1 p-1.5 sm:h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.url}
              alt=""
              className="col-span-4 row-span-2 h-48 w-full rounded-[10px] object-cover sm:col-span-2 sm:h-full"
            />
            {stripPhotos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.url}
                alt=""
                className="hidden h-full w-full rounded-[10px] object-cover sm:block"
              />
            ))}
            {Array.from({ length: Math.max(0, 4 - stripPhotos.length) }).map(
              (_, i) => (
                <div
                  key={`ph-${i}`}
                  className="hidden items-center justify-center rounded-[10px] bg-brand-light text-brand-mute sm:flex"
                >
                  <ImageIcon className="h-5 w-5" />
                </div>
              ),
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onEditStep("listing")}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 bg-brand-light/50 text-brand-mute"
          >
            <Camera className="h-7 w-7" />
            <span className="text-xs font-medium">Add photos to preview</span>
          </button>
        )}

        <div className="space-y-4 px-5 py-5">
          {/* Title + price */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display text-xl font-bold text-brand-ink">
                {listing.name}
              </h3>
              <p className="mt-0.5 text-[12.5px] capitalize text-brand-mute">
                {listing.accommodation_type ??
                  listing.experience_type ??
                  listing.listing_type}
              </p>
            </div>
            {listing.base_price ? (
              <div className="shrink-0 text-right">
                <div className="num font-display text-lg font-bold text-brand-ink">
                  {formatRand(listing.base_price)}
                </div>
                <div className="text-[10.5px] text-brand-mute">per night</div>
              </div>
            ) : null}
          </div>

          {/* About */}
          {listing.description ? (
            <div
              className="text-[13px] leading-relaxed text-brand-ink [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
              // Sanitised on save (saveListingPatchAction → sanitiseListingHtml).
              dangerouslySetInnerHTML={{ __html: listing.description }}
            />
          ) : (
            <p className="text-[13px] italic text-brand-mute">
              No description yet — add one so guests know what to expect.
            </p>
          )}

          {/* Rooms */}
          {activeRooms.length > 0 ? (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Rooms
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeRooms.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-card border border-brand-line px-3 py-2"
                  >
                    <BedDouble className="h-4 w-4 shrink-0 text-brand-mute" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-brand-ink">
                        {r.name}
                      </div>
                      <div className="text-[10.5px] text-brand-mute">
                        sleeps {r.max_guests ?? "—"}
                      </div>
                    </div>
                    {r.base_price ? (
                      <span className="num text-[12px] font-bold text-brand-ink">
                        {formatRand(r.base_price)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Host card */}
          <div className="flex items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {host.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={host.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
                  <User className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-brand-ink">
                  Hosted by {host.display_name}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-brand-mute">
                  <Star className="h-3 w-3 fill-brand-primary text-brand-primary" />
                  New host
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEditStep("profile")}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-brand-line bg-white px-2.5 py-1 text-[11.5px] font-medium text-brand-ink transition hover:bg-brand-accent"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
        </div>
      </section>

      {/* At-a-glance summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          Icon={User}
          title="Your profile"
          status={done.profile ? "done" : "missing"}
          onEdit={() => onEditStep("profile")}
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
          onEdit={() => onEditStep("banking")}
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
          onEdit={() => onEditStep("listing")}
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
          onEdit={() => onEditStep("policies")}
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
  onEdit,
}: {
  Icon: typeof User;
  title: string;
  status: "done" | "missing";
  items: { label: string; value: string }[];
  onEdit?: () => void;
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
        <div className="flex items-center gap-1.5">
          {status === "done" ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <Check className="h-3 w-3" strokeWidth={3} /> Done
            </span>
          ) : (
            <span className="rounded-pill bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Incomplete
            </span>
          )}
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${title}`}
              className="flex h-6 w-6 items-center justify-center rounded text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : null}
        </div>
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
