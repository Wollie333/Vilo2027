"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  CalendarCheck,
  Coins,
  CreditCard,
  FileMinus,
  Link2,
  RotateCcw,
  SlidersHorizontal,
  Download,
  ExternalLink,
  FileText,
  Gift,
  Home,
  KeyRound,
  LifeBuoy,
  Globe,
  Mail,
  MapPin,
  PackagePlus,
  Pencil,
  Phone,
  Plus,
  Power,
  ScrollText,
  Search,
  Shield,
  Star,
  Trash2,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { ImpersonateButton } from "@/app/[locale]/admin/_components/ImpersonateButton";
import { HostAccessControls } from "./HostAccessControls";
import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";
import {
  AdminTable,
  type AdminColumn,
} from "@/app/[locale]/admin/_components/AdminTable";
import {
  BUSINESS_LOCALE_LABELS,
  BUSINESS_LOCALES,
} from "@/app/[locale]/dashboard/settings/businesses/schemas";
import {
  ADDON_CATEGORIES,
  PRICING_MODELS,
  type AddonInput,
} from "@/app/[locale]/dashboard/addons/schemas";
import { PolicyEditorSheet } from "@/app/[locale]/dashboard/policies/PolicyEditorSheet";
import type { PolicyCard } from "@/app/[locale]/dashboard/policies/policy-card";
import type { PolicyType } from "@/app/[locale]/dashboard/policies/schemas";
import {
  createPolicyForListingAction,
  fetchPolicyCardForListingAction,
  updatePolicyForListingAction,
} from "@/app/[locale]/dashboard/policies/actions";
import { CURRENCY_META, DISPLAY_CURRENCIES } from "@/lib/currency";
import { LedgerList } from "@/components/finance/LedgerList";
import { AdminLedgerList } from "@/components/finance/AdminLedgerList";
import { StatementDialog } from "@/components/finance/StatementDialog";
import {
  ActivityTimeline,
  type ActivityCategory,
  type ActivityEvent,
} from "@/components/admin/ActivityTimeline";
import type { WieloTxn } from "@/lib/billing/wielo-ledger";
import {
  WieloFinanceModals,
  type WieloFinanceAction,
  type WieloFinanceRequest,
} from "@/app/[locale]/admin/subscriptions/revenue/WieloFinanceModals";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { modal } from "@/components/ui/modal-host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { daysRemaining, proratedAmount, round2 } from "@/lib/billing/proration";
import type { Txn } from "@/lib/finance/transactions";

import {
  addAdminUserNote,
  adjustUserCredits,
  adminCreateAddon,
  adminDeleteAddon,
  adminDeletePolicy,
  adminPayoutAffiliate,
  adminSetDefaultPolicy,
  adminToggleAddon,
  adminTogglePolicyStatus,
  adminUpdateAddon,
  adminUpdateBusiness,
  adminUpdateSubscription,
  buildWieloHostStatement,
  cancelScheduledChange,
  emailWieloDoc,
  enableAffiliate,
  sellProduct,
  sendWieloDocToInbox,
  setUserProduct,
  changeUserRole,
  purgeUser,
  reinstateUser,
  requestSupportAccess,
  restoreUser,
  sendPasswordReset,
  softDeleteUser,
  suspendUser,
  updateUserProfile,
} from "./actions";
import {
  DELETED_ACCOUNT_HOLD_DAYS,
  daysSinceDeleted,
  isPurgeEligible,
} from "@/lib/users/accountLifecycle";

type BusinessItem = UserRecordData["businesses"][number];
type AddonItem = UserRecordData["addons"][number];

const SUB_STATUSES = [
  "active",
  "trialing",
  "paused",
  "past_due",
  "restricted",
  "cancelled",
  "expired",
] as const;

type BookingLite = {
  id: string;
  reference: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  total: number;
  currency: string;
  listingName: string;
  counterparty: string | null;
};

type ReviewLite = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  isPublished: boolean;
  hostResponse: string | null;
  listingName: string;
  counterparty: string;
};

export type UserRecordData = {
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    is_active: boolean;
    is_lead: boolean | null;
    country: string | null;
    deleted_at: string | null;
    created_at: string | null;
    phone_verified_at: string | null;
    id_verified_at: string | null;
    avatar_url: string | null;
  };
  host: {
    id: string;
    handle: string;
    display_name: string;
    is_verified: boolean;
    total_bookings: number | null;
    avg_rating: number | null;
    total_reviews: number | null;
    account_kind: string;
    quote_access: boolean;
    platform_access: boolean;
  } | null;
  subscription: {
    plan: string;
    status: string;
    billing_cycle: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    product_id: string | null;
  } | null;
  // Every subscription the host holds (1 membership + N services), enriched.
  subscriptions: {
    id: string;
    productId: string | null;
    productName: string | null;
    productType: "membership" | "service" | "product" | null;
    plan: string;
    status: string;
    billingCycle: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    price: number | null;
    currency: string | null;
    // A pending "apply at end of cycle" change (cancel or switch), if any.
    scheduledChange: {
      id: string;
      kind: "cancel" | "switch";
      effectiveAt: string;
      targetName: string | null;
    } | null;
  }[];
  // Wielo Credits wallet balance (host-scoped, purpose 'quote').
  creditBalance: number;
  // Once-off product purchases (product_orders whose product is a `product`).
  productPurchases: {
    id: string;
    productName: string;
    amount: number;
    currency: string;
    status: string;
    method: string | null;
    date: string;
  }[];
  products: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    billingCycle: string | null;
    trialDays: number;
    slug: string | null;
    productType: string;
    isFree: boolean;
    isRecommended: boolean;
    bullets: string[];
    creditQuantity: number | null;
  }[];
  counts: { bookingsAsGuest: number; refunds: number; listings: number };
  listings: {
    id: string;
    name: string;
    location: string;
    isPublished: boolean;
    isFeatured: boolean;
    isSuspended: boolean;
    price: number;
    currency: string;
    slug: string | null;
    typeLabel: string;
    bedrooms: number | null;
    bathrooms: number | null;
    maxGuests: number | null;
    totalBookings: number;
    totalReviews: number;
    avgRating: number | null;
    publishedAt: string | null;
    createdAt: string | null;
  }[];
  websites: {
    id: string;
    businessId: string;
    businessName: string;
    subdomain: string;
    customDomain: string | null;
    domainStatus: string;
    sslStatus: string;
    status: string;
    brandName: string | null;
    brandTagline: string | null;
    themePreset: string | null;
    themeAccent: string | null;
    themeFont: string | null;
    seoTitle: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    pageCount: number;
    publishedPageCount: number;
    pages: {
      id: string;
      kind: string;
      slug: string;
      title: string | null;
      navLabel: string | null;
      showInNav: boolean;
      isPublished: boolean;
    }[];
  }[];
  businesses: {
    id: string;
    name: string;
    tradingName: string;
    legalName: string;
    vatNumber: string;
    companyRegistrationNumber: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    municipality: string;
    province: string;
    postalCode: string;
    country: string;
    defaultCurrency: string;
    defaultLanguage: string;
    isDefault: boolean;
    isArchived: boolean;
  }[];
  addons: {
    id: string;
    name: string;
    description: string | null;
    pricingModel: string;
    unitPrice: number;
    currency: string;
    category: string | null;
    isActive: boolean;
    isRequired: boolean;
    minQuantity: number;
    maxQuantity: number | null;
    stockQuantity: number | null;
    allowCustomQuantity: boolean;
    leadTimeDays: number;
    vatIncluded: boolean;
    listingsCount: number;
  }[];
  policies: {
    id: string;
    name: string;
    type: string;
    status: string;
    preset: string | null;
    isDefault: boolean;
    isNonRefundable: boolean;
    summary: string | null;
    updatedAt: string;
    assignmentsCount: number;
  }[];
  bookingsAsGuest: BookingLite[];
  bookingsAsHost: BookingLite[];
  reviewsWritten: ReviewLite[];
  reviewsReceived: ReviewLite[];
  guestRatingsGiven: {
    id: string;
    rating: number;
    summary: string | null;
    date: string;
    guestName: string;
    guestEmail: string | null;
  }[];
  hostFinance: {
    collected: number;
    outstanding: number;
    refunded: number;
    net: number;
  } | null;
  hostTxns: Txn[];
  support: { active: boolean; status: string; expiresAt: string | null } | null;
  planOptions: { key: string; name: string }[];
  supportGrants: {
    id: string;
    status: string;
    reason: string | null;
    requestedAt: string;
    decidedAt: string | null;
    expiresAt: string | null;
    requestedBy: string | null;
  }[];
  wieloLedger: WieloTxn[];
  /** Current net owed to Wielo (+ = due, − = credit, ~0 = settled). */
  wieloBalance: number;
  wieloLabels: {
    planLabels: Record<string, string>;
    productLabels: Record<string, string>;
  };
  relationships: {
    id: string;
    contactId: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    connectedAt: string | null;
  }[];
  referrals: {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    plan: string;
    productName: string;
    commission: number;
    currency: string;
    joinedAt: string;
  }[];
  affiliateSlug: string | null;
  affiliateStats: {
    accountId: string;
    currency: string;
    status: string;
    defaultMethod: string | null;
    clicks: number;
    signups: number;
    pending: number;
    earned: number;
    available: number;
    paid: number;
  } | null;
  affiliateCommissions: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    entryType: string;
    productName: string;
    createdAt: string;
  }[];
  affiliatePayouts: {
    id: string;
    net: number;
    gross: number;
    currency: string;
    method: string | null;
    status: string;
    createdAt: string;
    processedAt: string | null;
  }[];
  dataRequests: {
    id: string;
    type: string;
    status: string;
    createdAt: string;
    fulfilledAt: string | null;
  }[];
  notes: {
    id: string;
    body: string;
    created_at: string;
    author: string | null;
  }[];
  audit: {
    id: string;
    action: string;
    targetType: string | null;
    actor: string | null;
    created_at: string;
    impersonating: string | null;
    payload: Record<string, unknown> | null;
  }[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function initials(name: string | null, email: string | null): string {
  const s = name || email || "·";
  const p = s.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "·";
}

type Dialog =
  | "edit"
  | "role"
  | "suspend"
  | "delete"
  | "purge"
  | "support"
  | "managesub"
  | null;

// Old per-panel tab keys fold into the consolidated groups (keeps existing
// deep-links working: ?tab=catalog → Business, ?tab=ledger → Finance, …).
const TAB_ALIASES: Record<string, string> = {
  ledger: "finance",
  referrals: "affiliate",
  affiliates: "affiliate",
  catalog: "business",
  reviews: "guests",
  relationships: "guests",
  // "Activity & notes" split into dedicated History / Notes / Data tabs.
  admin: "history",
  activity: "history",
  support: "data",
};

// Top-of-record Wielo Credits balance + one-click "Assign credits" modal. Shown
// on every tab for a host / quote-only account so an admin can grant (or remove)
// credits from anywhere in the record. Self-contained: owns its own balance
// state, moved only through the audited adjustUserCredits action (which runs the
// atomic apply_wielo_credit path, so it can't drive the wallet below zero).
function CreditsCard({
  userId,
  hostId,
  initialBalance,
}: {
  userId: string;
  hostId: string | null;
  initialBalance: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [balance, setBalance] = useState(initialBalance);
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [reason, setReason] = useState("");
  const close = () => {
    setOpen(false);
    setAmt("");
    setReason("");
  };

  function submit() {
    const n = Math.trunc(Number(amt));
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Enter a non-zero amount (use a minus sign to remove).");
      return;
    }
    if (!reason.trim()) {
      toast.error("Add a short reason.");
      return;
    }
    start(async () => {
      const r = await adjustUserCredits({
        userId,
        delta: n,
        reason: reason.trim(),
      });
      if (r.ok) {
        setBalance(r.balance);
        toast.success(
          `${n > 0 ? "Granted" : "Removed"} ${Math.abs(n)} credit${
            Math.abs(n) === 1 ? "" : "s"
          }. New balance: ${r.balance}.`,
        );
        close();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Coins className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
            Wielo Credits
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-bold text-brand-primary">
              {balance}
            </span>
            <span className="text-xs text-brand-mute">credits</span>
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !hostId}
        onClick={() => setOpen(true)}
        title={
          hostId
            ? undefined
            : "Credits only apply to host / quote-only accounts."
        }
      >
        <Gift className="mr-1.5 h-4 w-4" /> Assign credits
      </Button>

      <FormModal
        open={open}
        onOpenChange={(o) => (o ? null : close())}
        title="Assign credits"
        description="Grant or remove Wielo Credits on this account. Use a minus sign to remove."
      >
        <div className="space-y-4">
          <Lbl label="Amount (use −5 to remove 5)">
            <Input
              type="number"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              placeholder="e.g. 10 or -5"
            />
          </Lbl>
          <Lbl label="Reason">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Goodwill top-up"
            />
          </Lbl>
          <div className="rounded-md border border-brand-line bg-brand-light/40 px-3 py-2 text-[12px] text-brand-mute">
            Current balance:{" "}
            <span className="font-semibold text-brand-ink">{balance}</span>. A
            removal can&apos;t take the balance below zero.
          </div>
        </div>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button onClick={submit} disabled={pending}>
            {pending ? "Working…" : "Apply"}
          </Button>
        </FormModalFooter>
      </FormModal>
    </section>
  );
}

export function UserRecord({ data }: { data: UserRecordData }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, host } = data;
  const rawTab = params.get("tab") ?? "overview";
  const tab = TAB_ALIASES[rawTab] ?? rawTab;
  const [tabLoading, setTabLoading] = useState<string | null>(null);
  const [isTabPending, startTabTransition] = useTransition();

  const setTab = (t: string) => {
    if (t === tab) return; // Already on this tab
    setTabLoading(t);
    startTabTransition(() => {
      const next = new URLSearchParams(params.toString());
      if (t === "overview") next.delete("tab");
      else next.set("tab", t);
      router.push(`?${next.toString()}`);
    });
  };

  // Clear loading state when tab changes
  if (tabLoading === tab) {
    setTabLoading(null);
  }

  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState(user.role ?? "guest");
  const [reason, setReason] = useState("");
  // Manage-subscription dialog is scoped to ONE subscription (a host may hold
  // several) — opened with that sub's product + status.
  const [subProductId, setSubProductId] = useState<string>("");
  const [subStatus, setSubStatus] =
    useState<(typeof SUB_STATUSES)[number]>("active");
  // On cancelling a paid sub: credit note (default) or refund for the unused part.
  const [subRefundDoc, setSubRefundDoc] = useState<"credit" | "refund">(
    "credit",
  );
  // Timing of a cancellation: now (immediate + credit/refund) or end of cycle.
  const [subTiming, setSubTiming] = useState<"now" | "end_of_cycle">("now");
  const openManage = (productId: string | null, status: string) => {
    setSubProductId(productId ?? "");
    setSubStatus(
      (SUB_STATUSES as readonly string[]).includes(status)
        ? (status as (typeof SUB_STATUSES)[number])
        : "active",
    );
    setSubRefundDoc("credit");
    setSubTiming("now");
    setDialog("managesub");
  };
  const [editBiz, setEditBiz] = useState<BusinessItem | null>(null);

  const close = () => {
    setDialog(null);
    setReason("");
  };
  const run = (p: Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await p;
      if (r.ok) {
        toast.success(ok);
        close();
        router.refresh();
      } else toast.error(r.error ?? "Failed.");
    });

  // Consolidated tab groups (each stacks the related panels). Far fewer top-
  // level tabs; deep-links to the old keys still resolve via TAB_ALIASES.
  // Every user record shows the SAME tabs (guest or host) — each is just filled
  // by that user's scope (a guest simply has empty listings / business / etc.).
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "bookings", label: "Bookings" },
    { key: "listings", label: "Listings", count: data.listings.length },
    {
      key: "website",
      label: "Website",
      count: data.websites.length || undefined,
    },
    { key: "products", label: "Products" },
    { key: "finance", label: "Finance" },
    {
      key: "business",
      label: "Business & catalogue",
      count: data.businesses.length + data.addons.length,
    },
    {
      key: "affiliate",
      label: "Affiliate",
      count: data.referrals.length || undefined,
    },
    {
      key: "guests",
      label: "Reviews & guests",
      count: data.relationships.length || undefined,
    },
    { key: "history", label: "History" },
    {
      key: "notes",
      label: "Notes",
      count: data.notes.length || undefined,
    },
    {
      key: "data",
      label: "Data",
      count: data.dataRequests.length || undefined,
    },
  ];

  return (
    <div className="w-full">
      {/* Sub-header */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/admin/users"
          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line px-3 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <ArrowLeft className="h-4 w-4 text-brand-mute" /> All users
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        {/* Sticky dossier */}
        <aside className="lg:sticky lg:top-6">
          <Dossier
            data={data}
            onEdit={() => setDialog("edit")}
            onRole={() => setDialog("role")}
            onSuspend={() => setDialog("suspend")}
            onDelete={() => setDialog("delete")}
            onPurge={() => setDialog("purge")}
            onReinstate={() =>
              run(
                reinstateUser({
                  userId: user.id,
                  reason: "Reinstated by admin",
                }),
                "User reinstated.",
              )
            }
            onRestore={() =>
              run(
                restoreUser({
                  userId: user.id,
                  reason: "Restored by admin",
                }),
                "Account restored.",
              )
            }
            onResetPassword={() =>
              run(
                sendPasswordReset({ userId: user.id }),
                "Password reset email sent.",
              )
            }
            pending={pending}
          />
          {data.host ? (
            <div className="mt-4">
              <HostAccessControls
                userId={user.id}
                accountKind={data.host.account_kind}
                quoteAccess={data.host.quote_access}
                platformAccess={data.host.platform_access}
              />
            </div>
          ) : null}
        </aside>

        {/* Working column */}
        <div className="flex min-w-0 flex-col gap-5">
          {host ? (
            <CreditsCard
              userId={user.id}
              hostId={host.id}
              initialBalance={data.creditBalance}
            />
          ) : null}
          <RecordTabs
            active={tab}
            onSelect={setTab}
            tabs={tabs}
            loadingKey={isTabPending ? tabLoading : null}
          />
          <div>
            {tab === "overview" ? <OverviewPanel data={data} /> : null}
            {tab === "bookings" ? (
              <BookingsPanel
                data={data}
                onRequestSupport={() => setDialog("support")}
              />
            ) : null}
            {tab === "listings" ? <ListingsPanel data={data} /> : null}

            {/* Website — the host's builder site(s): domain, theme, pages,
                publish state. Its own tab, right of Listings. */}
            {tab === "website" ? <WebsitePanel data={data} /> : null}

            {/* Products — the user's subscription + purchased products. Shown
                for guests too: activating a product provisions them as a host. */}
            {tab === "products" ? (
              <ProductsPanel data={data} onManage={openManage} />
            ) : null}

            {/* Finance — the Wielo + booking ledger */}
            {tab === "finance" ? (
              <LedgerPanel
                data={data}
                onRequestSupport={() => setDialog("support")}
              />
            ) : null}

            {/* Affiliate — the user's own affiliate account, referrals + payouts */}
            {tab === "affiliate" ? <ReferralsPanel data={data} /> : null}

            {/* Business & catalogue — entity, add-ons, policies. (Website now
                lives in its own dedicated tab, right of Listings.) */}
            {tab === "business" ? (
              <div className="space-y-10">
                <GroupSection title="Businesses">
                  <BusinessPanel data={data} onEdit={setEditBiz} />
                </GroupSection>
                <GroupSection title="Add-ons & policies">
                  <CatalogPanel data={data} />
                </GroupSection>
              </div>
            ) : null}

            {/* Reviews & guests */}
            {tab === "guests" ? (
              <div className="space-y-10">
                <GroupSection title="Reviews">
                  <ReviewsPanel data={data} />
                </GroupSection>
                <GroupSection title="Travelled with">
                  <RelationshipsPanel data={data} />
                </GroupSection>
              </div>
            ) : null}

            {/* History — the full human-friendly timeline of everything that
                happened on this record (user + admin actions, with who/when). */}
            {tab === "history" ? <HistoryPanel data={data} /> : null}

            {/* Notes — internal staff notes, its own tab. */}
            {tab === "notes" ? (
              <NotesPanel
                userId={user.id}
                notes={data.notes}
                onAdded={() => router.refresh()}
              />
            ) : null}

            {/* Data — the user's data & privacy requests, last tab. */}
            {tab === "data" ? <SupportPanel data={data} /> : null}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <FormModal
        open={dialog === "edit"}
        onOpenChange={(o) => (o ? null : close())}
        title="Edit profile"
      >
        <div className="space-y-4">
          <Lbl label="Full name">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Lbl>
          <Lbl label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Lbl>
        </div>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            disabled={pending}
            onClick={() =>
              run(
                updateUserProfile({ userId: user.id, fullName, phone }),
                "Profile updated.",
              )
            }
          >
            Save
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "role"}
        onOpenChange={(o) => (o ? null : close())}
        title="Change role"
        description="Changing a role grants or removes access across the app."
      >
        <div className="space-y-4">
          <Lbl label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="guest">guest</option>
              <option value="host">host</option>
              <option value="staff">staff</option>
              <option value="super_admin">super_admin</option>
            </select>
          </Lbl>
          <Lbl label="Reason (required)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Lbl>
        </div>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(
                changeUserRole({
                  userId: user.id,
                  role: role as "guest" | "host" | "staff" | "super_admin",
                  reason,
                }),
                "Role updated.",
              )
            }
          >
            Change role
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "suspend"}
        onOpenChange={(o) => (o ? null : close())}
        title="Suspend user"
        description="They can't use the platform until reinstated."
      >
        <Lbl label="Reason (required)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Lbl>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            className="bg-status-cancelled hover:bg-status-cancelled/90"
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(suspendUser({ userId: user.id, reason }), "User suspended.")
            }
          >
            Suspend
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "delete"}
        onOpenChange={(o) => (o ? null : close())}
        title="Delete user"
        description="Soft-delete (recoverable). The account is hidden and deactivated."
      >
        <Lbl label="Reason (required)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Lbl>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            className="bg-status-cancelled hover:bg-status-cancelled/90"
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(softDeleteUser({ userId: user.id, reason }), "User deleted.")
            }
          >
            Delete
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "purge"}
        onOpenChange={(o) => (o ? null : close())}
        title="Delete permanently"
        description="Irreversible. Every listing, booking, payment and record this account owns is erased, and the login is removed. This cannot be undone."
      >
        <Lbl label="Reason (required)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Lbl>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            className="bg-status-cancelled hover:bg-status-cancelled/90"
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(
                purgeUser({ userId: user.id, reason }),
                "Account permanently deleted.",
              )
            }
          >
            Delete permanently
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "support"}
        onOpenChange={(o) => (o ? null : close())}
        title="Request edit access"
        description="The host is notified and must approve before you can edit their records. Approved access lasts 24 hours, then auto-expires."
      >
        <Lbl label="Reason (shown to the host)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Lbl>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            disabled={pending || reason.trim().length < 5 || !host}
            onClick={() =>
              host
                ? run(
                    requestSupportAccess({ hostId: host.id, reason }),
                    "Request sent to the host.",
                  )
                : undefined
            }
          >
            Send request
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "managesub"}
        onOpenChange={(o) => (o ? null : close())}
        title="Manage subscription"
        description="Change this subscription's status (e.g. place on hold or cancel)."
      >
        <div className="space-y-4">
          <Lbl label="Subscription">
            <div className="rounded-md border border-brand-line bg-brand-light/40 px-3 py-2 text-[13px] font-medium text-brand-ink">
              {data.subscriptions.find((r) => r.productId === subProductId)
                ?.productName ??
                data.products.find((p) => p.id === subProductId)?.name ??
                "Subscription"}
            </div>
            <p className="mt-1 text-[11px] text-brand-mute">
              The plan (feature tier) and billing cycle are set by the product.
              Cancelling stops feature access for this subscription.
            </p>
          </Lbl>
          <Lbl label="Status">
            <select
              value={subStatus}
              onChange={(e) =>
                setSubStatus(e.target.value as (typeof SUB_STATUSES)[number])
              }
              className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              {SUB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "paused" ? "paused (on hold)" : s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Lbl>
          {subStatus === "cancelled"
            ? (() => {
                const sub = data.subscriptions.find(
                  (r) => r.productId === subProductId,
                );
                const end = sub?.currentPeriodEnd ?? null;
                const hasFuture = !!end && new Date(end).getTime() > Date.now();
                return (
                  <Lbl label="When to cancel">
                    <select
                      value={subTiming}
                      onChange={(e) =>
                        setSubTiming(e.target.value as "now" | "end_of_cycle")
                      }
                      className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                    >
                      <option value="now">Immediately</option>
                      <option value="end_of_cycle" disabled={!hasFuture}>
                        {hasFuture
                          ? `At end of cycle (${fmtDate(end)})`
                          : "At end of cycle (no period end)"}
                      </option>
                    </select>
                    {subTiming === "end_of_cycle" && hasFuture ? (
                      <p className="mt-1.5 text-[12px] text-brand-mute">
                        Stays active until {fmtDate(end)}, then cancels
                        automatically. No credit — the full paid period is used.
                      </p>
                    ) : null}
                  </Lbl>
                );
              })()
            : null}
          {(() => {
            // Cancelling a live PAID sub IMMEDIATELY → offer credit note / refund
            // for the unused portion (pro-rated). Preview mirrors the server
            // maths. (End-of-cycle cancels carry no credit.)
            const sub = data.subscriptions.find(
              (r) => r.productId === subProductId,
            );
            if (
              subStatus !== "cancelled" ||
              subTiming !== "now" ||
              !sub ||
              !sub.price ||
              sub.price <= 0 ||
              !["trialing", "active", "past_due"].includes(sub.status)
            ) {
              return null;
            }
            const amount = proratedAmount(
              sub.price,
              sub.currentPeriodStart,
              sub.currentPeriodEnd,
            );
            if (amount <= 0) return null;
            const left = daysRemaining(sub.currentPeriodEnd);
            return (
              <div className="rounded-md border border-status-cancelled/30 bg-status-cancelled/5 p-3">
                <Lbl label="Refund the unused portion">
                  <select
                    value={subRefundDoc}
                    onChange={(e) =>
                      setSubRefundDoc(e.target.value as "credit" | "refund")
                    }
                    className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                  >
                    <option value="credit">Credit note (default)</option>
                    <option value="refund">Refund</option>
                  </select>
                </Lbl>
                <p className="mt-1.5 text-[12px] text-brand-mute">
                  {subRefundDoc === "refund" ? "Refund" : "Credit note"} of{" "}
                  <span className="font-semibold text-brand-ink">
                    {formatMoney(amount, sub.currency ?? "ZAR")}
                  </span>{" "}
                  for {left} unused day{left === 1 ? "" : "s"} — posts to the
                  ledger with its document.
                </p>
              </div>
            );
          })()}
        </div>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            disabled={pending || !host || !subProductId}
            onClick={() =>
              host
                ? run(
                    adminUpdateSubscription({
                      hostId: host.id,
                      productId: subProductId || null,
                      status: subStatus,
                      ...(subStatus === "cancelled"
                        ? { refundDoc: subRefundDoc, timing: subTiming }
                        : {}),
                    }),
                    subStatus === "cancelled" && subTiming === "end_of_cycle"
                      ? "Cancellation scheduled for period end."
                      : "Subscription updated.",
                  )
                : undefined
            }
          >
            Save subscription
          </Button>
        </FormModalFooter>
      </FormModal>

      <BusinessEditModal
        business={editBiz}
        onClose={() => setEditBiz(null)}
        onSaved={() => {
          setEditBiz(null);
          router.refresh();
        }}
      />
    </div>
  );
}

