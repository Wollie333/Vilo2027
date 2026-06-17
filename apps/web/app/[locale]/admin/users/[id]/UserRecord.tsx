"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  CalendarCheck,
  CreditCard,
  ExternalLink,
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
  ShieldAlert,
  Star,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
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
import { CURRENCY_META, DISPLAY_CURRENCIES } from "@/lib/currency";
import { LedgerList } from "@/components/finance/LedgerList";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import type { Txn } from "@/lib/finance/transactions";

import {
  addAdminUserNote,
  adminCreateAddon,
  adminDeleteAddon,
  adminPayoutAffiliate,
  adminToggleAddon,
  adminUpdateAddon,
  adminUpdateBusiness,
  adminUpdateSubscription,
  setUserProduct,
  changeUserRole,
  reinstateUser,
  requestSupportAccess,
  softDeleteUser,
  suspendUser,
  updateUserProfile,
} from "./actions";

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
  products: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    billingCycle: string | null;
    trialDays: number;
    slug: string | null;
    isFree: boolean;
    isRecommended: boolean;
    bullets: string[];
  }[];
  counts: { bookingsAsGuest: number; refunds: number; listings: number };
  listings: {
    id: string;
    name: string;
    location: string;
    isPublished: boolean;
    price: number;
    currency: string;
    slug: string | null;
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
  viloLedger: {
    id: string;
    type: string;
    status: string;
    amount: number;
    reason: string | null;
    date: string;
  }[];
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
  | "support"
  | "managesub"
  | null;

export function UserRecord({ data }: { data: UserRecordData }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, host } = data;
  const tab = params.get("tab") ?? "overview";

  const setTab = (t: string) => {
    const next = new URLSearchParams(params.toString());
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    router.push(`?${next.toString()}`);
  };

  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState(user.role ?? "guest");
  const [reason, setReason] = useState("");
  const [subPlan, setSubPlan] = useState(
    data.subscription?.plan ?? data.planOptions[0]?.key ?? "free",
  );
  const [subCycle, setSubCycle] = useState<"monthly" | "annual">(
    (data.subscription?.billing_cycle as "monthly" | "annual") ?? "monthly",
  );
  const [subStatus, setSubStatus] = useState<(typeof SUB_STATUSES)[number]>(
    (data.subscription?.status as (typeof SUB_STATUSES)[number]) ?? "active",
  );
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

  const tabs = [
    { key: "overview", label: "Overview" },
    ...(host ? [{ key: "products", label: "Products" }] : []),
    { key: "bookings", label: "Bookings" },
    { key: "ledger", label: "Ledger" },
    ...(host
      ? [{ key: "listings", label: "Listings", count: data.listings.length }]
      : []),
    ...(host
      ? [{ key: "business", label: "Business", count: data.businesses.length }]
      : []),
    ...(host
      ? [
          {
            key: "catalog",
            label: "Add-ons & policies",
            count: data.addons.length + data.policies.length,
          },
        ]
      : []),
    ...(host ? [{ key: "website", label: "Website" }] : []),
    { key: "reviews", label: "Reviews" },
    {
      key: "relationships",
      label: "Relationships",
      count: data.relationships.length,
    },
    { key: "referrals", label: "Referrals" },
    {
      key: "support",
      label: "Support",
      count: data.dataRequests.length || undefined,
    },
    {
      key: "activity",
      label: "Activity",
      count: data.audit.length || undefined,
    },
    { key: "notes", label: "Notes", count: data.notes.length },
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
            onReinstate={() =>
              run(
                reinstateUser({
                  userId: user.id,
                  reason: "Reinstated by admin",
                }),
                "User reinstated.",
              )
            }
            pending={pending}
          />
        </aside>

        {/* Working column */}
        <div className="flex min-w-0 flex-col gap-5">
          <RecordTabs active={tab} onSelect={setTab} tabs={tabs} />
          <div>
            {tab === "overview" ? <OverviewPanel data={data} /> : null}
            {tab === "products" ? (
              <ProductsPanel
                data={data}
                onManage={() => setDialog("managesub")}
              />
            ) : null}
            {tab === "bookings" ? (
              <BookingsPanel
                data={data}
                onRequestSupport={() => setDialog("support")}
              />
            ) : null}
            {tab === "ledger" ? (
              <LedgerPanel
                data={data}
                onRequestSupport={() => setDialog("support")}
              />
            ) : null}
            {tab === "listings" ? <ListingsPanel data={data} /> : null}
            {tab === "business" ? (
              <BusinessPanel data={data} onEdit={setEditBiz} />
            ) : null}
            {tab === "catalog" ? <CatalogPanel data={data} /> : null}
            {tab === "website" ? <WebsitePanel data={data} /> : null}
            {tab === "reviews" ? <ReviewsPanel data={data} /> : null}
            {tab === "relationships" ? (
              <RelationshipsPanel data={data} />
            ) : null}
            {tab === "referrals" ? <ReferralsPanel data={data} /> : null}
            {tab === "support" ? <SupportPanel data={data} /> : null}
            {tab === "activity" ? <ActivityPanel data={data} /> : null}
            {tab === "notes" ? (
              <NotesPanel
                userId={user.id}
                notes={data.notes}
                onAdded={() => router.refresh()}
              />
            ) : null}
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
        description="Set this host's plan, billing cycle and status (e.g. place on hold)."
      >
        <div className="space-y-4">
          <Lbl label="Plan">
            <select
              value={subPlan}
              onChange={(e) => setSubPlan(e.target.value)}
              className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              {data.planOptions.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </Lbl>
          <Lbl label="Billing cycle">
            <select
              value={subCycle}
              onChange={(e) =>
                setSubCycle(e.target.value as "monthly" | "annual")
              }
              className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
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
        </div>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            disabled={pending || !host}
            onClick={() =>
              host
                ? run(
                    adminUpdateSubscription({
                      hostId: host.id,
                      plan: subPlan,
                      billingCycle: subCycle,
                      status: subStatus,
                    }),
                    "Subscription updated.",
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
  onReinstate,
  pending,
}: {
  data: UserRecordData;
  onEdit: () => void;
  onRole: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  onReinstate: () => void;
  pending: boolean;
}) {
  const { user, host } = data;
  const sep = <div className="h-px bg-brand-line" />;
  const eyebrow =
    "text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-mute";
  const paidToVilo = data.viloLedger
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
          {!user.deleted_at ? (
            <ActBtn icon={Trash2} label="Delete" onClick={onDelete} danger />
          ) : null}
        </div>
        {host ? (
          <Link
            href={`/admin/as/${user.id}/dashboard`}
            className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
          >
            <ExternalLink className="h-4 w-4" /> View as host
          </Link>
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
              label="Paid to Vilo"
              value={formatMoney(paidToVilo, "ZAR")}
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

function OverviewPanel({ data }: { data: UserRecordData }) {
  const { user, host } = data;
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact k="Email" v={user.email} mono />
        <Fact k="Phone" v={user.phone} mono />
        <Fact k="Role" v={user.role} />
        <Fact
          k="Account"
          v={user.is_lead ? "Passwordless (unclaimed)" : "Claimed"}
        />
        <Fact k="Country" v={user.country} />
        <Fact k="Joined" v={fmtDate(user.created_at)} />
        {host ? <Fact k="Host handle" v={`@${host.handle}`} /> : null}
        {host ? (
          <Fact k="Bookings as host" v={String(host.total_bookings ?? 0)} />
        ) : null}
      </dl>
    </section>
  );
}

function ProductsPanel({
  data,
  onManage,
}: {
  data: UserRecordData;
  onManage: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const s = data.subscription;
  const hostId = data.host?.id ?? null;

  // A product is "active" on the account if it's the linked product, or (legacy
  // / plan-mapped) its slug matches the subscription's plan key.
  const isActive = (p: UserRecordData["products"][number]): boolean => {
    if (!s) return false;
    if (s.product_id && p.id === s.product_id) return true;
    if (!s.product_id && p.slug && p.slug === s.plan) return true;
    return false;
  };

  function activate(productId: string) {
    if (!hostId) return;
    setBusyId(productId);
    start(async () => {
      const r = await setUserProduct({ hostId, productId });
      setBusyId(null);
      if (r.ok) {
        toast.success("Product activated on this account.");
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

  return (
    <div className="space-y-5">
      {/* Current subscription summary */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Current subscription
            </div>
            {s ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="font-display text-lg font-bold text-brand-ink">
                  {s.plan}
                </span>
                <SubStatusPill status={s.status} />
              </div>
            ) : (
              <div className="mt-1 text-sm text-brand-mute">
                No subscription on file yet.
              </div>
            )}
          </div>
          {s ? (
            <Button size="sm" variant="outline" onClick={onManage}>
              Manage status &amp; cycle
            </Button>
          ) : null}
        </div>
        {s ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Fact k="Cycle" v={s.billing_cycle} />
            <Fact k="Renews" v={fmtDate(s.current_period_end)} />
            <Fact k="Trial ends" v={fmtDate(s.trial_ends_at)} />
          </dl>
        ) : null}
      </section>

      {/* Product catalog — activate / manage */}
      <div>
        <div className="mb-2 text-[12px] text-brand-mute">
          Products on the system. Click a product to activate it on this
          account; the active one is marked. Edit a product in the Products hub.
        </div>
        {data.products.length === 0 ? (
          <section className="rounded-card border border-brand-line bg-white p-5 text-sm text-brand-mute shadow-card">
            No subscription products configured yet.
          </section>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.products.map((p) => {
              const active = isActive(p);
              const cycle = cycleLabel[p.billingCycle ?? "monthly"] ?? "month";
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-card border p-5 shadow-card ${
                    active
                      ? "border-brand-primary ring-1 ring-brand-primary"
                      : "border-brand-line"
                  } bg-white`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-display text-base font-bold text-brand-ink">
                      {p.name}
                    </div>
                    {active ? (
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
                        <li
                          key={i}
                          className="text-[12px] leading-snug text-brand-mute"
                        >
                          • {b}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-4 flex items-center gap-2 pt-1">
                    {active ? (
                      <Button size="sm" variant="outline" onClick={onManage}>
                        Manage
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={pending || !hostId}
                        onClick={() => activate(p.id)}
                      >
                        {busyId === p.id ? "Activating…" : "Activate"}
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
            })}
          </div>
        )}
      </div>
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

function LedgerPanel({
  data,
  onRequestSupport,
}: {
  data: UserRecordData;
  onRequestSupport: () => void;
}) {
  return (
    <div className="space-y-6">
      <SupportBanner
        support={data.support}
        isHost={!!data.host}
        onRequest={onRequestSupport}
      />
      {data.host && data.hostFinance ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h3 className="mb-3 font-display text-sm font-bold text-brand-ink">
            Booking ledger (their guests → them)
          </h3>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <MiniKpi
              label="Collected"
              value={formatMoney(data.hostFinance.collected, "ZAR")}
            />
            <MiniKpi
              label="Outstanding"
              value={formatMoney(data.hostFinance.outstanding, "ZAR")}
            />
            <MiniKpi
              label="Refunded"
              value={formatMoney(data.hostFinance.refunded, "ZAR")}
            />
            <MiniKpi
              label="Net"
              value={formatMoney(data.hostFinance.net, "ZAR")}
            />
          </div>
          <LedgerList
            entries={data.hostTxns}
            showGuest
            emptyLabel="No booking transactions yet."
            minWidth={720}
          />
        </section>
      ) : null}
      <Section
        icon={CreditCard}
        title="Vilo account (them → Vilo)"
        count={data.viloLedger.length}
        empty="No payments to Vilo yet."
      >
        {data.viloLedger.map((t) => (
          <RowLink
            key={t.id}
            primary={`${t.type[0].toUpperCase()}${t.type.slice(1)}`}
            secondary={`${fmtDate(t.date)}${t.reason ? ` · ${t.reason}` : ""}${t.status !== "completed" ? ` · ${t.status}` : ""}`}
            amount={`${t.amount < 0 ? "−" : ""}${formatMoney(Math.abs(t.amount), "ZAR")}`}
          />
        ))}
      </Section>
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
      {data.listings.map((l) => (
        <RowLink
          key={l.id}
          href={`/admin/users/${data.user.id}/listings/${l.id}/edit`}
          primary={l.name}
          secondary={`${l.location || "—"} · from ${formatMoney(l.price, l.currency)}`}
          status={l.isPublished ? "published" : "draft"}
        />
      ))}
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
function CatalogPanel({ data }: { data: UserRecordData }) {
  const router = useRouter();
  const hostId = data.host?.id ?? null;
  const [pending, start] = useTransition();
  const [editAddon, setEditAddon] = useState<AddonItem | "new" | null>(null);

  const refresh = () => router.refresh();

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
  const remove = (a: AddonItem) => {
    if (!hostId) return;
    if (
      !window.confirm(
        `Delete “${a.name}”? It will be detached from ${a.listingsCount} listing(s).`,
      )
    )
      return;
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
        <div className="mb-2 flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-brand-mute" />
          <h3 className="font-display text-[15px] font-bold text-brand-ink">
            Policies library
          </h3>
          <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
            {data.policies.length}
          </span>
        </div>
        <Section
          icon={ScrollText}
          title="Policies"
          count={data.policies.length}
          empty="No policies in this host's library yet."
        >
          {data.policies.map((p) => (
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
            </div>
          ))}
        </Section>
        <p className="mt-2 text-[12px] text-brand-mute">
          Create and edit a host&apos;s policies from any of their listings
          (Listings → open a listing → Policies). Per-listing assignment lives
          there too.
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

function WebsitePanel({ data }: { data: UserRecordData }) {
  const handle = data.host?.handle ?? null;
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
        <Globe className="h-4 w-4 text-brand-mute" />
        <span className="font-display text-[15px] font-bold text-brand-ink">
          Website
        </span>
        <span className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-brand-mute">
          Coming soon
        </span>
      </div>
      <div className="px-6 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-brand-light">
          <Globe className="h-6 w-6 text-brand-mute" />
        </div>
        <h3 className="mt-4 font-display text-base font-bold text-brand-ink">
          Host website builder
        </h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-brand-mute">
          A future feature: each host will get a hosted, branded website for
          their listings and direct bookings. This tab will let you manage that
          site — domain, theme, pages and publish state — from the admin.
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
        <p className="mt-3 text-[13px] text-brand-mute">
          This user isn&apos;t an affiliate yet. When they refer others, the
          people they bring to Vilo will appear here.
        </p>
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
                <div className="mt-0.5 font-mono text-[12px] text-brand-mute">
                  /r/{data.affiliateSlug}
                  {stats && stats.status !== "active"
                    ? ` · ${stats.status}`
                    : ""}
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
          empty="No referrals yet. People this affiliate brings to Vilo appear here."
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

type ActivityTone = "edit" | "booking" | "review" | "data" | "support";
type ActivityItem = {
  id: string;
  tone: ActivityTone;
  what: string;
  who: string;
  detail: string | null;
  date: string;
};

// Friendly "what happened" copy for an admin_audit_log action code.
function humanizeAuditAction(
  action: string,
  targetType: string | null,
): string {
  const MAP: Record<string, string> = {
    "listing.edit": "Edited a listing",
    "user.update": "Updated the profile",
    "user.suspend": "Suspended the account",
    "user.unsuspend": "Restored the account",
    "user.role": "Changed the account role",
    "user.delete": "Deleted the account",
    "subscription.update": "Updated the subscription",
    "subscription.cancel": "Cancelled the subscription",
    "booking.edit": "Edited a booking",
    "booking.cancel": "Cancelled a booking",
    "payment.refund": "Issued a refund",
    "review.moderate": "Moderated a review",
    permission_denied: "Permission denied",
  };
  if (MAP[action]) return MAP[action];
  const pretty = action
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return targetType ? `${pretty} (${targetType})` : pretty;
}

function ActivityDot({ tone }: { tone: ActivityTone }) {
  const cls: Record<ActivityTone, string> = {
    edit: "bg-brand-primary/10 text-brand-primary",
    booking: "bg-status-confirmed/10 text-status-confirmed",
    review: "bg-amber-100 text-amber-600",
    data: "bg-status-cancelled/10 text-status-cancelled",
    support: "bg-status-pending/10 text-status-pending",
  };
  const Icon =
    tone === "booking"
      ? CalendarCheck
      : tone === "review"
        ? Star
        : tone === "data"
          ? ShieldAlert
          : tone === "support"
            ? KeyRound
            : Pencil;
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls[tone]}`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function ActivityPanel({ data }: { data: UserRecordData }) {
  const items: ActivityItem[] = [];
  for (const b of data.bookingsAsGuest)
    items.push({
      id: `bg-${b.id}`,
      tone: "booking",
      what: `Booked ${b.listingName}`,
      who: data.user.full_name ?? "Guest",
      detail: `${b.reference} · ${b.status}`,
      date: b.checkIn ?? "",
    });
  for (const rv of data.reviewsWritten)
    items.push({
      id: `rw-${rv.id}`,
      tone: "review",
      what: `Reviewed ${rv.listingName}`,
      who: data.user.full_name ?? "Guest",
      detail: `${rv.rating}★`,
      date: rv.createdAt,
    });
  // Admin / support changes — the who/what/when trail (incl. listing edits made
  // by staff from this very record).
  for (const a of data.audit)
    items.push({
      id: `au-${a.id}`,
      tone: "edit",
      what: humanizeAuditAction(a.action, a.targetType),
      who: a.actor ?? "Vilo staff",
      detail: a.impersonating ? "while acting as this user" : "staff action",
      date: a.created_at,
    });
  for (const d of data.dataRequests)
    items.push({
      id: `dr-${d.id}`,
      tone: "data",
      what: `Data ${d.type} request`,
      who: data.user.full_name ?? "User",
      detail: d.status,
      date: d.createdAt,
    });
  // Support-access permission lifecycle — request + the host's decision.
  for (const g of data.supportGrants) {
    items.push({
      id: `sg-req-${g.id}`,
      tone: "support",
      what: "Requested edit access",
      who: g.requestedBy ?? "Vilo support",
      detail: g.reason ? `“${g.reason}”` : "awaiting host approval",
      date: g.requestedAt,
    });
    if (g.decidedAt) {
      items.push({
        id: `sg-dec-${g.id}`,
        tone: "support",
        what: `Host ${g.status} edit access`,
        who: "Host",
        detail:
          g.status === "approved" && g.expiresAt
            ? `valid until ${fmtDate(g.expiresAt)}`
            : g.status,
        date: g.decidedAt,
      });
    }
  }
  items.sort((x, y) => (x.date < y.date ? 1 : -1));

  return <ActivityList items={items} />;
}

const ACTIVITY_TONES: { key: ActivityTone | "all"; label: string }[] = [
  { key: "all", label: "All activity" },
  { key: "edit", label: "Staff edits" },
  { key: "booking", label: "Bookings" },
  { key: "review", label: "Reviews" },
  { key: "data", label: "Data requests" },
  { key: "support", label: "Support access" },
];

function ActivityList({ items }: { items: ActivityItem[] }) {
  const [q, setQ] = useState("");
  const [tone, setTone] = useState<ActivityTone | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (tone !== "all" && it.tone !== tone) return false;
      if (needle) {
        const hay = [it.what, it.who, it.detail]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, tone]);

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
        <Calendar className="h-4 w-4 text-brand-mute" />
        <span className="font-display text-[15px] font-bold text-brand-ink">
          Activity &amp; history
        </span>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {items.length}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-line bg-[#FBFDFC] px-4 py-2.5">
        <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
          <Search className="h-4 w-4 text-brand-mute" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search activity…"
            className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
          />
        </div>
        <FilterSelect
          value={tone}
          onChange={(v) => setTone(v as ActivityTone | "all")}
        >
          {ACTIVITY_TONES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </FilterSelect>
      </div>
      {filtered.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-brand-mute">
          No activity matches this filter.
        </p>
      ) : (
        filtered.slice(0, 120).map((it) => (
          <div
            key={it.id}
            className="flex items-start gap-3 border-t border-brand-line px-5 py-3 first:border-t-0"
          >
            <ActivityDot tone={it.tone} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-brand-ink">
                {it.what}
              </div>
              <div className="mt-0.5 text-[11.5px] text-brand-mute">
                by <span className="font-medium text-brand-ink">{it.who}</span>
                {it.detail ? ` · ${it.detail}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11.5px] font-medium text-brand-ink">
                {fmtDate(it.date)}
              </div>
              <div className="text-[10.5px] text-brand-mute">
                {fmtTime(it.date)}
              </div>
            </div>
          </div>
        ))
      )}
      <div className="border-t border-brand-line bg-[#FBFDFC] px-4 py-3 text-[12px] tabular-nums text-brand-mute">
        Showing {Math.min(filtered.length, 120)} of {items.length}
      </div>
    </div>
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