// Admin-side editor for a host's business (legal entity). Mirrors the host
// BusinessForm fields, but saves through the audited admin action so any host's
// business is editable and the change lands on the Activity tab.
function BusinessEditModal({
  business,
  onClose,
  onSaved,
}: {
  business: BusinessItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    trading_name: "",
    legal_name: "",
    vat_number: "",
    company_registration_number: "",
    address_line1: "",
    address_line2: "",
    city: "",
    municipality: "",
    province: "",
    postal_code: "",
    country: "ZA",
    default_currency: "ZAR",
    default_language: "en",
  });

  // Re-seed the form whenever a different business is opened.
  const seedId = business?.id ?? null;
  useEffect(() => {
    if (!business) return;
    setForm({
      trading_name: business.tradingName,
      legal_name: business.legalName,
      vat_number: business.vatNumber,
      company_registration_number: business.companyRegistrationNumber,
      address_line1: business.addressLine1,
      address_line2: business.addressLine2,
      city: business.city,
      municipality: business.municipality,
      province: business.province,
      postal_code: business.postalCode,
      country: business.country || "ZA",
      default_currency: business.defaultCurrency || "ZAR",
      default_language: business.defaultLanguage || "en",
    });
    // seedId tracks identity so we only re-seed on open / business switch.
  }, [seedId, business]);

  const set = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!business) return;
    if (!form.trading_name.trim()) {
      toast.error("Give the business a name.");
      return;
    }
    if (form.country.trim().length !== 2) {
      toast.error("Use a 2-letter country code, e.g. ZA.");
      return;
    }
    start(async () => {
      const r = await adminUpdateBusiness({
        businessId: business.id,
        ...form,
        country: form.country.trim().toUpperCase(),
      });
      if (r.ok) {
        toast.success("Business updated.");
        onSaved();
      } else toast.error(r.error ?? "Failed.");
    });
  };

  return (
    <FormModal
      open={!!business}
      onOpenChange={(o) => (o ? null : onClose())}
      title="Edit business"
      description="These details print on this host's quotes, invoices and credit notes."
    >
      <div className="space-y-4">
        <Lbl label="Trading name">
          <Input
            value={form.trading_name}
            onChange={(e) => set("trading_name", e.target.value)}
          />
        </Lbl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Lbl label="Legal name">
            <Input
              value={form.legal_name}
              onChange={(e) => set("legal_name", e.target.value)}
            />
          </Lbl>
          <Lbl label="VAT number">
            <Input
              value={form.vat_number}
              onChange={(e) => set("vat_number", e.target.value)}
            />
          </Lbl>
        </div>
        <Lbl label="Company registration number">
          <Input
            value={form.company_registration_number}
            onChange={(e) => set("company_registration_number", e.target.value)}
          />
        </Lbl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Lbl label="Currency">
            <Select
              value={form.default_currency}
              onChange={(e) => set("default_currency", e.target.value)}
            >
              {DISPLAY_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} · {CURRENCY_META[c].label}
                </option>
              ))}
            </Select>
          </Lbl>
          <Lbl label="Language">
            <Select
              value={form.default_language}
              onChange={(e) => set("default_language", e.target.value)}
            >
              {BUSINESS_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {BUSINESS_LOCALE_LABELS[l]}
                </option>
              ))}
            </Select>
          </Lbl>
        </div>
        <Lbl label="Address line 1">
          <Input
            value={form.address_line1}
            onChange={(e) => set("address_line1", e.target.value)}
          />
        </Lbl>
        <Lbl label="Address line 2">
          <Input
            value={form.address_line2}
            onChange={(e) => set("address_line2", e.target.value)}
          />
        </Lbl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Lbl label="City">
            <Input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Lbl>
          <Lbl label="Municipality">
            <Input
              value={form.municipality}
              onChange={(e) => set("municipality", e.target.value)}
            />
          </Lbl>
          <Lbl label="Province">
            <Input
              value={form.province}
              onChange={(e) => set("province", e.target.value)}
            />
          </Lbl>
          <Lbl label="Postal code">
            <Input
              value={form.postal_code}
              onChange={(e) => set("postal_code", e.target.value)}
            />
          </Lbl>
        </div>
        <Lbl label="Country (2-letter code)">
          <Input
            value={form.country}
            maxLength={2}
            onChange={(e) => set("country", e.target.value.toUpperCase())}
          />
        </Lbl>
      </div>
      <FormModalFooter>
        <FormModalCancel onClick={onClose} />
        <Button disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save business"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}

// Shows on financial tabs: read-only notice + request-access, or the active grant.
function SupportBanner({
  support,
  isHost,
  onRequest,
}: {
  support: UserRecordData["support"];
  isHost: boolean;
  onRequest: () => void;
}) {
  if (!isHost) return null;
  if (support?.active) {
    return (
      <div className="rounded-card border border-status-confirmed/30 bg-status-confirmed/10 px-4 py-2.5 text-[12.5px] font-semibold text-status-confirmed">
        Host-approved edit access is active
        {support.expiresAt
          ? ` until ${new Date(support.expiresAt).toLocaleString("en-ZA", {
              dateStyle: "medium",
              timeStyle: "short",
            })}`
          : ""}
        .
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
      <span>
        Financial records are <span className="font-semibold">read-only</span>.
        {support?.status === "pending"
          ? " A support request is awaiting the host's approval."
          : " Request the host's permission to make changes."}
      </span>
      {support?.status !== "pending" ? (
        <button
          type="button"
          onClick={onRequest}
          className="rounded-pill bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700"
        >
          Request edit access
        </button>
      ) : null}
    </div>
  );
}

// ── Dossier ──────────────────────────────────────────────────────────────
function Dossier({
  data,
  onEdit,
  onRole,
  onSuspend,
  onDelete,
  onPurge,
  onReinstate,
  onRestore,
  onResetPassword,
  pending,
}: {
  data: UserRecordData;
  onEdit: () => void;
  onRole: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  onPurge: () => void;
  onReinstate: () => void;
  onRestore: () => void;
  onResetPassword: () => void;
  pending: boolean;
}) {
  const { user, host } = data;
  const isDeleted = Boolean(user.deleted_at);
  const purgeEligible = isPurgeEligible(user.deleted_at);
  const holdDaysLeft = Math.max(
    0,
    DELETED_ACCOUNT_HOLD_DAYS - daysSinceDeleted(user.deleted_at),
  );
  const sep = <div className="h-px bg-brand-line" />;
  const eyebrow =
    "text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-mute";
  const paidToWielo = data.wieloLedger
    .filter((t) => t.status === "completed" && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex flex-col gap-5 p-6">
        {/* identity */}
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                className="h-16 w-16 rounded-pill object-cover ring-2 ring-brand-accent"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-brand-secondary font-display text-xl font-bold text-white ring-2 ring-brand-accent">
                {initials(user.full_name, user.email)}
              </div>
            )}
            {host?.is_verified ? (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
                <BadgeCheck className="h-3 w-3" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[20px] font-extrabold leading-tight text-brand-ink">
              {user.full_name ?? "—"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <RolePill role={user.role} />
              {!user.is_active ? <Pill tone="bad">Suspended</Pill> : null}
              {user.deleted_at ? <Pill tone="bad">Deleted</Pill> : null}
              {user.is_lead ? <Pill tone="muted">Passwordless</Pill> : null}
            </div>
          </div>
        </div>

        {/* quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <ActBtn icon={Pencil} label="Edit" onClick={onEdit} />
          <ActBtn icon={UserCog} label="Role" onClick={onRole} />
          {isDeleted ? (
            // Deleted account (in the 30-day hold): restore brings it fully back;
            // permanent delete is only unlocked once the hold has elapsed.
            <>
              <ActBtn
                icon={RotateCcw}
                label="Restore"
                onClick={onRestore}
                disabled={pending}
              />
              <ActBtn
                icon={Trash2}
                label="Delete forever"
                onClick={onPurge}
                disabled={pending || !purgeEligible}
                danger
              />
            </>
          ) : (
            <>
              {user.is_active ? (
                <ActBtn icon={Shield} label="Suspend" onClick={onSuspend} />
              ) : (
                <ActBtn
                  icon={Shield}
                  label="Reinstate"
                  onClick={onReinstate}
                  disabled={pending}
                />
              )}
              <ActBtn icon={Trash2} label="Delete" onClick={onDelete} danger />
            </>
          )}
          <ActBtn
            icon={KeyRound}
            label="Reset password"
            onClick={onResetPassword}
            disabled={pending}
          />
        </div>
        {isDeleted ? (
          <p className="-mt-2 text-[11px] leading-snug text-brand-mute">
            {purgeEligible
              ? "The 30-day hold has passed — this account can now be permanently deleted."
              : `In the ${DELETED_ACCOUNT_HOLD_DAYS}-day hold — permanent delete unlocks in ${holdDaysLeft} day${holdDaysLeft === 1 ? "" : "s"}.`}
          </p>
        ) : null}
        {host ? (
          <ImpersonateButton
            userId={user.id}
            label="View as host"
            className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
          />
        ) : null}

        {sep}

        {/* contact */}
        <div>
          <div className={`${eyebrow} mb-2.5`}>Contact</div>
          <div className="flex flex-col gap-2.5 text-[12.5px]">
            {user.email ? (
              <a
                href={`mailto:${user.email}`}
                className="flex items-center gap-2.5 text-brand-ink hover:text-brand-primary"
              >
                <Mail className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="truncate">{user.email}</span>
              </a>
            ) : null}
            {user.phone ? (
              <a
                href={`tel:${user.phone}`}
                className="flex items-center gap-2.5 text-brand-ink hover:text-brand-primary"
              >
                <Phone className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="truncate">{user.phone}</span>
              </a>
            ) : null}
            {user.country ? (
              <div className="flex items-center gap-2.5 text-brand-mute">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{user.country}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2.5 text-brand-mute">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Joined {fmtDate(user.created_at)}</span>
            </div>
          </div>
        </div>

        {sep}

        {/* verification */}
        <div>
          <div className={`${eyebrow} mb-2.5`}>Verified</div>
          <div className="flex flex-wrap gap-1.5">
            {user.phone_verified_at ? <Pill tone="good">Phone</Pill> : null}
            {user.id_verified_at ? <Pill tone="good">ID</Pill> : null}
            {host?.is_verified ? <Pill tone="good">Host verified</Pill> : null}
            {!user.phone_verified_at &&
            !user.id_verified_at &&
            !host?.is_verified ? (
              <span className="text-[12px] text-brand-mute">
                Nothing verified yet.
              </span>
            ) : null}
          </div>
        </div>

        {sep}

        {/* lifetime */}
        <div>
          <div className={`${eyebrow} mb-3`}>Lifetime</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DStat
              label="Bookings (guest)"
              value={String(data.counts.bookingsAsGuest)}
            />
            <DStat
              label="Paid to Wielo"
              value={formatMoney(paidToWielo, "ZAR")}
            />
            {host ? (
              <DStat label="Listings" value={String(data.counts.listings)} />
            ) : null}
            {host ? (
              <DStat
                label="Host rating"
                value={
                  host.avg_rating
                    ? `${Number(host.avg_rating).toFixed(1)} ★`
                    : "—"
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Panels ───────────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  count,
  children,
  empty,
}: {
  icon: typeof Calendar;
  title: string;
  count: number;
  children: React.ReactNode;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
        <Icon className="h-4 w-4 text-brand-mute" />
        <span className="font-display text-[15px] font-bold text-brand-ink">
          {title}
        </span>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-brand-mute">
          {empty}
        </div>
      ) : (
        <div>{children}</div>
      )}
    </section>
  );
}

function RowLink({
  href,
  primary,
  secondary,
  amount,
  status,
}: {
  href?: string;
  primary: string;
  secondary: string;
  amount?: string;
  status?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-brand-ink">
          {primary}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
          {secondary}
        </div>
      </div>
      {amount ? (
        <div className="font-display text-[13px] font-bold tabular-nums text-brand-ink">
          {amount}
        </div>
      ) : null}
      {status ? (
        <span className="shrink-0 rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold capitalize text-brand-mute">
          {status.replace(/_/g, " ")}
        </span>
      ) : null}
      {href ? (
        <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute" />
      ) : null}
    </>
  );
  const cls =
    "flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-brand-light/50`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

// Present the current Wielo account balance as a due / credit / settled figure.
// + = the user owes Wielo (amber), − = they hold a credit (green), ~0 = settled.
function wieloBalanceView(balance: number): {
  label: string;
  value: string;
  tone: "amber" | "green" | "neutral";
} {
  if (balance > 0.005)
    return {
      label: "Owes Wielo",
      value: `${formatMoney(balance, "ZAR")} due`,
      tone: "amber",
    };
  if (balance < -0.005)
    return {
      label: "Wielo credit",
      value: `${formatMoney(Math.abs(balance), "ZAR")} credit`,
      tone: "green",
    };
  return { label: "Wielo balance", value: "Settled", tone: "neutral" };
}

function OverviewPanel({ data }: { data: UserRecordData }) {
  const { user, host } = data;
  const s = data.subscription;
  const aff = data.affiliateStats;

  const paidToWielo = data.wieloLedger
    .filter((t) => t.type === "charge" && t.status === "completed")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const accountState = user.deleted_at
    ? { label: "Deleted", cls: "border-red-200 bg-red-50 text-red-600" }
    : !user.is_active
      ? { label: "Suspended", cls: "border-red-200 bg-red-50 text-red-600" }
      : user.is_lead
        ? {
            label: "Unclaimed",
            cls: "border-amber-200 bg-amber-50 text-amber-700",
          }
        : {
            label: "Active",
            cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
          };

  const memberDays = user.created_at
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(user.created_at).getTime()) / 86_400_000,
        ),
      )
    : null;

  const stats: {
    label: string;
    value: string;
    sub?: string;
    icon: LucideIcon;
    tone?: "green" | "amber";
  }[] = [];
  if (host) {
    stats.push({
      label: "Listings",
      value: String(data.counts.listings),
      icon: Home,
    });
    stats.push({
      label: "Bookings hosted",
      value: String(host.total_bookings ?? 0),
      icon: CalendarCheck,
    });
    stats.push({
      label: "Rating",
      value: host.avg_rating ? host.avg_rating.toFixed(1) : "—",
      sub: `${host.total_reviews ?? 0} reviews`,
      icon: Star,
    });
  }
  stats.push({
    label: "Trips booked",
    value: String(data.counts.bookingsAsGuest),
    icon: Calendar,
  });
  // Total affiliate commissions the user has earned (0 if they're not an affiliate).
  stats.push({
    label: "Commissions",
    value: formatMoney(aff?.earned ?? 0, aff?.currency ?? "ZAR"),
    sub: aff ? `${aff.signups} signups` : undefined,
    icon: Gift,
  });
  // Paid to Wielo is the headline money figure — greenish.
  stats.push({
    label: "Paid to Wielo",
    value: formatMoney(paidToWielo, "ZAR"),
    icon: CreditCard,
    tone: "green",
  });
  // Current Wielo balance — what they still owe (amber) or their credit (green),
  // straight off the ledger's running per-user balance. Always last so the
  // admin can see at a glance whether the account is settled.
  const balView = wieloBalanceView(data.wieloBalance);
  stats.push({
    label: balView.label,
    value: balView.value,
    icon: Wallet,
    tone: balView.tone === "neutral" ? undefined : balView.tone,
  });

  return (
    <div className="space-y-5">
      {/* Status + verification chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold ${accountState.cls}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {accountState.label}
        </span>
        <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold capitalize text-brand-mute">
          {user.role ?? "guest"}
        </span>
        {host?.is_verified ? (
          <Chip icon={BadgeCheck} label="Verified host" tone="good" />
        ) : null}
        {user.phone_verified_at ? (
          <Chip icon={Phone} label="Phone verified" tone="good" />
        ) : null}
        {user.id_verified_at ? (
          <Chip icon={Shield} label="ID verified" tone="good" />
        ) : null}
        {aff ? (
          <Chip icon={Gift} label={`Affiliate · /r/${data.affiliateSlug}`} />
        ) : null}
      </div>

      {/* Stat band */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-brand-line bg-brand-line sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((st) => (
          <div
            key={st.label}
            className={`p-4 ${
              st.tone === "green"
                ? "bg-brand-primary/5"
                : st.tone === "amber"
                  ? "bg-amber-50"
                  : "bg-white"
            }`}
          >
            <div
              className={`flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider ${
                st.tone === "green"
                  ? "text-brand-primary"
                  : st.tone === "amber"
                    ? "text-amber-700"
                    : "text-brand-mute"
              }`}
            >
              <st.icon className="h-3.5 w-3.5" /> {st.label}
            </div>
            <div
              className={`num mt-1.5 font-display text-[20px] font-bold leading-none ${
                st.tone === "green"
                  ? "text-brand-primary"
                  : st.tone === "amber"
                    ? "text-amber-700"
                    : "text-brand-ink"
              }`}
            >
              {st.value}
            </div>
            {st.sub ? (
              <div className="mt-1 text-[11px] text-brand-mute">{st.sub}</div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Details + highlights */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Snapshot facts */}
        <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h3 className="mb-3 font-display text-[14px] font-bold text-brand-ink">
            Account
          </h3>
          <dl className="space-y-2.5">
            <IconFact icon={Mail} k="Email" v={user.email} mono />
            <IconFact icon={Phone} k="Phone" v={user.phone} mono />
            <IconFact icon={Globe} k="Country" v={user.country} />
            <IconFact
              icon={Calendar}
              k="Joined"
              v={
                user.created_at
                  ? `${fmtDate(user.created_at)}${
                      memberDays != null ? ` · ${memberDays}d ago` : ""
                    }`
                  : null
              }
            />
            {host ? (
              <IconFact icon={Home} k="Host handle" v={`@${host.handle}`} />
            ) : null}
            <IconFact
              icon={KeyRound}
              k="Account"
              v={user.is_lead ? "Passwordless (unclaimed)" : "Claimed"}
            />
          </dl>
        </section>

        {/* Subscription / affiliate highlight */}
        <div className="space-y-5">
          {host ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card">
              <h3 className="mb-3 font-display text-[14px] font-bold text-brand-ink">
                Subscription
              </h3>
              {s ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold capitalize text-brand-ink">
                      {data.subscriptions.find(
                        (r) => r.productType === "membership",
                      )?.productName ?? s.plan}
                    </span>
                    <SubStatusPill status={s.status} />
                    {(() => {
                      const services = data.subscriptions.filter(
                        (r) =>
                          r.productType === "service" &&
                          ["trialing", "active", "past_due"].includes(r.status),
                      ).length;
                      return services > 0 ? (
                        <span className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                          +{services} service{services > 1 ? "s" : ""}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <dl className="grid grid-cols-2 gap-2.5">
                    <IconFact icon={CreditCard} k="Cycle" v={s.billing_cycle} />
                    <IconFact
                      icon={Calendar}
                      k="Renews"
                      v={fmtDate(s.current_period_end)}
                    />
                  </dl>
                </div>
              ) : (
                <p className="text-[13px] text-brand-mute">
                  No subscription on file yet.
                </p>
              )}
            </section>
          ) : null}

          {aff ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card">
              <h3 className="mb-3 flex items-center gap-1.5 font-display text-[14px] font-bold text-brand-ink">
                <Gift className="h-4 w-4 text-brand-mute" /> Affiliate
              </h3>
              <div className="font-mono text-[12px] text-brand-mute">
                /r/{data.affiliateSlug}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2.5">
                <IconFact icon={Users} k="Signups" v={String(aff.signups)} />
                <IconFact
                  icon={CreditCard}
                  k="Available"
                  v={formatMoney(aff.available, aff.currency)}
                />
                <IconFact
                  icon={BadgeCheck}
                  k="Paid out"
                  v={formatMoney(aff.paid, aff.currency)}
                />
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// A small labelled chip with an icon, for the overview status row.
function Chip({
  icon: Icon,
  label,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  tone?: "good" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-brand-line bg-brand-light text-brand-mute";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

// A fact row with a leading icon (richer than the bare Fact dl).
function IconFact({
  icon: Icon,
  k,
  v,
  mono,
}: {
  icon: LucideIcon;
  k: string;
  v: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-mute" />
      <div className="min-w-0">
        <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
          {k}
        </dt>
        <dd
          className={`truncate text-[13px] text-brand-ink ${mono ? "font-mono" : ""}`}
        >
          {v || "—"}
        </dd>
      </div>
    </div>
  );
}

const SUB_TYPE_LABEL: Record<string, string> = {
  membership: "Membership",
  service: "Service",
  product: "Product",
};

function ProductsPanel({
  data,
  onManage,
}: {
  data: UserRecordData;
  onManage: (productId: string | null, status: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const hostId = data.host?.id ?? null;
  // A guest has no host yet — activating a product provisions one server-side,
  // so the catalog works off the userId even before they're a host.
  const userId = data.user.id;
  const subs = data.subscriptions;

  const LIVE = ["trialing", "active", "past_due"];
  const isLive = (st: string) => LIVE.includes(st);

  // Which catalog products already sit on the account (a linked subscription).
  const subByProduct = new Map(
    subs.filter((r) => r.productId).map((r) => [r.productId as string, r]),
  );
  const activeMembership = subs.find(
    (r) => r.productType === "membership" && isLive(r.status),
  );

  // Charge-confirm dialog: activating a PAID product posts a money document.
  // A membership SWITCH is a pro-rated upgrade (bill only the unused
  // difference); a fresh activation / service add bills the full price.
  type CatalogProduct = UserRecordData["products"][number];
  const [charge, setCharge] = useState<{
    product: CatalogProduct;
    amount: number;
    isUpgrade: boolean;
  } | null>(null);
  // When the admin picks "Send pay-link", the tier activates and this holds the
  // generated custom-amount pay-link to copy/send to the buyer.
  const [payLink, setPayLink] = useState<string | null>(null);
  // Timing of an UPGRADE: now (charge/pay-link) or scheduled for period end.
  const [chargeTiming, setChargeTiming] = useState<"now" | "end_of_cycle">(
    "now",
  );
  // Optional per-activation Wielo Credits override (blank = the product default).
  const [creditOverride, setCreditOverride] = useState("");
  const parsedOverride = (): number | null => {
    const t = creditOverride.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const closeCharge = () => {
    setCharge(null);
    setPayLink(null);
    setChargeTiming("now");
    setCreditOverride("");
  };

  // Manual "Assign credits" now lives in the always-visible CreditsCard at the
  // top of the record (see UserRecord) — removed from here to avoid a second,
  // divergent balance state.

  // Sell a ONCE-OFF product (separate from the subscription charge dialog).
  const [sell, setSell] = useState<CatalogProduct | null>(null);
  const [sellLink, setSellLink] = useState<string | null>(null);
  const closeSell = () => {
    setSell(null);
    setSellLink(null);
  };
  function doSell(productId: string, mode: "paid" | "paylink") {
    setBusyId(productId);
    start(async () => {
      const r = await sellProduct({
        hostId: hostId ?? undefined,
        userId,
        productId,
        mode,
      });
      setBusyId(null);
      if (r.ok) {
        if (mode === "paylink" && r.payUrl) {
          setSellLink(r.payUrl);
          toast.success("Pay-link created.");
        } else {
          closeSell();
          toast.success("Product sold — charge posted to the ledger.");
        }
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function previewDelta(p: CatalogProduct): {
    amount: number;
    isUpgrade: boolean;
  } {
    if (p.isFree || p.price <= 0) return { amount: 0, isUpgrade: false };
    if (
      p.productType === "membership" &&
      activeMembership &&
      activeMembership.productId !== p.id
    ) {
      const amount = proratedAmount(
        Math.max(0, p.price - (activeMembership.price ?? 0)),
        activeMembership.currentPeriodStart,
        activeMembership.currentPeriodEnd,
      );
      return { amount, isUpgrade: true };
    }
    return { amount: round2(p.price), isUpgrade: false };
  }

  function onCatalogClick(p: CatalogProduct) {
    const { amount, isUpgrade } = previewDelta(p);
    setChargeTiming("now");
    // Open the confirm dialog for any membership switch (to offer now vs
    // end-of-cycle timing — incl. a same-price/cheaper downgrade) or whenever a
    // charge is due; otherwise (free/zero, non-switch) just activate.
    if (isUpgrade || amount > 0) setCharge({ product: p, amount, isUpgrade });
    else activate(p.id, "none");
  }

  // Schedule an upgrade/switch for the current membership's period end.
  function scheduleSwitch(productId: string) {
    if (!hostId) return;
    setBusyId(productId);
    start(async () => {
      const r = await setUserProduct({
        hostId,
        productId,
        timing: "end_of_cycle",
      });
      setBusyId(null);
      if (r.ok) {
        closeCharge();
        toast.success("Switch scheduled for period end.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function activate(productId: string, mode: "paid" | "none") {
    setBusyId(productId);
    start(async () => {
      const r = await setUserProduct({
        hostId: hostId ?? undefined,
        userId,
        productId,
        charge: mode,
        creditOverride: parsedOverride(),
      });
      setBusyId(null);
      if (r.ok) {
        closeCharge();
        toast.success(
          mode === "paid"
            ? "Activated — charge posted to the ledger."
            : "Product added to this account.",
        );
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  // Activate now + generate a custom-amount pay-link for the pro-rated delta; the
  // dialog stays open to reveal the link for the admin to copy/send.
  function sendPayLink(productId: string) {
    setBusyId(productId);
    start(async () => {
      const r = await setUserProduct({
        hostId: hostId ?? undefined,
        userId,
        productId,
        charge: "paylink",
      });
      setBusyId(null);
      if (r.ok) {
        // Deferred activation: the subscription is unchanged until the buyer
        // pays, so there's nothing to refresh — just reveal the link.
        if (r.payUrl) {
          setPayLink(r.payUrl);
          toast.success("Upgrade card sent to the buyer's inbox.");
        } else {
          closeCharge();
          toast.success("Done.");
        }
      } else {
        toast.error(r.error);
      }
    });
  }

  // Void a pending "apply at end of cycle" scheduled change.
  function voidSchedule(changeId: string) {
    if (!hostId) return;
    start(async () => {
      const r = await cancelScheduledChange({ hostId, changeId });
      if (r.ok) {
        toast.success("Scheduled change cancelled.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const cycleLabel: Record<string, string> = {
    weekly: "week",
    monthly: "month",
    quarterly: "quarter",
    biannual: "6 months",
    annual: "year",
  };

  const memberships = data.products.filter(
    (p) => p.productType === "membership",
  );
  const services = data.products.filter((p) => p.productType === "service");
  // Once-off products are SOLD (order + charge), not activated as a subscription.
  const oneOffProducts = data.products.filter(
    (p) => p.productType === "product",
  );
  // Wielo Credits packages — also SOLD (order + charge); paying grants the credits
  // to the buyer's wallet (grantCreditsForOrder on the paid order).
  const creditPackages = data.products.filter(
    (p) => p.productType === "wielo_credits",
  );

  // A once-off product card with a "Sell" button (opens the sell dialog).
  const renderOneOff = (p: UserRecordData["products"][number]) => (
    <div
      key={p.id}
      className="relative flex flex-col rounded-card border border-brand-line bg-white p-5 shadow-card"
    >
      <div className="font-display text-base font-bold text-brand-ink">
        {p.name}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold text-brand-ink">
          {p.isFree ? "Free" : formatMoney(p.price, p.currency)}
        </span>
        <span className="text-xs text-brand-mute">one-off</span>
      </div>
      {p.bullets.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {p.bullets.slice(0, 4).map((b, i) => (
            <li key={i} className="text-[12px] leading-snug text-brand-mute">
              • {b}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex items-center gap-2 pt-1">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            setSellLink(null);
            setSell(p);
          }}
        >
          Sell
        </Button>
        <Link
          href={`/admin/products/${p.id}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Edit
        </Link>
      </div>
    </div>
  );

  // A Wielo Credits package card — SOLD like a once-off product (same Sell
  // dialog), but headlined by the credit quantity it grants.
  const renderCreditPack = (p: UserRecordData["products"][number]) => (
    <div
      key={p.id}
      className="relative flex flex-col rounded-card border border-brand-line bg-white p-5 shadow-card"
    >
      <div className="font-display text-base font-bold text-brand-ink">
        {p.name}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-bold text-brand-primary">
          {p.creditQuantity ?? 0}
        </span>
        <span className="text-xs text-brand-mute">credits</span>
      </div>
      <div className="mt-1 text-[13px] font-semibold text-brand-ink">
        {p.isFree ? "Free" : formatMoney(p.price, p.currency)}
      </div>
      {p.bullets.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {p.bullets.slice(0, 4).map((b, i) => (
            <li key={i} className="text-[12px] leading-snug text-brand-mute">
              • {b}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex items-center gap-2 pt-1">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            setSellLink(null);
            setSell(p);
          }}
        >
          Sell
        </Button>
        <Link
          href={`/admin/products/${p.id}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Edit
        </Link>
      </div>
    </div>
  );

  // One catalog card (add / switch / manage). `kind` drives the button label.
  const renderCatalog = (p: UserRecordData["products"][number]) => {
    const linked = subByProduct.get(p.id);
    const onAccount = !!linked && isLive(linked.status);
    const cycle = cycleLabel[p.billingCycle ?? "monthly"] ?? "month";
    const isMembership = p.productType === "membership";
    const canSwitchMembership =
      isMembership && !onAccount && !!activeMembership;
    return (
      <div
        key={p.id}
        className={`relative flex flex-col rounded-card border p-5 shadow-card ${
          onAccount
            ? "border-brand-primary ring-1 ring-brand-primary"
            : "border-brand-line"
        } bg-white`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="font-display text-base font-bold text-brand-ink">
            {p.name}
          </div>
          {onAccount ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10.5px] font-semibold text-status-confirmed">
              <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
              Active
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="font-display text-2xl font-bold text-brand-ink">
            {p.isFree ? "Free" : formatMoney(p.price, p.currency)}
          </span>
          {!p.isFree ? (
            <span className="text-xs text-brand-mute">/{cycle}</span>
          ) : null}
        </div>
        {p.bullets.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {p.bullets.slice(0, 4).map((b, i) => (
              <li key={i} className="text-[12px] leading-snug text-brand-mute">
                • {b}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex items-center gap-2 pt-1">
          {onAccount ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onManage(linked!.productId, linked!.status)}
            >
              Manage
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onCatalogClick(p)}
            >
              {busyId === p.id
                ? "Working…"
                : canSwitchMembership
                  ? "Switch to this"
                  : isMembership
                    ? "Activate"
                    : "Add"}
            </Button>
          )}
          <Link
            href={`/admin/products/${p.id}`}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active subscriptions — 1 membership + N services */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Subscriptions{subs.length ? ` (${subs.length})` : ""}
          </div>
        </div>
        {subs.length === 0 ? (
          <section className="rounded-card border border-brand-line bg-white p-5 text-sm text-brand-mute shadow-card">
            No subscriptions on file yet. Add one from the catalog below.
          </section>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {subs.map((r) => {
              const cycle = cycleLabel[r.billingCycle ?? "monthly"] ?? "month";
              return (
                <div
                  key={r.id}
                  className="flex flex-col rounded-card border border-brand-line bg-white p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-bold text-brand-ink">
                          {r.productName ?? r.plan}
                        </span>
                        {r.productType ? (
                          <span className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
                            {SUB_TYPE_LABEL[r.productType] ?? r.productType}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1">
                        <SubStatusPill status={r.status} />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onManage(r.productId, r.status)}
                    >
                      Manage
                    </Button>
                  </div>
                  {r.price != null ? (
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="font-display text-xl font-bold text-brand-ink">
                        {r.price <= 0
                          ? "Free"
                          : formatMoney(r.price, r.currency ?? "ZAR")}
                      </span>
                      {r.price > 0 ? (
                        <span className="text-xs text-brand-mute">
                          /{cycle}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Fact k="Renews" v={fmtDate(r.currentPeriodEnd)} />
                    <Fact k="Trial ends" v={fmtDate(r.trialEndsAt)} />
                  </dl>
                  {r.scheduledChange ? (
                    <div className="mt-3 flex items-start justify-between gap-2 rounded-md border border-status-pending/30 bg-status-pending/5 p-2.5">
                      <p className="text-[12px] leading-snug text-brand-ink">
                        <span className="font-semibold">Scheduled:</span>{" "}
                        {r.scheduledChange.kind === "cancel"
                          ? "cancels"
                          : `switches to ${r.scheduledChange.targetName ?? "another plan"}`}{" "}
                        on {fmtDate(r.scheduledChange.effectiveAt)}.
                      </p>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => voidSchedule(r.scheduledChange!.id)}
                        className="shrink-0 text-[12px] font-medium text-brand-primary hover:underline disabled:opacity-50"
                      >
                        Undo
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Once-off product purchases */}
      {data.productPurchases.length > 0 ? (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Product purchases ({data.productPurchases.length})
          </div>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <table className="w-full text-[13px]">
              <tbody>
                {data.productPurchases.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-brand-line last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-brand-ink">
                      {o.productName}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-brand-ink">
                      {formatMoney(o.amount, o.currency)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-brand-mute">
                      {fmtDate(o.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Catalog — add a membership / service */}
      <div>
        <div className="mb-2 text-[12px] text-brand-mute">
          Catalog. A host holds one membership + any number of services. Add or
          switch below; edit a product in the Products hub.
        </div>
        {data.products.length === 0 ? (
          <section className="rounded-card border border-brand-line bg-white p-5 text-sm text-brand-mute shadow-card">
            No subscription products configured yet.
          </section>
        ) : (
          <div className="space-y-5">
            {memberships.length > 0 ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Memberships
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {memberships.map(renderCatalog)}
                </div>
              </div>
            ) : null}
            {services.length > 0 ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Services
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map(renderCatalog)}
                </div>
              </div>
            ) : null}
            {oneOffProducts.length > 0 ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Products (one-off)
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {oneOffProducts.map(renderOneOff)}
                </div>
              </div>
            ) : null}
            {creditPackages.length > 0 ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Credit packages
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {creditPackages.map(renderCreditPack)}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Sell a once-off product */}
      <FormModal
        open={!!sell}
        onOpenChange={(o) => (o ? null : closeSell())}
        title="Sell product"
        description="A once-off sale — record it as paid, or send a pay-link."
      >
        {sell ? (
          <div className="space-y-4">
            <Lbl label="Product">
              <div className="rounded-md border border-brand-line bg-brand-light/40 px-3 py-2 text-[13px] font-medium text-brand-ink">
                {sell.name}
              </div>
            </Lbl>
            <div className="rounded-md border border-brand-primary/30 bg-brand-primary/5 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Price
              </div>
              <div className="mt-0.5 font-display text-xl font-bold text-brand-ink">
                {sell.isFree ? "Free" : formatMoney(sell.price, sell.currency)}
              </div>
              <p className="mt-1 text-[12px] text-brand-mute">
                <span className="font-medium text-brand-ink">Mark as paid</span>{" "}
                records a completed sale + invoice now;{" "}
                <span className="font-medium text-brand-ink">
                  send a pay-link
                </span>{" "}
                bills the buyer (a pay card lands in their Wielo inbox).
              </p>
            </div>
            {sellLink ? (
              <div className="rounded-md border border-status-confirmed/30 bg-status-confirmed/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Pay-link created
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    readOnly
                    value={sellLink}
                    className="min-w-0 flex-1 truncate rounded-md border border-brand-line bg-white px-2 py-1.5 text-[12px] text-brand-ink"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard?.writeText(sellLink);
                      toast.success("Link copied.");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <FormModalFooter>
          {sellLink ? (
            <Button onClick={closeSell}>Done</Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={pending || !sell}
                onClick={() => sell && doSell(sell.id, "paylink")}
              >
                Send pay-link
              </Button>
              <Button
                disabled={pending || !sell}
                onClick={() => sell && doSell(sell.id, "paid")}
              >
                {pending ? "Working…" : "Mark as paid now"}
              </Button>
            </>
          )}
        </FormModalFooter>
      </FormModal>

      {/* Charge-confirm: a paid upgrade/add posts a money document */}
      <FormModal
        open={!!charge}
        onOpenChange={(o) => (o ? null : closeCharge())}
        title={charge?.isUpgrade ? "Change membership" : "Add to account"}
        description="Choose how and when to apply this change."
      >
        {charge ? (
          <div className="space-y-4">
            <Lbl label={charge.isUpgrade ? "Switch to" : "Product"}>
              <div className="rounded-md border border-brand-line bg-brand-light/40 px-3 py-2 text-[13px] font-medium text-brand-ink">
                {charge.product.name}
              </div>
            </Lbl>
            {charge.amount > 0 ? (
              <div className="rounded-md border border-brand-primary/30 bg-brand-primary/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  {charge.isUpgrade ? "Pro-rated upgrade" : "Charge"}
                </div>
                <div className="mt-0.5 font-display text-xl font-bold text-brand-ink">
                  {formatMoney(charge.amount, charge.product.currency ?? "ZAR")}
                </div>
                {chargeTiming === "now" ? (
                  <p className="mt-1 text-[12px] text-brand-mute">
                    {charge.isUpgrade
                      ? "Only the unused difference vs the current membership is billed. "
                      : ""}
                    <span className="font-medium text-brand-ink">
                      Mark as paid
                    </span>{" "}
                    activates now + posts a completed charge;{" "}
                    <span className="font-medium text-brand-ink">
                      send a pay-link
                    </span>{" "}
                    drops an upgrade card in their inbox — the plan activates
                    once they pay.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] text-brand-mute">
                No charge — this plan is the same price or cheaper. Choose when
                the switch applies below.
              </p>
            )}
            {charge.isUpgrade
              ? (() => {
                  const end = activeMembership?.currentPeriodEnd ?? null;
                  const hasFuture =
                    !!end && new Date(end).getTime() > Date.now();
                  return (
                    <Lbl label="When to apply">
                      <select
                        value={chargeTiming}
                        onChange={(e) =>
                          setChargeTiming(
                            e.target.value as "now" | "end_of_cycle",
                          )
                        }
                        className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                      >
                        <option value="now">Now</option>
                        <option value="end_of_cycle" disabled={!hasFuture}>
                          {hasFuture
                            ? `At end of cycle (${fmtDate(end)})`
                            : "At end of cycle (no period end)"}
                        </option>
                      </select>
                      {chargeTiming === "end_of_cycle" && hasFuture ? (
                        <p className="mt-1.5 text-[12px] text-brand-mute">
                          The switch to {charge.product.name} applies on{" "}
                          {fmtDate(end)}. Nothing is billed now — the new plan
                          starts next cycle.
                        </p>
                      ) : null}
                    </Lbl>
                  );
                })()
              : null}
            {charge.product.creditQuantity != null &&
            charge.product.creditQuantity > 0 ? (
              <Lbl label="Credits this cycle (optional override)">
                <Input
                  type="number"
                  min={0}
                  value={creditOverride}
                  onChange={(e) => setCreditOverride(e.target.value)}
                  placeholder={`Default: ${charge.product.creditQuantity}`}
                />
                <p className="mt-1 text-[12px] text-brand-mute">
                  Leave blank to grant the plan default (
                  {charge.product.creditQuantity}). Set a number to grant that
                  many Wielo Credits for this activation instead.
                </p>
              </Lbl>
            ) : null}
            {payLink ? (
              <div className="rounded-md border border-status-confirmed/30 bg-status-confirmed/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Upgrade card sent to inbox — link for reference
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    readOnly
                    value={payLink}
                    className="min-w-0 flex-1 truncate rounded-md border border-brand-line bg-white px-2 py-1.5 text-[12px] text-brand-ink"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard?.writeText(payLink);
                      toast.success("Link copied.");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="mt-1.5 text-[12px] text-brand-mute">
                  An upgrade card was posted to the buyer&apos;s Wielo inbox
                  with this link. The plan activates the moment they pay it.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        <FormModalFooter>
          {payLink ? (
            <Button onClick={closeCharge}>Done</Button>
          ) : chargeTiming === "end_of_cycle" ? (
            <>
              <FormModalCancel onClick={closeCharge} />
              <Button
                disabled={pending || !charge}
                onClick={() => charge && scheduleSwitch(charge.product.id)}
              >
                {pending ? "Working…" : "Schedule switch"}
              </Button>
            </>
          ) : charge && charge.amount <= 0 ? (
            <>
              <FormModalCancel onClick={closeCharge} />
              <Button
                disabled={pending}
                onClick={() => activate(charge.product.id, "none")}
              >
                {pending ? "Working…" : "Switch now"}
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => charge && activate(charge.product.id, "none")}
                className="text-[13px] font-medium text-brand-mute hover:text-brand-ink disabled:opacity-50"
              >
                Activate without charging
              </button>
              <Button
                variant="outline"
                disabled={pending || !charge}
                onClick={() => charge && sendPayLink(charge.product.id)}
              >
                Send pay-link
              </Button>
              <Button
                disabled={pending || !charge}
                onClick={() => charge && activate(charge.product.id, "paid")}
              >
                {pending ? "Working…" : "Mark as paid now"}
              </Button>
            </>
          )}
        </FormModalFooter>
      </FormModal>
    </div>
  );
}

function SubStatusPill({ status }: { status: string }) {
  const good = status === "active" || status === "trialing";
  const bad =
    status === "cancelled" || status === "expired" || status === "restricted";
  const cls = good
    ? "bg-status-confirmed/10 text-status-confirmed"
    : bad
      ? "bg-status-cancelled/10 text-status-cancelled"
      : "bg-status-pending/10 text-status-pending";
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10.5px] font-semibold capitalize ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const good = ["confirmed", "checked_in", "completed", "paid"].includes(
    status,
  );
  const bad = ["cancelled", "declined", "expired", "no_show"].includes(status);
  const cls = good
    ? "bg-status-confirmed/10 text-status-confirmed"
    : bad
      ? "bg-status-cancelled/10 text-status-cancelled"
      : "bg-status-pending/10 text-status-pending";
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// One filterable standard table of bookings (guest- or host-side).
function BookingsTable({
  title,
  rows,
  showCounterparty,
  counterpartyHeader,
  empty,
}: {
  title: string;
  rows: BookingLite[];
  showCounterparty: boolean;
  counterpartyHeader: string;
  empty: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");

  const statuses = useMemo(
    () => [...new Set(rows.map((r) => r.status))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (needle) {
        const hay = [r.listingName, r.reference, r.counterparty]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "amount") return b.total - a.total;
      const da = a.checkIn ?? "";
      const db = b.checkIn ?? "";
      if (sort === "oldest") return da < db ? -1 : 1;
      return da < db ? 1 : -1; // recent
    });
    return out;
  }, [rows, q, status, sort]);

  const columns: AdminColumn<BookingLite>[] = [
    {
      header: "Listing",
      cell: (b) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">
            {b.listingName}
          </div>
          <div className="truncate font-mono text-[11px] text-brand-mute">
            {b.reference}
          </div>
        </div>
      ),
    },
    ...(showCounterparty
      ? [
          {
            header: counterpartyHeader,
            cell: (b: BookingLite) => (
              <span className="text-[12.5px] text-brand-ink">
                {b.counterparty || "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      header: "Dates",
      cell: (b) => (
        <span className="text-[12px] text-brand-mute">
          {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
        </span>
      ),
    },
    {
      header: "Total",
      align: "right",
      cell: (b) => (
        <span className="font-display text-[13px] font-bold tabular-nums text-brand-ink">
          {formatMoney(b.total, b.currency)}
        </span>
      ),
    },
    { header: "Status", cell: (b) => <StatusPill status={b.status} /> },
    {
      header: "",
      align: "right",
      // The row used to be inert: an admin could see the booking but not open
      // it. The host's own /dashboard/bookings/[id] is scoped to host_id, so it
      // 404s for an admin — /admin/bookings/[id] is the unscoped read-only view.
      cell: (b) => (
        <Link
          href={`/admin/bookings/${b.id}`}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-primary hover:underline"
        >
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-brand-mute" />
        <h3 className="font-display text-[15px] font-bold text-brand-ink">
          {title}
        </h3>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {rows.length}
        </span>
      </div>
      <AdminTable
        columns={columns}
        rows={filtered}
        getKey={(b) => b.id}
        empty={empty}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
              <Search className="h-4 w-4 text-brand-mute" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search listing, reference or guest…"
                className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
              />
            </div>
            <FilterSelect value={status} onChange={setStatus}>
              <option value="all">Any status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={sort} onChange={setSort}>
              <option value="recent">Newest stay</option>
              <option value="oldest">Oldest stay</option>
              <option value="amount">Highest value</option>
            </FilterSelect>
          </div>
        }
        footer={
          <div className="text-[12px] tabular-nums text-brand-mute">
            Showing {filtered.length} of {rows.length}
          </div>
        }
      />
    </div>
  );
}

function BookingsPanel({
  data,
  onRequestSupport,
}: {
  data: UserRecordData;
  onRequestSupport: () => void;
}) {
  return (
    <div className="space-y-8">
      <SupportBanner
        support={data.support}
        isHost={!!data.host}
        onRequest={onRequestSupport}
      />
      <BookingsTable
        title="As guest"
        rows={data.bookingsAsGuest}
        showCounterparty={false}
        counterpartyHeader="Guest"
        empty="No bookings as a guest."
      />
      {data.host ? (
        <BookingsTable
          title="As host"
          rows={data.bookingsAsHost}
          showCounterparty
          counterpartyHeader="Guest"
          empty="No bookings hosted yet."
        />
      ) : null}
    </div>
  );
}

// Finance-action buttons that sit to the right of the ledger pills.
const FIN_ACTIONS: {
  key: WieloFinanceAction;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}[] = [
  { key: "payment", label: "Record payment", icon: CreditCard },
  { key: "refund", label: "Refund", icon: RotateCcw },
  { key: "credit", label: "Credit note", icon: FileMinus },
  { key: "adjustment", label: "Adjustment", icon: SlidersHorizontal },
  { key: "link", label: "Payment link", icon: Link2, primary: true },
];

function LedgerPanel({
  data,
  onRequestSupport,
}: {
  data: UserRecordData;
  onRequestSupport: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // The user↔Wielo ledger is the primary view (subscriptions, products, refunds,
  // credits). The user↔user booking ledger (their guests → them) is secondary
  // and only rendered when the admin toggles to it — hidden otherwise.
  const hasBookings = !!(data.host && data.hostFinance);
  const [view, setView] = useState<"wielo" | "bookings">("wielo");
  const showBookings = hasBookings && view === "bookings";
  // Host-approved support access — gates managing the BOOKING ledger (guest↔host).
  const supportActive = !!data.support?.active;

  // Wielo finance modals (record / refund / credit / adjustment / pay-link),
  // scoped to this user (Wielo ↔ them). Reuses the admin revenue modals.
  const [financeReq, setFinanceReq] = useState<WieloFinanceRequest | null>(
    null,
  );
  const openFinance = (action: WieloFinanceAction) =>
    setFinanceReq({ action, email: data.user.email ?? "" });
  const [statementOpen, setStatementOpen] = useState(false);
  const financeProducts = data.products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    currency: p.currency,
    productType: p.productType ?? "product",
  }));
  const financeUsers = data.user.email
    ? [{ email: data.user.email, name: data.user.full_name }]
    : [];

  // Share a Wielo document (invoice / CN / refund) with the user.
  function shareDoc(mode: "inbox" | "email", txn: WieloTxn) {
    if (!txn.doc?.viewPath) {
      toast.error("This entry has no document to share.");
      return;
    }
    const url = `${window.location.origin}${txn.doc.viewPath}`;
    const label = `${txn.doc.kind.replace(/_/g, " ")} ${txn.doc.number}`;
    start(async () => {
      const r =
        mode === "inbox"
          ? await sendWieloDocToInbox({ userId: data.user.id, url, label })
          : await emailWieloDoc({ userId: data.user.id, url, label });
      if (r.ok) {
        toast.success(mode === "inbox" ? "Sent to their inbox." : "Emailed.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <SupportBanner
        support={data.support}
        isHost={!!data.host}
        onRequest={onRequestSupport}
      />

      {/* Pills (left) + finance actions (right). Wielo actions manage the user's
          Wielo account; on the booking ledger the same power is gated by the
          host's support grant (then row-level manage opens on that ledger). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {hasBookings ? (
          <div className="inline-flex rounded-pill border border-brand-line bg-white p-0.5 text-[13px] font-semibold shadow-card">
            {(
              [
                ["wielo", "Wielo account"],
                ["bookings", "Bookings (guests)"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded-pill px-3.5 py-1.5 transition ${
                  view === key
                    ? "bg-brand-primary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        {view === "wielo" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {FIN_ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => openFinance(a.key)}
                disabled={pending || !data.user.email}
                className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12.5px] font-semibold transition disabled:opacity-50 ${
                  a.primary
                    ? "bg-brand-primary text-white hover:bg-brand-secondary"
                    : "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                }`}
              >
                <a.icon className="h-3.5 w-3.5" />
                {a.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStatementOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <FileText className="h-3.5 w-3.5" />
              Statement
            </button>
          </div>
        ) : supportActive ? (
          <span className="text-[12px] text-brand-mute">
            Support access active — manage each transaction from its ⋯ menu.
          </span>
        ) : (
          <span className="text-[12px] text-brand-mute">
            Request the host&apos;s access to manage their bookings ledger.
          </span>
        )}
      </div>

      {showBookings ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h3 className="mb-3 font-display text-sm font-bold text-brand-ink">
            Booking ledger (their guests → them)
          </h3>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <MiniKpi
              label="Collected"
              value={formatMoney(data.hostFinance!.collected, "ZAR")}
            />
            <MiniKpi
              label="Outstanding"
              value={formatMoney(data.hostFinance!.outstanding, "ZAR")}
            />
            <MiniKpi
              label="Refunded"
              value={formatMoney(data.hostFinance!.refunded, "ZAR")}
            />
            <MiniKpi
              label="Net"
              value={formatMoney(data.hostFinance!.net, "ZAR")}
            />
          </div>
          <LedgerList
            entries={data.hostTxns}
            showGuest
            emptyLabel="No booking transactions yet."
            minWidth={720}
            canManage={supportActive}
          />
        </section>
      ) : (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-bold text-brand-ink">
            <CreditCard className="h-4 w-4 text-brand-mute" />
            Wielo account (them → Wielo)
          </h3>
          <p className="mb-4 text-[12px] text-brand-mute">
            Subscriptions, products, refunds and credits between this user and
            Wielo. Balance = what they owe Wielo (or their credit) after each
            entry.
          </p>
          {(() => {
            const bal = wieloBalanceView(data.wieloBalance);
            return (
              <div
                className={`mb-4 flex items-center justify-between gap-3 rounded-[12px] border p-4 ${
                  bal.tone === "amber"
                    ? "border-amber-200 bg-amber-50"
                    : bal.tone === "green"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-brand-line bg-brand-light"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet
                    className={`h-4 w-4 ${
                      bal.tone === "amber"
                        ? "text-amber-700"
                        : bal.tone === "green"
                          ? "text-emerald-700"
                          : "text-brand-mute"
                    }`}
                  />
                  <span className="text-[12.5px] font-semibold text-brand-ink">
                    Account balance
                  </span>
                </div>
                <span
                  className={`num font-display text-[17px] font-bold ${
                    bal.tone === "amber"
                      ? "text-amber-700"
                      : bal.tone === "green"
                        ? "text-emerald-700"
                        : "text-brand-ink"
                  }`}
                >
                  {bal.value}
                </span>
              </div>
            );
          })()}
          <AdminLedgerList
            entries={data.wieloLedger}
            planLabels={data.wieloLabels.planLabels}
            productLabels={data.wieloLabels.productLabels}
            emptyLabel="No transactions with Wielo yet."
            minWidth={760}
            onAction={(action, txn) =>
              setFinanceReq({
                action,
                email: txn.userEmail ?? data.user.email ?? "",
              })
            }
            onDocShare={shareDoc}
          />
        </section>
      )}

      <WieloFinanceModals
        request={financeReq}
        users={financeUsers}
        products={financeProducts}
        onClose={() => setFinanceReq(null)}
      />

      <StatementDialog
        open={statementOpen}
        onOpenChange={setStatementOpen}
        recipient="host"
        build={(r) => buildWieloHostStatement({ userId: data.user.id, ...r })}
        send={async (r) => {
          const b = await buildWieloHostStatement({
            userId: data.user.id,
            ...r,
          });
          if (!b.ok) return { ok: false, error: b.error };
          const url = `${window.location.origin}${b.path}`;
          const label = "Statement of account";
          const [inbox, email] = await Promise.all([
            sendWieloDocToInbox({ userId: data.user.id, url, label }),
            emailWieloDoc({ userId: data.user.id, url, label }),
          ]);
          if (inbox.ok || email.ok) return { ok: true };
          return {
            ok: false,
            error: inbox.error ?? email.error ?? "Couldn't send.",
          };
        }}
      />
    </div>
  );
}

function ListingsPanel({ data }: { data: UserRecordData }) {
  return (
    <Section
      icon={Home}
      title="Listings"
      count={data.listings.length}
      empty="No listings."
    >
      {data.listings.map((l) => {
        const roomBits = [
          l.bedrooms != null ? `${l.bedrooms} bed` : null,
          l.bathrooms != null ? `${l.bathrooms} bath` : null,
          l.maxGuests != null ? `sleeps ${l.maxGuests}` : null,
        ].filter(Boolean);
        return (
          <Link
            key={l.id}
            href={`/admin/users/${data.user.id}/properties/${l.id}/edit`}
            className="flex items-start gap-3 border-t border-brand-line px-5 py-3.5 first:border-t-0 hover:bg-brand-light/50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-brand-ink">
                  {l.name}
                </span>
                {l.typeLabel ? (
                  <span className="shrink-0 rounded-pill border border-brand-line bg-brand-light px-2 py-px text-[10px] font-semibold capitalize text-brand-mute">
                    {l.typeLabel}
                  </span>
                ) : null}
                {l.isFeatured ? (
                  <span className="shrink-0 rounded-pill border border-amber-200 bg-amber-50 px-2 py-px text-[10px] font-semibold text-amber-700">
                    Featured
                  </span>
                ) : null}
                {l.isSuspended ? (
                  <span className="shrink-0 rounded-pill border border-red-200 bg-red-50 px-2 py-px text-[10px] font-semibold text-red-600">
                    Suspended
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-brand-mute">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{l.location || "—"}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-brand-mute">
                <span className="font-semibold text-brand-ink">
                  {formatMoney(l.price, l.currency)}
                </span>
                {roomBits.length ? <span>{roomBits.join(" · ")}</span> : null}
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck className="h-3 w-3" /> {l.totalBookings}{" "}
                  booking
                  {l.totalBookings === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {l.avgRating != null
                    ? `${l.avgRating.toFixed(1)} (${l.totalReviews})`
                    : `No reviews`}
                </span>
                {l.createdAt ? <span>Added {fmtDate(l.createdAt)}</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${
                  l.isPublished
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-brand-line bg-brand-light text-brand-mute"
                }`}
              >
                {l.isPublished ? "Published" : "Draft"}
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 text-brand-mute" />
            </div>
          </Link>
        );
      })}
    </Section>
  );
}

const PRICING_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  PRICING_MODELS.map((m) => [m.value, m.label]),
);
const ADDON_CATEGORY_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  ADDON_CATEGORIES.map((c) => [c.value, c.label]),
);
const POLICY_TYPE_LABEL: Record<string, string> = {
  cancellation: "Refund terms",
  check_in_out: "Check-in / out",
  house_rules: "House rules",
  booking_terms: "Booking terms",
  privacy: "Privacy",
};

// Combined host-level catalogue: the add-ons catalog and the policies library.
// Per-listing attachment/assignment lives in the listing editor; this manages
// the reusable host-wide library itself.
// Policy types the admin can create/edit here (legal docs are platform-wide).
const EDITABLE_POLICY_TYPES: { type: PolicyType; label: string }[] = [
  { type: "cancellation", label: "Add cancellation policy" },
  { type: "check_in_out", label: "Add check-in / out policy" },
  { type: "house_rules", label: "Add house rules" },
];

function CatalogPanel({ data }: { data: UserRecordData }) {
  const router = useRouter();
  const hostId = data.host?.id ?? null;
  // Policy create/edit resolves the host from one of their listings (the policy
  // is created host-wide, not attached). Needs at least one listing for context.
  const policyCtxListingId = data.listings[0]?.id ?? null;
  const [pending, start] = useTransition();
  const [editAddon, setEditAddon] = useState<AddonItem | "new" | null>(null);
  const [policySheet, setPolicySheet] = useState<{
    type: PolicyType;
    policy: PolicyCard | null;
  } | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(false);

  const refresh = () => router.refresh();

  const openEditPolicy = (type: PolicyType, policyId: string) => {
    if (!policyCtxListingId) return;
    setLoadingPolicy(true);
    start(async () => {
      const r = await fetchPolicyCardForListingAction(
        policyCtxListingId,
        policyId,
      );
      setLoadingPolicy(false);
      if (r.ok && r.data) setPolicySheet({ type, policy: r.data });
      else toast.error(r.ok ? "Could not load policy." : r.error);
    });
  };

  const toggle = (a: AddonItem) => {
    if (!hostId) return;
    start(async () => {
      const r = await adminToggleAddon(hostId, a.id, !a.isActive);
      if (r.ok) {
        toast.success(a.isActive ? "Add-on deactivated." : "Add-on activated.");
        refresh();
      } else toast.error(r.error ?? "Failed.");
    });
  };
  const remove = async (a: AddonItem) => {
    if (!hostId) return;
    const ok = await modal.destructive({
      title: `Delete “${a.name}”?`,
      description: `It will be detached from ${a.listingsCount} listing(s).`,
      confirmLabel: "Delete add-on",
    });
    if (!ok) return;
    start(async () => {
      const r = await adminDeleteAddon(hostId, a.id);
      if (r.ok) {
        toast.success("Add-on deleted.");
        refresh();
      } else toast.error(r.error ?? "Failed.");
    });
  };

  return (
    <div className="space-y-8">
      {/* Add-ons catalog */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <PackagePlus className="h-4 w-4 text-brand-mute" />
          <h3 className="font-display text-[15px] font-bold text-brand-ink">
            Add-ons catalog
          </h3>
          <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
            {data.addons.length}
          </span>
          <button
            type="button"
            onClick={() => setEditAddon("new")}
            className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-secondary"
          >
            <Plus className="h-3.5 w-3.5" /> New add-on
          </button>
        </div>
        <Section
          icon={PackagePlus}
          title="Catalog"
          count={data.addons.length}
          empty="No add-ons in this host's catalog yet."
        >
          {data.addons.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-brand-ink">
                    {a.name}
                  </span>
                  {a.isActive ? (
                    <Pill tone="good">Active</Pill>
                  ) : (
                    <Pill tone="muted">Inactive</Pill>
                  )}
                  {a.isRequired ? <Pill tone="muted">Required</Pill> : null}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
                  {formatMoney(a.unitPrice, a.currency)} ·{" "}
                  {PRICING_LABEL_BY_KEY[a.pricingModel] ?? a.pricingModel}
                  {a.category
                    ? ` · ${ADDON_CATEGORY_LABEL_BY_KEY[a.category] ?? a.category}`
                    : ""}
                  {` · on ${a.listingsCount} listing(s)`}
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(a)}
                title={a.isActive ? "Deactivate" : "Activate"}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-brand-line text-brand-mute transition hover:bg-brand-light disabled:opacity-50"
              >
                <Power className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditAddon(a)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(a)}
                title="Delete"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </Section>
      </div>

      {/* Policies library */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <ScrollText className="h-4 w-4 text-brand-mute" />
          <h3 className="font-display text-[15px] font-bold text-brand-ink">
            Policies library
          </h3>
          <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
            {data.policies.length}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {EDITABLE_POLICY_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                disabled={!policyCtxListingId || loadingPolicy}
                onClick={() => setPolicySheet({ type: t.type, policy: null })}
                className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>
        {!policyCtxListingId ? (
          <p className="mb-2 text-[12px] text-amber-700">
            Add a listing for this host first — new policies are created in a
            listing&apos;s context.
          </p>
        ) : null}
        <Section
          icon={ScrollText}
          title="Policies"
          count={data.policies.length}
          empty="No policies in this host's library yet."
        >
          {data.policies.map((p) => {
            const setDefault = () => {
              if (!hostId) return;
              start(async () => {
                const r = await adminSetDefaultPolicy(hostId, p.id);
                if (r.ok) {
                  toast.success("Set as default.");
                  refresh();
                } else toast.error(r.error ?? "Failed.");
              });
            };
            const toggleStatus = () => {
              if (!hostId) return;
              start(async () => {
                const r = await adminTogglePolicyStatus(
                  hostId,
                  p.id,
                  p.status !== "active",
                );
                if (r.ok) {
                  toast.success(
                    p.status === "active" ? "Moved to draft." : "Activated.",
                  );
                  refresh();
                } else toast.error(r.error ?? "Failed.");
              });
            };
            const removePolicy = async () => {
              if (!hostId) return;
              const ok = await modal.destructive({
                title: `Delete “${p.name}”?`,
                description:
                  p.assignmentsCount > 0
                    ? `It is on ${p.assignmentsCount} listing(s); it will be archived (not deleted).`
                    : undefined,
                confirmLabel:
                  p.assignmentsCount > 0 ? "Archive policy" : "Delete policy",
              });
              if (!ok) return;
              start(async () => {
                const r = await adminDeletePolicy(hostId, p.id);
                if (r.ok) {
                  toast.success("Policy removed.");
                  refresh();
                } else toast.error(r.error ?? "Failed.");
              });
            };
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-brand-ink">
                      {p.name}
                    </span>
                    {p.isDefault ? <Pill tone="good">Default</Pill> : null}
                    {p.status !== "active" ? (
                      <Pill tone="muted">{p.status}</Pill>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
                    {POLICY_TYPE_LABEL[p.type] ?? p.type}
                    {p.preset && p.preset !== "custom" ? ` · ${p.preset}` : ""}
                    {` · on ${p.assignmentsCount} listing(s)`}
                    {p.summary ? ` · ${p.summary}` : ""}
                  </div>
                </div>
                {!p.isDefault && p.status === "active" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={setDefault}
                    className="inline-flex shrink-0 items-center rounded-pill border border-brand-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                  >
                    Set default
                  </button>
                ) : null}
                {policyCtxListingId &&
                EDITABLE_POLICY_TYPES.some((t) => t.type === p.type) &&
                !(p.preset && p.preset !== "custom") ? (
                  <button
                    type="button"
                    disabled={pending || loadingPolicy}
                    onClick={() => openEditPolicy(p.type as PolicyType, p.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={toggleStatus}
                  title={p.status === "active" ? "Move to draft" : "Activate"}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-brand-line text-brand-mute transition hover:bg-brand-light disabled:opacity-50"
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={removePolicy}
                  title="Delete / archive"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </Section>
        <p className="mt-2 text-[12px] text-brand-mute">
          Per-listing policy assignment lives in the listing editor (Listings →
          open a listing → Policies). Booking-terms &amp; privacy are
          platform-wide.
        </p>
      </div>

      {hostId ? (
        <AddonEditModal
          hostId={hostId}
          addon={editAddon}
          onClose={() => setEditAddon(null)}
          onSaved={() => {
            setEditAddon(null);
            refresh();
          }}
        />
      ) : null}

      {policyCtxListingId ? (
        <PolicyEditorSheet
          open={!!policySheet}
          onOpenChange={(o) => (o ? null : setPolicySheet(null))}
          type={policySheet?.type ?? "cancellation"}
          policy={policySheet?.policy ?? null}
          onSaved={() => {
            setPolicySheet(null);
            refresh();
          }}
          createAction={(input) =>
            createPolicyForListingAction(policyCtxListingId, input)
          }
          updateAction={(policyId, input) =>
            updatePolicyForListingAction(policyCtxListingId, policyId, input)
          }
        />
      ) : null}
    </div>
  );
}

function AddonEditModal({
  hostId,
  addon,
  onClose,
  onSaved,
}: {
  hostId: string;
  addon: AddonItem | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = addon === "new";
  const existing = addon && addon !== "new" ? addon : null;
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    name: "",
    description: "",
    pricing_model: "per_stay",
    unit_price: "0",
    currency: "ZAR",
    category: "",
    min_quantity: "1",
    max_quantity: "",
    stock_quantity: "",
    lead_time_days: "0",
    is_active: true,
    is_required: false,
    vat_included: false,
    allow_custom_quantity: true,
  });

  const key = addon === "new" ? "new" : (existing?.id ?? null);
  useEffect(() => {
    if (!addon) return;
    if (addon === "new") {
      setForm({
        name: "",
        description: "",
        pricing_model: "per_stay",
        unit_price: "0",
        currency: "ZAR",
        category: "",
        min_quantity: "1",
        max_quantity: "",
        stock_quantity: "",
        lead_time_days: "0",
        is_active: true,
        is_required: false,
        vat_included: false,
        allow_custom_quantity: true,
      });
      return;
    }
    setForm({
      name: addon.name,
      description: addon.description ?? "",
      pricing_model: addon.pricingModel,
      unit_price: String(addon.unitPrice),
      currency: addon.currency || "ZAR",
      category: addon.category ?? "",
      min_quantity: String(addon.minQuantity),
      max_quantity: addon.maxQuantity != null ? String(addon.maxQuantity) : "",
      stock_quantity:
        addon.stockQuantity != null ? String(addon.stockQuantity) : "",
      lead_time_days: String(addon.leadTimeDays),
      is_active: addon.isActive,
      is_required: addon.isRequired,
      vat_included: addon.vatIncluded,
      allow_custom_quantity: addon.allowCustomQuantity,
    });
  }, [key, addon]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Give the add-on a name.");
      return;
    }
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    const payload: AddonInput = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      pricing_model: form.pricing_model as AddonInput["pricing_model"],
      unit_price: Number(form.unit_price) || 0,
      currency: form.currency || "ZAR",
      min_quantity: Number(form.min_quantity) || 0,
      max_quantity: num(form.max_quantity),
      allow_custom_quantity: form.allow_custom_quantity,
      stock_quantity: num(form.stock_quantity),
      is_required: form.is_required,
      is_active: form.is_active,
      is_refundable: true,
      lead_time_days: Number(form.lead_time_days) || 0,
      category: (form.category || null) as AddonInput["category"],
      vat_included: form.vat_included,
    };
    start(async () => {
      const r = existing
        ? await adminUpdateAddon(hostId, existing.id, payload)
        : await adminCreateAddon(hostId, payload);
      if (r.ok) {
        toast.success(existing ? "Add-on updated." : "Add-on created.");
        onSaved();
      } else toast.error(r.error ?? "Failed.");
    });
  };

  return (
    <FormModal
      open={!!addon}
      onOpenChange={(o) => (o ? null : onClose())}
      title={isNew ? "New add-on" : "Edit add-on"}
      description="Part of this host's add-on catalog. Attach it to listings from the listing editor."
    >
      <div className="space-y-4">
        <Lbl label="Name">
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Lbl>
        <Lbl label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </Lbl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Lbl label="Pricing model">
            <Select
              value={form.pricing_model}
              onChange={(e) => set("pricing_model", e.target.value)}
            >
              {PRICING_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Lbl>
          <Lbl label="Category">
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">None</option>
              {ADDON_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Lbl>
          <Lbl label="Unit price">
            <Input
              type="number"
              value={form.unit_price}
              onChange={(e) => set("unit_price", e.target.value)}
            />
          </Lbl>
          <Lbl label="Currency">
            <Select
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
            >
              {DISPLAY_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Lbl>
          <Lbl label="Min quantity">
            <Input
              type="number"
              value={form.min_quantity}
              onChange={(e) => set("min_quantity", e.target.value)}
            />
          </Lbl>
          <Lbl label="Max quantity (blank = none)">
            <Input
              type="number"
              value={form.max_quantity}
              onChange={(e) => set("max_quantity", e.target.value)}
            />
          </Lbl>
          <Lbl label="Stock (blank = unlimited)">
            <Input
              type="number"
              value={form.stock_quantity}
              onChange={(e) => set("stock_quantity", e.target.value)}
            />
          </Lbl>
          <Lbl label="Lead time (days)">
            <Input
              type="number"
              value={form.lead_time_days}
              onChange={(e) => set("lead_time_days", e.target.value)}
            />
          </Lbl>
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          <Check
            label="Active"
            checked={form.is_active}
            onChange={(v) => set("is_active", v)}
          />
          <Check
            label="Required"
            checked={form.is_required}
            onChange={(v) => set("is_required", v)}
          />
          <Check
            label="VAT included"
            checked={form.vat_included}
            onChange={(v) => set("vat_included", v)}
          />
          <Check
            label="Custom quantity"
            checked={form.allow_custom_quantity}
            onChange={(v) => set("allow_custom_quantity", v)}
          />
        </div>
      </div>
      <FormModalFooter>
        <FormModalCancel onClick={onClose} />
        <Button disabled={pending} onClick={save}>
          {pending ? "Saving…" : isNew ? "Create add-on" : "Save add-on"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}

const WEBSITE_STATUS_STYLE: Record<string, string> = {
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  unpublished: "border-amber-200 bg-amber-50 text-amber-700",
  draft: "border-brand-line bg-brand-light text-brand-mute",
};
const PAGE_KIND_LABEL: Record<string, string> = {
  home: "Home",
  about: "About",
  rooms: "Rooms",
  contact: "Contact",
  custom: "Page",
};

function WebsitePanel({ data }: { data: UserRecordData }) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";
  const sites = data.websites;

  if (sites.length === 0) {
    const handle = data.host?.handle ?? null;
    return (
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
          <Globe className="h-4 w-4 text-brand-mute" />
          <span className="font-display text-[15px] font-bold text-brand-ink">
            Website
          </span>
        </div>
        <div className="px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-brand-light">
            <Globe className="h-6 w-6 text-brand-mute" />
          </div>
          <h3 className="mt-4 font-display text-base font-bold text-brand-ink">
            No website yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-brand-mute">
            This user hasn&apos;t created a builder website. A host can create
            one per business from Dashboard → Website.
          </p>
          {handle ? (
            <p className="mt-3 text-[12px] text-brand-mute">
              Reserved handle:{" "}
              <span className="font-mono text-brand-ink">@{handle}</span>
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {sites.map((s) => {
        const subUrl = `${s.subdomain}.${rootDomain}`;
        const hasCustom = !!s.customDomain;
        const liveHost =
          hasCustom && s.domainStatus === "active" ? s.customDomain! : subUrl;
        const statusStyle =
          WEBSITE_STATUS_STYLE[s.status] ?? WEBSITE_STATUS_STYLE.draft;
        return (
          <section
            key={s.id}
            className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-brand-line px-5 py-3.5">
              <Globe className="h-4 w-4 text-brand-mute" />
              <span className="font-display text-[15px] font-bold text-brand-ink">
                {s.brandName?.trim() || s.businessName}
              </span>
              <span
                className={`rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${statusStyle}`}
              >
                {s.status}
              </span>
              <a
                href={`https://${liveHost}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-brand-line px-2.5 py-1 text-[12px] font-semibold text-brand-secondary hover:bg-brand-light"
              >
                Visit site <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <dl className="grid grid-cols-1 gap-px bg-brand-line sm:grid-cols-2">
              <WebsiteFact label="Business" value={s.businessName} />
              <WebsiteFact
                label="Address"
                value={
                  <a
                    href={`https://${subUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[12px] text-brand-secondary hover:underline"
                  >
                    {subUrl}
                  </a>
                }
              />
              <WebsiteFact
                label="Custom domain"
                value={
                  hasCustom ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] text-brand-ink">
                        {s.customDomain}
                      </span>
                      <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10px] font-semibold capitalize text-brand-mute">
                        DNS {s.domainStatus}
                      </span>
                      <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10px] font-semibold capitalize text-brand-mute">
                        SSL {s.sslStatus}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <WebsiteFact
                label="Theme"
                value={
                  [s.themePreset, s.themeFont ? `${s.themeFont} font` : null]
                    .filter(Boolean)
                    .join(" · ") || "Default"
                }
              />
              {s.brandTagline ? (
                <WebsiteFact label="Tagline" value={s.brandTagline} />
              ) : null}
              {s.seoTitle ? (
                <WebsiteFact label="SEO title" value={s.seoTitle} />
              ) : null}
              <WebsiteFact
                label="Published"
                value={s.publishedAt ? fmtDate(s.publishedAt) : "Not published"}
              />
              <WebsiteFact
                label="Last updated"
                value={`${fmtDate(s.updatedAt)}${
                  fmtTime(s.updatedAt) ? ` · ${fmtTime(s.updatedAt)}` : ""
                }`}
              />
            </dl>

            <div className="border-t border-brand-line px-5 py-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                <FileText className="h-3.5 w-3.5" />
                Pages
                <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px normal-case tabular-nums tracking-normal">
                  {s.publishedPageCount}/{s.pageCount} live
                </span>
              </div>
              {s.pages.length === 0 ? (
                <p className="mt-2 text-[12px] text-brand-mute">No pages.</p>
              ) : (
                <ul className="mt-2 divide-y divide-brand-line">
                  {s.pages.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2.5 py-2 text-[12.5px]"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          p.isPublished ? "bg-emerald-500" : "bg-brand-line"
                        }`}
                        title={p.isPublished ? "Published" : "Draft"}
                      />
                      <span className="font-medium text-brand-ink">
                        {p.navLabel?.trim() ||
                          p.title?.trim() ||
                          PAGE_KIND_LABEL[p.kind] ||
                          p.kind}
                      </span>
                      <span className="font-mono text-[11px] text-brand-mute">
                        /{p.slug}
                      </span>
                      <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10px] font-semibold capitalize text-brand-mute">
                        {PAGE_KIND_LABEL[p.kind] ?? p.kind}
                      </span>
                      {!p.showInNav ? (
                        <span className="text-[10px] uppercase tracking-wide text-brand-mute">
                          hidden
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WebsiteFact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-white px-5 py-2.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] text-brand-ink">{value}</dd>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-brand-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
      />
      {label}
    </label>
  );
}

function BusinessPanel({
  data,
  onEdit,
}: {
  data: UserRecordData;
  onEdit: (b: BusinessItem) => void;
}) {
  return (
    <Section
      icon={Building2}
      title="Businesses"
      count={data.businesses.length}
      empty="No businesses."
    >
      {data.businesses.map((b) => {
        const place = [b.city, b.province].filter(Boolean).join(", ");
        const meta = [
          b.isDefault ? "Default business" : "Business",
          b.legalName || null,
          b.vatNumber ? `VAT ${b.vatNumber}` : null,
          place || null,
          `${b.defaultCurrency} · ${b.defaultLanguage.toUpperCase()}`,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div
            key={b.id}
            className="flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-brand-ink">
                  {b.name}
                </span>
                {b.isDefault ? <Pill tone="good">Default</Pill> : null}
                {b.isArchived ? <Pill tone="bad">Archived</Pill> : null}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
                {meta}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEdit(b)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
        );
      })}
    </Section>
  );
}

type ReviewRow = {
  id: string;
  rating: number;
  person: string;
  personSub: string | null;
  context: string | null;
  text: string | null;
  date: string;
  published: boolean | null;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold tabular-nums text-brand-ink">
      {rating}
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
    </span>
  );
}

// One standard admin table of reviews with in-card search / rating / status /
// sort filters. `variant` toggles the Listing + Status columns (host→guest
// ratings have neither).
function ReviewsTable({
  title,
  rows,
  variant,
  empty,
  personHeader,
  contextHeader,
}: {
  title: string;
  rows: ReviewRow[];
  variant: "received" | "given" | "written";
  empty: string;
  personHeader: string;
  contextHeader?: string;
}) {
  const [q, setQ] = useState("");
  const [rating, setRating] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const showContext = variant !== "given";
  const showStatus = variant !== "given";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (rating !== "all" && r.rating !== Number(rating)) return false;
      if (showStatus && status !== "all") {
        const pub = r.published ?? true;
        if (status === "published" && !pub) return false;
        if (status === "hidden" && pub) return false;
      }
      if (needle) {
        const hay = [r.person, r.personSub, r.context, r.text]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "highest") return b.rating - a.rating;
      if (sort === "lowest") return a.rating - b.rating;
      if (sort === "oldest") return a.date < b.date ? -1 : 1;
      return a.date < b.date ? 1 : -1; // newest
    });
    return out;
  }, [rows, q, rating, status, sort, showStatus]);

  const columns: AdminColumn<ReviewRow>[] = [
    {
      header: personHeader,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{r.person}</div>
          {r.personSub ? (
            <div className="truncate font-mono text-[11px] text-brand-mute">
              {r.personSub}
            </div>
          ) : null}
        </div>
      ),
    },
    ...(showContext
      ? [
          {
            header: contextHeader ?? "Listing",
            cell: (r: ReviewRow) => (
              <span className="text-[12.5px] text-brand-ink">
                {r.context || "—"}
              </span>
            ),
          },
        ]
      : []),
    { header: "Rating", cell: (r) => <Stars rating={r.rating} /> },
    {
      header: variant === "given" ? "Summary" : "Review",
      className: "max-w-[320px]",
      cell: (r) => (
        <span className="line-clamp-2 text-[12.5px] text-brand-mute">
          {r.text || "—"}
        </span>
      ),
    },
    ...(showStatus
      ? [
          {
            header: "Status",
            cell: (r: ReviewRow) =>
              (r.published ?? true) ? (
                <Pill tone="good">Published</Pill>
              ) : (
                <Pill tone="muted">Hidden</Pill>
              ),
          },
        ]
      : []),
    {
      header: "Date",
      align: "right" as const,
      cell: (r) => (
        <span className="text-[12px] text-brand-mute">{fmtDate(r.date)}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Star className="h-4 w-4 text-brand-mute" />
        <h3 className="font-display text-[15px] font-bold text-brand-ink">
          {title}
        </h3>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {rows.length}
        </span>
      </div>
      <AdminTable
        columns={columns}
        rows={filtered}
        getKey={(r) => r.id}
        empty={empty}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
              <Search className="h-4 w-4 text-brand-mute" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search reviews…"
                className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
              />
            </div>
            <FilterSelect value={rating} onChange={setRating}>
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={String(n)}>
                  {n} ★
                </option>
              ))}
            </FilterSelect>
            {showStatus ? (
              <FilterSelect value={status} onChange={setStatus}>
                <option value="all">Any status</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </FilterSelect>
            ) : null}
            <FilterSelect value={sort} onChange={setSort}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </FilterSelect>
          </div>
        }
        footer={
          <div className="text-[12px] tabular-nums text-brand-mute">
            Showing {filtered.length} of {rows.length}
          </div>
        }
      />
    </div>
  );
}

function ReviewsPanel({ data }: { data: UserRecordData }) {
  const received: ReviewRow[] = data.reviewsReceived.map((rv) => ({
    id: rv.id,
    rating: rv.rating,
    person: rv.counterparty,
    personSub: null,
    context: rv.listingName,
    text: rv.body,
    date: rv.createdAt,
    published: rv.isPublished,
  }));
  const given: ReviewRow[] = data.guestRatingsGiven.map((g) => ({
    id: g.id,
    rating: g.rating,
    person: g.guestName,
    personSub: g.guestEmail,
    context: null,
    text: g.summary,
    date: g.date,
    published: null,
  }));
  const written: ReviewRow[] = data.reviewsWritten.map((rv) => ({
    id: rv.id,
    rating: rv.rating,
    person: rv.counterparty,
    personSub: null,
    context: rv.listingName,
    text: rv.body,
    date: rv.createdAt,
    published: rv.isPublished,
  }));

  if (!data.host) {
    return (
      <ReviewsTable
        title="Reviews written (as guest)"
        rows={written}
        variant="written"
        empty="No reviews written."
        personHeader="Host"
        contextHeader="Listing"
      />
    );
  }

  return (
    <div className="space-y-8">
      <ReviewsTable
        title="Reviews of this host (from guests)"
        rows={received}
        variant="received"
        empty="No reviews received from guests."
        personHeader="Guest"
        contextHeader="Listing"
      />
      <ReviewsTable
        title="Reviews of guests (by this host)"
        rows={given}
        variant="given"
        empty="This host hasn't rated any guests yet."
        personHeader="Guest"
      />
      {written.length > 0 ? (
        <ReviewsTable
          title="Reviews written (as a guest)"
          rows={written}
          variant="written"
          empty="No reviews written."
          personHeader="Host"
          contextHeader="Listing"
        />
      ) : null}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-pill border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink focus:border-brand-primary focus:outline-none"
    >
      {children}
    </select>
  );
}

function RelationshipsPanel({ data }: { data: UserRecordData }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = data.relationships.filter((rel) => {
      if (!needle) return true;
      return [rel.name, rel.email, rel.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    out = [...out].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const da = a.connectedAt ?? "";
      const db = b.connectedAt ?? "";
      return da < db ? 1 : -1; // most recent first
    });
    return out;
  }, [data.relationships, q, sort]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-brand-mute" />
        <h3 className="font-display text-[15px] font-bold text-brand-ink">
          Travelled with
        </h3>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {data.relationships.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
          <Search className="h-4 w-4 text-brand-mute" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email or phone…"
            className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
          />
        </div>
        <FilterSelect value={sort} onChange={setSort}>
          <option value="recent">Most recent</option>
          <option value="name">Name (A–Z)</option>
        </FilterSelect>
      </div>

      {data.relationships.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center text-[13px] text-brand-mute">
          No travel connections yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center text-[13px] text-brand-mute">
          No connections match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((rel) => (
            <div
              key={rel.id}
              className="flex items-start gap-3.5 rounded-card border border-brand-line bg-white p-4 shadow-card"
            >
              {rel.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rel.avatarUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-pill object-cover ring-1 ring-brand-line"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-brand-secondary font-display text-sm font-bold text-white">
                  {initials(rel.name, rel.email)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-brand-ink">
                  {rel.name}
                </div>
                <div className="mt-1.5 flex flex-col gap-1 text-[12px]">
                  {rel.email ? (
                    <a
                      href={`mailto:${rel.email}`}
                      className="flex items-center gap-1.5 text-brand-ink hover:text-brand-primary"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0 text-brand-mute" />
                      <span className="truncate">{rel.email}</span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5 text-brand-mute">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> No email
                    </span>
                  )}
                  {rel.phone ? (
                    <a
                      href={`tel:${rel.phone}`}
                      className="flex items-center gap-1.5 text-brand-ink hover:text-brand-primary"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 text-brand-mute" />
                      <span className="truncate">{rel.phone}</span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5 text-brand-mute">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> No phone
                    </span>
                  )}
                  {rel.connectedAt ? (
                    <span className="flex items-center gap-1.5 text-brand-mute">
                      <Calendar className="h-3.5 w-3.5 shrink-0" /> Connected{" "}
                      {fmtDate(rel.connectedAt)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferralsPanel({ data }: { data: UserRecordData }) {
  const router = useRouter();
  const stats = data.affiliateStats;
  const [payout, setPayout] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [enabling, startEnable] = useTransition();

  function enableAsAffiliate() {
    startEnable(async () => {
      const r = await enableAffiliate(data.user.id);
      if (r.ok) {
        toast.success(`Affiliate account created (/r/${r.slug}).`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = data.referrals.filter((r) => {
      if (!needle) return true;
      return [r.name, r.email, r.productName, r.plan]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    out = [...out].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "commission") return b.commission - a.commission;
      return a.joinedAt < b.joinedAt ? 1 : -1; // recent
    });
    return out;
  }, [data.referrals, q, sort]);

  const currency = stats?.currency ?? data.referrals[0]?.currency ?? "ZAR";
  const totalCommission = filtered.reduce((s, r) => s + r.commission, 0);

  if (!stats && !data.affiliateSlug) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center">
        <Gift className="mx-auto h-6 w-6 text-brand-line" />
        <p className="mx-auto mt-3 max-w-md text-[13px] text-brand-mute">
          This user isn&apos;t an affiliate yet. Enable the affiliate programme
          to give them a unique referral link and start earning commission on
          the products they refer.
        </p>
        <button
          type="button"
          onClick={enableAsAffiliate}
          disabled={enabling}
          className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          <Gift className="h-4 w-4" />
          {enabling ? "Enabling…" : "Enable as affiliate"}
        </button>
      </div>
    );
  }

  const columns: AdminColumn<UserRecordData["referrals"][number]>[] = [
    {
      header: "Referred user",
      cell: (r) => (
        <Link href={`/admin/users/${r.userId}`} className="group block min-w-0">
          <div className="truncate font-medium text-brand-ink group-hover:text-brand-primary">
            {r.name}
          </div>
          <div className="truncate font-mono text-[11px] text-brand-mute">
            {r.email ?? "No email"}
          </div>
        </Link>
      ),
    },
    {
      header: "Signed up",
      cell: (r) => (
        <span className="text-[12px] text-brand-mute">
          {fmtDate(r.joinedAt)}
        </span>
      ),
    },
    {
      header: "Product",
      cell: (r) => (
        <span className="text-[12.5px] text-brand-ink">{r.productName}</span>
      ),
    },
    {
      header: "Plan",
      cell: (r) => (
        <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold capitalize text-brand-mute">
          {r.plan}
        </span>
      ),
    },
    {
      header: "Commission",
      align: "right",
      cell: (r) => (
        <span className="font-display text-[13px] font-bold tabular-nums text-brand-ink">
          {formatMoney(r.commission, r.currency)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Affiliate header + payout */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-brand-mute" />
            <div>
              <div className="font-display text-[15px] font-bold text-brand-ink">
                Affiliate programme
              </div>
              {data.affiliateSlug ? (
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-[12px] text-brand-mute">
                    /r/{data.affiliateSlug}
                    {stats && stats.status !== "active"
                      ? ` · ${stats.status}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const base =
                        process.env.NEXT_PUBLIC_APP_URL ||
                        process.env.NEXT_PUBLIC_SITE_URL ||
                        (typeof window !== "undefined"
                          ? window.location.origin
                          : "https://wielo.co.za");
                      navigator.clipboard?.writeText(
                        `${base}/r/${data.affiliateSlug}`,
                      );
                      toast.success("Affiliate link copied.");
                    }}
                    className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                    title="Copy this user's affiliate link"
                  >
                    <Link2 className="h-3 w-3" /> Copy link
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {stats ? (
            <button
              type="button"
              onClick={() => setPayout(true)}
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
            >
              <CreditCard className="h-4 w-4" /> Pay out
            </button>
          ) : null}
        </div>

        {stats ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MiniKpi label="Link views" value={String(stats.clicks)} />
            <MiniKpi label="Signups" value={String(stats.signups)} />
            <MiniKpi
              label="Pending"
              value={formatMoney(stats.pending, currency)}
            />
            <MiniKpi
              label="Earned"
              value={formatMoney(stats.earned, currency)}
            />
            <MiniKpi
              label="Available"
              value={formatMoney(stats.available, currency)}
            />
            <MiniKpi
              label="Paid out"
              value={formatMoney(stats.paid, currency)}
            />
          </div>
        ) : null}
      </section>

      {/* Referred users */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-mute" />
          <h3 className="font-display text-[15px] font-bold text-brand-ink">
            Referred users
          </h3>
          <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
            {data.referrals.length}
          </span>
        </div>
        <AdminTable
          columns={columns}
          rows={filtered}
          getKey={(r) => r.id}
          empty="No referrals yet. People this affiliate brings to Wielo appear here."
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
                <Search className="h-4 w-4 text-brand-mute" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search referred users…"
                  className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
                />
              </div>
              <FilterSelect value={sort} onChange={setSort}>
                <option value="recent">Most recent</option>
                <option value="commission">Highest commission</option>
                <option value="name">Name (A–Z)</option>
              </FilterSelect>
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] tabular-nums text-brand-mute">
              <span>
                Showing {filtered.length} of {data.referrals.length}
              </span>
              <span>
                Commission shown:{" "}
                <span className="font-semibold text-brand-ink">
                  {formatMoney(totalCommission, currency)}
                </span>
                {stats ? (
                  <>
                    {" "}
                    · Available to pay out:{" "}
                    <span className="font-semibold text-brand-ink">
                      {formatMoney(stats.available, currency)}
                    </span>
                  </>
                ) : null}
              </span>
            </div>
          }
        />
      </div>

      {/* Commissions — each with a downloadable statement (COM-) */}
      {data.affiliateCommissions.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-mute" />
            <h3 className="font-display text-[15px] font-bold text-brand-ink">
              Commissions
            </h3>
            <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
              {data.affiliateCommissions.length}
            </span>
          </div>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white">
            <table className="w-full text-[13px]">
              <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">For</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {data.affiliateCommissions.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-light/40">
                    <td className="px-4 py-2.5 text-[12px] text-brand-mute">
                      {fmtDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-ink">
                      {c.productName}
                      {c.entryType === "clawback" ? (
                        <span className="ml-1.5 text-[11px] text-red-600">
                          clawback
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <AffiliateStatusPill status={c.status} />
                    </td>
                    <td
                      className={`num px-4 py-2.5 text-right font-semibold ${
                        c.amount < 0 ? "text-red-600" : "text-brand-ink"
                      }`}
                    >
                      {formatMoney(c.amount, c.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href={`/wielo-commission/${c.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-brand-line px-2 py-1 text-[11px] font-medium text-brand-secondary transition hover:bg-brand-accent"
                      >
                        <Download className="h-3 w-3" /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Payouts — each with a downloadable remittance advice (RMT-) */}
      {data.affiliatePayouts.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-brand-mute" />
            <h3 className="font-display text-[15px] font-bold text-brand-ink">
              Payouts
            </h3>
            <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
              {data.affiliatePayouts.length}
            </span>
          </div>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white">
            <table className="w-full text-[13px]">
              <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Net paid</th>
                  <th className="px-4 py-2.5 text-right">Remittance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {data.affiliatePayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-light/40">
                    <td className="px-4 py-2.5 text-[12px] text-brand-mute">
                      {fmtDate(p.processedAt ?? p.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-brand-ink">
                      {p.method ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <AffiliateStatusPill status={p.status} />
                    </td>
                    <td className="num px-4 py-2.5 text-right font-semibold text-brand-ink">
                      {formatMoney(p.net, p.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href={`/wielo-commission/payout_${p.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-brand-line px-2 py-1 text-[11px] font-medium text-brand-secondary transition hover:bg-brand-accent"
                      >
                        <Download className="h-3 w-3" /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {stats ? (
        <AffiliatePayoutModal
          open={payout}
          affiliateId={stats.accountId}
          available={stats.available}
          currency={currency}
          defaultMethod={stats.defaultMethod}
          onClose={() => setPayout(false)}
          onDone={() => {
            setPayout(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

// Small status pill shared by the commission + payout tables.
function AffiliateStatusPill({ status }: { status: string }) {
  const cls =
    status === "paid" || status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "cleared"
        ? "border-indigo-200 bg-indigo-50 text-indigo-600"
        : status === "voided" || status === "failed"
          ? "border-red-200 bg-red-50 text-red-600"
          : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-flex rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

function AffiliatePayoutModal({
  open,
  affiliateId,
  available,
  currency,
  defaultMethod,
  onClose,
  onDone,
}: {
  open: boolean;
  affiliateId: string;
  available: number;
  currency: string;
  defaultMethod: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<"eft" | "paystack">(
    defaultMethod === "paystack" ? "paystack" : "eft",
  );
  const [reference, setReference] = useState("");

  const run = () =>
    start(async () => {
      const r = await adminPayoutAffiliate({
        affiliateId,
        method,
        reference: reference.trim() || undefined,
      });
      if (r.ok) {
        toast.success(
          `Payout recorded — ${formatMoney(r.net, currency)} paid.`,
        );
        onDone();
      } else toast.error(r.error);
    });

  return (
    <FormModal
      open={open}
      onOpenChange={(o) => (o ? null : onClose())}
      title="Pay out affiliate"
      description="Claims the cleared, available commission into a payout and marks it paid immediately. The per-method fee is applied automatically."
    >
      <div className="space-y-4">
        <div className="rounded-card border border-brand-line bg-brand-light/40 px-4 py-2.5 text-[12.5px] text-brand-ink">
          Available to pay out:{" "}
          <span className="font-semibold">
            {formatMoney(available, currency)}
          </span>
        </div>
        <Lbl label="Method">
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value as "eft" | "paystack")}
          >
            <option value="eft">EFT (bank transfer)</option>
            <option value="paystack">Paystack</option>
          </Select>
        </Lbl>
        <Lbl label="Reference (optional)">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. bank payment ref"
          />
        </Lbl>
      </div>
      <FormModalFooter>
        <FormModalCancel onClick={onClose} />
        <Button disabled={pending || available <= 0} onClick={run}>
          {pending ? "Paying…" : "Pay out now"}
        </Button>
      </FormModalFooter>
    </FormModal>
  );
}

function SupportPanel({ data }: { data: UserRecordData }) {
  return (
    <Section
      icon={LifeBuoy}
      title="Data & privacy requests"
      count={data.dataRequests.length}
      empty="No support / data requests from this user."
    >
      {data.dataRequests.map((d) => (
        <RowLink
          key={d.id}
          href="/admin/data-requests"
          primary={
            d.type === "export"
              ? "Data export request"
              : "Account deletion request"
          }
          secondary={`Raised ${fmtDate(d.createdAt)}${d.fulfilledAt ? ` · done ${fmtDate(d.fulfilledAt)}` : ""}`}
          status={d.status}
        />
      ))}
    </Section>
  );
}

// Turn a raw admin_audit_log row into a human-friendly line. Uses payload.args
// (the action's own arguments) + resolved product names so a row reads like
// "Sent offer: Beta Membership", not "user.sell_product".
function humanizeAudit(
  a: UserRecordData["audit"][number],
  productLabels: Record<string, string>,
): { category: ActivityCategory; title: string } {
  const args = (a.payload?.args ?? {}) as Record<string, unknown>;
  const productId = typeof args.productId === "string" ? args.productId : null;
  const productName = productId
    ? (productLabels[productId] ?? "a product")
    : null;
  const roleArg = typeof args.role === "string" ? args.role : null;
  const statusArg = typeof args.status === "string" ? args.status : null;
  const mode = typeof args.mode === "string" ? args.mode : null;

  switch (a.action) {
    case "user.suspend":
      return { category: "account", title: "Suspended the account" };
    case "user.reinstate":
      return { category: "account", title: "Reinstated the account" };
    case "user.password_reset":
      return { category: "account", title: "Sent a password reset email" };
    case "user.password_reset_self":
      return { category: "account", title: "Reset their password" };
    case "user.update_profile":
      return { category: "account", title: "Updated the profile" };
    case "user.change_role":
      return {
        category: "account",
        title: roleArg
          ? `Changed the role to ${roleArg}`
          : "Changed the account role",
      };
    case "user.delete":
      return { category: "account", title: "Deleted the account" };
    case "user.restore":
      return { category: "account", title: "Restored the deleted account" };
    case "user.purge":
      return {
        category: "account",
        title: "Permanently deleted the account",
      };
    case "user.add_note":
      return { category: "note", title: "Added an internal note" };
    case "user.update_subscription":
      return {
        category: "subscription",
        title: `Updated the ${productName ?? "subscription"}${
          statusArg ? ` → ${statusArg}` : ""
        }`,
      };
    case "user.set_product":
      return {
        category: "subscription",
        title: productName
          ? `Set membership: ${productName}`
          : "Set a membership / service",
      };
    case "user.cancel_scheduled_change":
      return {
        category: "subscription",
        title: "Cancelled a scheduled change",
      };
    case "user.sell_product":
      return {
        category: "product",
        title:
          mode === "paid"
            ? `Sold: ${productName ?? "a product"}`
            : `Sent offer: ${productName ?? "a product"}`,
      };
    case "user.send_doc_inbox":
      return { category: "finance", title: "Sent a document to the inbox" };
    case "user.email_doc":
      return { category: "finance", title: "Emailed a document to the user" };
    case "user.update_business":
      return { category: "business", title: "Updated the business details" };
    case "user.create_addon":
      return { category: "business", title: "Created an add-on" };
    case "user.update_addon":
      return { category: "business", title: "Updated an add-on" };
    case "user.toggle_addon":
      return { category: "business", title: "Enabled / disabled an add-on" };
    case "user.delete_addon":
      return { category: "business", title: "Deleted an add-on" };
    case "user.toggle_policy":
      return { category: "business", title: "Enabled / disabled a policy" };
    case "user.set_default_policy":
      return { category: "business", title: "Set a default policy" };
    case "user.delete_policy":
      return { category: "business", title: "Deleted a policy" };
    case "user.request_support_access":
      return {
        category: "support",
        title: "Requested edit access to this account",
      };
    case "impersonation.start":
      return { category: "account", title: "Started impersonating this user" };
    case "impersonation.end":
      return { category: "account", title: "Ended impersonation" };
    case "affiliate.admin_payout":
      return { category: "affiliate", title: "Paid an affiliate payout" };
    case "affiliate.admin_enable":
      return { category: "affiliate", title: "Enabled the affiliate account" };
    case "permission_denied":
      return { category: "system", title: "A blocked action was attempted" };
    default: {
      const pretty = a.action
        .replace(/^user\./, "")
        .replace(/[._]/g, " ")
        .replace(/\b\w/, (c) => c.toUpperCase());
      return {
        category: "system",
        title: a.targetType ? `${pretty} (${a.targetType})` : pretty,
      };
    }
  }
}

// Build the full, sorted history timeline from every recorded event on this
// record: admin/staff audit actions, the user's own bookings + reviews, and the
// support-access grant lifecycle. Data requests live in their own Data tab.
function buildHistory(data: UserRecordData): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const userName = data.user.full_name || data.user.email || "This user";
  const productLabels = data.wieloLabels?.productLabels ?? {};

  for (const a of data.audit) {
    const { category, title } = humanizeAudit(a, productLabels);
    const reason =
      typeof a.payload?.reason === "string" ? a.payload.reason : null;
    const context = [
      a.impersonating ? "acting as this user" : null,
      reason ? `“${reason}”` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    events.push({
      id: `au-${a.id}`,
      category,
      title,
      actor: a.actor ?? "Wielo staff",
      actorKind: "admin",
      context: context || null,
      at: a.created_at,
    });
  }

  for (const b of data.bookingsAsGuest)
    events.push({
      id: `bg-${b.id}`,
      category: "booking",
      title: `Booked ${b.listingName}`,
      actor: userName,
      actorKind: "user",
      context: `${b.reference} · ${b.status}`,
      at: b.checkIn ?? "",
    });

  for (const rv of data.reviewsWritten)
    events.push({
      id: `rw-${rv.id}`,
      category: "review",
      title: `Reviewed ${rv.listingName}`,
      actor: userName,
      actorKind: "user",
      context: `${rv.rating}★${rv.isPublished ? "" : " · unpublished"}`,
      at: rv.createdAt,
    });

  for (const g of data.supportGrants) {
    events.push({
      id: `sg-req-${g.id}`,
      category: "support",
      title: "Requested edit access to this account",
      actor: g.requestedBy ?? "Wielo support",
      actorKind: "admin",
      context: g.reason ? `“${g.reason}”` : "awaiting host approval",
      at: g.requestedAt,
    });
    if (g.decidedAt)
      events.push({
        id: `sg-dec-${g.id}`,
        category: "support",
        title: `Host ${g.status} the edit-access request`,
        actor: "Host",
        actorKind: "host",
        context:
          g.status === "approved" && g.expiresAt
            ? `valid until ${fmtDate(g.expiresAt)}`
            : g.status,
        at: g.decidedAt,
      });
  }

  // Affiliate earnings this user made (commission accrued/cleared/reversed) and
  // payouts — the same events now recorded on their Wielo ledger + Finance tab.
  for (const c of data.affiliateCommissions ?? []) {
    const money = formatMoney(Math.abs(c.amount), c.currency);
    const isReversal = c.entryType === "clawback" || c.amount < 0;
    const title = isReversal
      ? `Commission reversed — ${money} · ${c.productName}`
      : `Earned ${money} commission · ${c.productName}`;
    events.push({
      id: `ac-${c.id}`,
      category: "affiliate",
      title,
      actor: userName,
      actorKind: "user",
      context: c.status, // pending / cleared / voided / paid
      at: c.createdAt,
    });
  }

  for (const p of data.affiliatePayouts ?? []) {
    const money = formatMoney(p.net, p.currency);
    events.push({
      id: `ap-${p.id}`,
      category: "affiliate",
      title: `Affiliate payout ${p.status} — ${money}`,
      actor: userName,
      actorKind: "user",
      context: p.method ? `via ${p.method}` : null,
      at: p.processedAt ?? p.createdAt,
    });
  }

  return events;
}

function HistoryPanel({ data }: { data: UserRecordData }) {
  const events = useMemo(() => buildHistory(data), [data]);
  return (
    <ActivityTimeline
      events={events}
      title="History"
      emptyLabel="No activity has been recorded on this account yet."
    />
  );
}

function NotesPanel({
  userId,
  notes,
  onAdded,
}: {
  userId: string;
  notes: UserRecordData["notes"];
  onAdded: () => void;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add an internal note about this user…"
          className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={pending || !body.trim()}
            onClick={() =>
              start(async () => {
                const r = await addAdminUserNote({ userId, body });
                if (r.ok) {
                  toast.success("Note added.");
                  setBody("");
                  onAdded();
                } else toast.error(r.error ?? "Failed.");
              })
            }
          >
            Add note
          </Button>
        </div>
      </div>
      <Section
        icon={Pencil}
        title="Notes"
        count={notes.length}
        empty="No notes yet."
      >
        {notes.map((n) => (
          <div
            key={n.id}
            className="border-t border-brand-line px-5 py-3 first:border-t-0"
          >
            <div className="whitespace-pre-wrap text-[13px] text-brand-ink">
              {n.body}
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              {n.author ?? "Admin"} · {fmtDate(n.created_at)}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ── Small UI bits ──────────────────────────────────────────────────────────
function Fact({ k, v, mono }: { k: string; v: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {k}
      </dt>
      <dd
        className={`mt-0.5 font-medium text-brand-ink ${mono ? "font-mono text-xs" : ""}`}
      >
        {v ?? "—"}
      </dd>
    </div>
  );
}
function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-brand-line bg-brand-light/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-base font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}
function DStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-[19px] font-bold leading-none text-brand-ink">
        {value}
      </div>
    </div>
  );
}
function ActBtn({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill border px-3 py-2 text-[12.5px] font-semibold transition disabled:opacity-50 ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-brand-line text-brand-ink hover:bg-brand-light"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
function Lbl({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
// Labelled divider that separates the stacked panels inside a consolidated tab.
function GroupSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-[12px] font-bold uppercase tracking-[0.1em] text-brand-mute">
          {title}
        </h2>
        <div className="h-px flex-1 bg-brand-line" />
      </div>
      {children}
    </section>
  );
}
function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
    >
      {children}
    </select>
  );
}
function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "bad" | "muted" | "good";
}) {
  const cls =
    tone === "bad"
      ? "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled"
      : tone === "good"
        ? "border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed"
        : "border-brand-line bg-brand-light text-brand-mute";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}
function RolePill({ role }: { role: string | null }) {
  const primary = role === "super_admin" || role === "staff" || role === "host";
  const cls = primary
    ? "bg-brand-accent text-brand-primary border-brand-primary/20"
    : "bg-brand-light text-brand-mute border-brand-line";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}
    >
      {(role ?? "guest").replace(/_/g, " ")}
    </span>
  );
}
