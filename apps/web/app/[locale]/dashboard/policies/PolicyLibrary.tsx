"use client";

import {
  Baby,
  Cigarette,
  CigaretteOff,
  Clock,
  Copy,
  Eye,
  FileText,
  Gavel,
  Home,
  KeyRound,
  LayoutTemplate,
  Lock,
  LogIn,
  LogOut,
  Moon,
  PartyPopper,
  PawPrint,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  PolicyDialog,
  type PolicyDialogData,
} from "@/components/policy/PolicyDialog";

import {
  duplicatePolicyAction,
  setDefaultPolicyAction,
  togglePolicyStatusAction,
} from "./actions";
import { PolicyEditorSheet } from "./PolicyEditorSheet";
import { RetirePolicyModal } from "./RetirePolicyModal";
import {
  CHECK_IN_METHOD_LABEL,
  POLICY_TYPES,
  type CheckInMethod,
  type PolicyType,
} from "./schemas";

export type PolicyCard = {
  id: string;
  type: PolicyType;
  name: string;
  summary: string | null;
  preset: string | null;
  locked: boolean;
  status: "active" | "draft";
  isDefault: boolean;
  isNonRefundable: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInMethod: CheckInMethod | null;
  petsAllowed: boolean | null;
  smokingAllowed: boolean | null;
  partiesAllowed: boolean | null;
  childrenWelcome: boolean | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  version: number;
  updatedAt: string;
  rules: { days_before: number; refund_percent: number; label: string }[];
  bodyHtml: string | null;
  assignedCount: number;
};

type Coverage = {
  roomsTotal: number;
  roomsWithCancellation: number;
  roomsWithHouseRules: number;
  fullyCovered: boolean;
};

// Which library filter bucket a policy type falls into. booking_terms +
// privacy collapse into one "legal" bucket.
type FilterKey =
  | "all"
  | "cancellation"
  | "house_rules"
  | "check_in_out"
  | "legal";

function bucketOf(type: PolicyType): Exclude<FilterKey, "all"> {
  return type === "booking_terms" || type === "privacy" ? "legal" : type;
}

// Hosts manage four types now: cancellation, house rules, check-in/out and their
// own Terms & Conditions (the "legal" bucket). Privacy stays platform-wide.
const FILTERS: { key: FilterKey; label: string; icon: LucideIcon | null }[] = [
  { key: "all", label: "All", icon: null },
  { key: "cancellation", label: "Cancellation", icon: RotateCcw },
  { key: "house_rules", label: "House rules", icon: Home },
  { key: "check_in_out", label: "Check-in & out", icon: Clock },
  { key: "legal", label: "Terms", icon: Gavel },
];

const TYPE_META: Record<
  PolicyType,
  { icon: LucideIcon; pillIcon: LucideIcon; pill: string }
> = {
  cancellation: { icon: RotateCcw, pillIcon: RotateCcw, pill: "Cancellation" },
  check_in_out: { icon: Clock, pillIcon: KeyRound, pill: "Check-in & out" },
  house_rules: { icon: Home, pillIcon: Home, pill: "House rules" },
  booking_terms: { icon: FileText, pillIcon: Gavel, pill: "Terms" },
  privacy: { icon: Lock, pillIcon: ShieldCheck, pill: "Privacy" },
};

type SortKey = "type" | "updated" | "status";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "type", label: "Sort: Type" },
  { value: "updated", label: "Sort: Recently updated" },
  { value: "status", label: "Sort: Status" },
];

const TYPE_ORDER: Record<PolicyType, number> = {
  cancellation: 0,
  check_in_out: 1,
  house_rules: 2,
  booking_terms: 3,
  privacy: 4,
};

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "—");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function toDialogData(p: PolicyCard): PolicyDialogData {
  return {
    type: p.type,
    name: p.name,
    summary: p.summary,
    isNonRefundable: p.isNonRefundable,
    rules: p.rules,
    checkInTime: p.checkInTime,
    checkOutTime: p.checkOutTime,
    bodyHtml: p.bodyHtml,
  };
}

export function PolicyLibrary({
  initial,
  coverage,
}: {
  initial: PolicyCard[];
  coverage: Coverage;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("type");
  const [editor, setEditor] = useState<{
    open: boolean;
    type: PolicyType;
    policy: PolicyCard | null;
  }>({ open: false, type: "cancellation", policy: null });

  const openCreate = (type: PolicyType) =>
    setEditor({ open: true, type, policy: null });
  const openEdit = (policy: PolicyCard) =>
    setEditor({ open: true, type: policy.type, policy });

  const activeCount = initial.filter((p) => p.status === "active").length;
  const draftCount = initial.filter((p) => p.status === "draft").length;

  // counts per filter bucket for the chips
  const bucketCounts = useMemo(() => {
    const m = new Map<FilterKey, number>();
    m.set("all", initial.length);
    for (const p of initial) {
      const b = bucketOf(p.type);
      m.set(b, (m.get(b) ?? 0) + 1);
    }
    return m;
  }, [initial]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = initial.filter((p) => {
      const matchFilter = filter === "all" || bucketOf(p.type) === filter;
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.summary ?? "").toLowerCase().includes(q);
      return matchFilter && matchQ;
    });
    const sorted = [...filtered];
    if (sort === "type") {
      sorted.sort(
        (a, b) =>
          TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
          Number(b.isDefault) - Number(a.isDefault) ||
          a.name.localeCompare(b.name),
      );
    } else if (sort === "updated") {
      sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } else {
      sorted.sort(
        (a, b) =>
          Number(b.status === "active") - Number(a.status === "active") ||
          a.name.localeCompare(b.name),
      );
    }
    return sorted;
  }, [initial, filter, query, sort]);

  const onChanged = () => router.refresh();

  return (
    <div className="space-y-6">
      {/* ============ DARK HERO ============ */}
      <section
        className="relative overflow-hidden rounded-card shadow-peek"
        style={{
          backgroundImage:
            "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-brand-secondary/40 blur-3xl"
        />
        <div className="relative px-6 py-7 md:px-8 md:py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
                  Rules &amp; terms
                </span>
                {coverage.fullyCovered ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                    All rooms covered
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 font-display text-[30px] font-extrabold leading-tight tracking-tight text-white md:text-[36px]">
                Policies
              </h1>
              <p className="mt-2.5 text-[14px] leading-relaxed text-white/65 md:text-[15px]">
                Set the cancellation terms, house rules and booking conditions
                guests agree to. Build them once, assign them to any listing,
                and we snapshot them onto every booking.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <CreateMenu onPick={openCreate}>
                  <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-brand-secondary shadow-glow transition hover:bg-brand-accent">
                    <Plus className="h-4 w-4" /> New policy
                  </span>
                </CreateMenu>
                <button
                  type="button"
                  onClick={() => openCreate("cancellation")}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/20 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
                >
                  <LayoutTemplate className="h-4 w-4" /> Use a preset
                </button>
              </div>
            </div>

            {/* stat strip */}
            <div className="grid grid-cols-3 gap-3 sm:gap-5">
              <Stat label="Active" value={activeCount} hint="live" accent />
              <Stat
                label="Assigned"
                value={
                  coverage.roomsTotal
                    ? `${coverage.roomsWithCancellation}/${coverage.roomsTotal}`
                    : "—"
                }
                hint="rooms"
              />
              <Stat label="Drafts" value={draftCount} hint="unpublished" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ COMPLIANCE BANNER ============ */}
      {coverage.fullyCovered ? (
        <section className="flex items-center gap-3 rounded-card border border-brand-primary/30 bg-brand-accent/40 px-5 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-brand-secondary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-brand-ink">
              Every room has a cancellation policy &amp; house rules assigned
            </div>
            <div className="text-[11.5px] text-brand-mute">
              Your listings are ready to take bookings.
            </div>
          </div>
        </section>
      ) : coverage.roomsTotal > 0 ? (
        <section className="flex items-center gap-3 rounded-card border border-status-pending/30 bg-status-pending/10 px-5 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-status-pending">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-brand-ink">
              Some rooms still need a policy assigned
            </div>
            <div className="text-[11.5px] text-brand-mute">
              {coverage.roomsWithCancellation}/{coverage.roomsTotal} rooms have
              a cancellation policy · {coverage.roomsWithHouseRules}/
              {coverage.roomsTotal} have house rules. Assign them from each
              listing&rsquo;s editor.
            </div>
          </div>
        </section>
      ) : null}

      {/* ============ FILTER BAR ============ */}
      <section className="sticky top-16 z-20 rounded-card border border-brand-line bg-white/95 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="hscroll flex items-center gap-1.5 overflow-x-auto">
            {FILTERS.map((f) => {
              const count = bucketCounts.get(f.key) ?? 0;
              if (f.key !== "all" && count === 0) return null;
              const active = filter === f.key;
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1.5 text-[12.5px] transition ${
                    active
                      ? "bg-brand-accent font-semibold text-brand-secondary"
                      : "border border-brand-line font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                  }`}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {f.label}
                  <span
                    className={`num rounded-pill px-1.5 text-[10px] ${
                      active ? "bg-white/70" : "bg-brand-line"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-pill border border-brand-line bg-white px-3 py-1.5">
              <Search className="h-4 w-4 shrink-0 text-brand-mute" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search policies…"
                className="w-32 bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute sm:w-40"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink outline-none transition hover:bg-brand-light/60"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ============ GRID ============ */}
      {visible.length === 0 ? (
        <EmptyState filtered={query !== "" || filter !== "all"} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <PolicyGridCard
              key={p.id}
              policy={p}
              onEdit={() => openEdit(p)}
              onChanged={onChanged}
            />
          ))}
          {filter === "all" && query === "" ? (
            <CreateMenu onPick={openCreate}>
              <span className="policy-card flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-brand-line bg-white/40 p-5 text-brand-mute transition hover:border-brand-primary hover:bg-brand-light/50 hover:text-brand-secondary">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
                  <Plus className="h-6 w-6" />
                </span>
                <span className="font-display text-[14px] font-semibold text-brand-ink">
                  Create a policy
                </span>
                <span className="text-[11.5px]">Or start from a preset</span>
              </span>
            </CreateMenu>
          ) : null}
        </div>
      )}

      <PolicyEditorSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        type={editor.type}
        policy={editor.policy}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
        {label}
      </div>
      <div className="num mt-1 font-display text-2xl font-bold text-white">
        {value}
      </div>
      <div
        className={`text-[10px] ${accent ? "text-brand-primary" : "text-brand-accent/60"}`}
      >
        {hint}
      </div>
    </div>
  );
}

/** Dropdown that lets the host pick which kind of policy to create. */
function CreateMenu({
  children,
  onPick,
}: {
  children: React.ReactNode;
  onPick: (type: PolicyType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {children}
      </button>
      {open ? (
        <div className="absolute left-0 z-40 mt-2 w-60 overflow-hidden rounded-card border border-brand-line bg-white p-1.5 shadow-lift">
          {POLICY_TYPES.map((t) => {
            const Icon = TYPE_META[t.value].icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(t.value);
                }}
                className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-accent text-brand-secondary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-primary/10 px-2.5 py-1 text-[10.5px] font-semibold text-brand-secondary">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" /> Active
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-status-draft/15 px-2.5 py-1 text-[10.5px] font-semibold text-brand-mute">
      <span className="h-1.5 w-1.5 rounded-full bg-status-draft" /> Draft
    </span>
  );
}

function houseRuleChips(p: PolicyCard) {
  const chips: { icon: LucideIcon; label: string }[] = [];
  if (p.petsAllowed !== null)
    chips.push({
      icon: PawPrint,
      label: p.petsAllowed ? "Pets OK" : "No pets",
    });
  if (p.smokingAllowed !== null)
    chips.push({
      icon: p.smokingAllowed ? Cigarette : CigaretteOff,
      label: p.smokingAllowed ? "Smoking OK" : "No smoking",
    });
  if (p.quietHoursStart)
    chips.push({ icon: Moon, label: `Quiet ${fmtTime(p.quietHoursStart)}` });
  if (p.partiesAllowed !== null)
    chips.push({
      icon: PartyPopper,
      label: p.partiesAllowed ? "Parties OK" : "No parties",
    });
  if (p.childrenWelcome !== null)
    chips.push({
      icon: Baby,
      label: p.childrenWelcome ? "Children welcome" : "No children",
    });
  return chips;
}

function refundTier(percent: number) {
  if (percent >= 100) return "text-brand-primary";
  if (percent <= 0) return "text-status-cancelled";
  return "text-status-pending";
}
function refundDot(percent: number) {
  if (percent >= 100) return "bg-brand-primary";
  if (percent <= 0) return "bg-status-cancelled";
  return "bg-status-pending";
}
function ruleWhen(daysBefore: number) {
  if (daysBefore <= 0) return "Under 24 hours";
  return `${daysBefore}+ day${daysBefore === 1 ? "" : "s"} before`;
}

function PolicyGridCard({
  policy: p,
  onEdit,
  onChanged,
}: {
  policy: PolicyCard;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [retireOpen, setRetireOpen] = useState(false);
  const meta = TYPE_META[p.type];
  const Icon = meta.icon;
  const PillIcon = meta.pillIcon;
  const active = p.status === "active";
  const wide = p.type === "cancellation" && p.isDefault;
  const chips = p.type === "house_rules" ? houseRuleChips(p) : [];
  const topRules = [...p.rules]
    .sort((a, b) => b.days_before - a.days_before)
    .slice(0, 3);

  function toggle() {
    start(async () => {
      const r = await togglePolicyStatusAction(p.id, !active);
      if (r.ok) onChanged();
      else toast.error(r.error);
    });
  }
  function makeDefault() {
    start(async () => {
      const r = await setDefaultPolicyAction(p.id);
      if (r.ok) {
        toast.success("Set as default");
        onChanged();
      } else toast.error(r.error);
    });
  }
  function duplicate() {
    start(async () => {
      const r = await duplicatePolicyAction(p.id);
      if (r.ok) {
        toast.success("Duplicated");
        onChanged();
      } else toast.error(r.error);
    });
  }
  return (
    <article
      className={`group flex flex-col rounded-card border bg-white p-5 shadow-card transition hover:shadow-lift ${
        active
          ? "border-brand-line"
          : "border-dashed border-brand-line opacity-80 hover:opacity-100"
      } ${wide ? "sm:col-span-2" : ""}`}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${
              active
                ? "bg-brand-accent text-brand-secondary"
                : "bg-brand-line/60 text-brand-mute"
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-[16px] font-bold text-brand-ink">
                {p.name}
              </h3>
              {p.isDefault ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-brand-secondary px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white">
                  <Star className="h-2.5 w-2.5" /> Default
                </span>
              ) : null}
              {p.locked ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-brand-mute">
                  <Lock className="h-2.5 w-2.5" /> Preset
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
              {p.isDefault
                ? `${meta.pill} · default for all rooms`
                : p.assignedCount > 0
                  ? `${meta.pill} · assigned to ${p.assignedCount} ${p.assignedCount === 1 ? "place" : "places"}`
                  : (p.summary ?? meta.pill)}
            </div>
          </div>
        </div>
        <StatusPill active={active} />
      </div>

      {/* body */}
      {p.type === "cancellation" ? (
        p.isNonRefundable ? (
          <div className="mt-5 rounded-[12px] border border-status-cancelled/20 bg-status-cancelled/5 p-3.5 text-[12.5px] font-medium text-brand-ink">
            Non-refundable — no refund at any time.
          </div>
        ) : topRules.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {topRules.map((r, i) => (
              <div
                key={i}
                className="rounded-[12px] border border-brand-line bg-brand-light/40 p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${refundDot(r.refund_percent)}`}
                  />
                  <span className="text-[11px] font-semibold text-brand-ink">
                    {ruleWhen(r.days_before)}
                  </span>
                </div>
                <div
                  className={`num mt-2 font-display text-[18px] font-bold ${refundTier(r.refund_percent)}`}
                >
                  {r.refund_percent}%
                </div>
                <div className="truncate text-[10.5px] text-brand-mute">
                  {r.label}
                </div>
              </div>
            ))}
          </div>
        ) : null
      ) : null}

      {p.type === "check_in_out" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
            <div className="flex items-center gap-1.5 text-[10.5px] text-brand-mute">
              <LogIn className="h-3.5 w-3.5 text-brand-primary" /> Check-in
            </div>
            <div className="num mt-1 font-display text-[16px] font-bold text-brand-ink">
              from {fmtTime(p.checkInTime)}
            </div>
          </div>
          <div className="rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
            <div className="flex items-center gap-1.5 text-[10.5px] text-brand-mute">
              <LogOut className="h-3.5 w-3.5 text-brand-secondary" /> Check-out
            </div>
            <div className="num mt-1 font-display text-[16px] font-bold text-brand-ink">
              by {fmtTime(p.checkOutTime)}
            </div>
          </div>
        </div>
      ) : null}

      {p.type === "house_rules" ? (
        chips.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {chips.map((c, i) => {
              const ChipIcon = c.icon;
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-1 text-[10.5px] text-brand-secondary"
                >
                  <ChipIcon className="h-3 w-3" /> {c.label}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 line-clamp-2 text-[12.5px] leading-relaxed text-brand-mute">
            {p.summary ?? "What guests agree to when they book."}
          </p>
        )
      ) : null}

      {p.type === "booking_terms" || p.type === "privacy" ? (
        <p className="mt-4 line-clamp-2 text-[12.5px] leading-relaxed text-brand-mute">
          {p.summary ?? "The agreement guests accept at checkout."}
        </p>
      ) : null}

      {/* footer */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-brand-line pt-4">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-brand-mute">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-light px-2.5 py-1 font-medium text-brand-secondary">
            <PillIcon className="h-3 w-3" />
            {p.type === "check_in_out" && p.checkInMethod
              ? CHECK_IN_METHOD_LABEL[p.checkInMethod]
              : meta.pill}
          </span>
          <span className="truncate font-mono">
            v{p.version} · {fmtDate(p.updatedAt)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Toggle on={active} onClick={toggle} disabled={pending} />
          {active && !p.isDefault ? (
            <IconBtn
              label="Set as default"
              onClick={makeDefault}
              disabled={pending}
            >
              <Star className="h-3.5 w-3.5" />
            </IconBtn>
          ) : null}
          <PolicyDialog
            data={toDialogData(p)}
            trigger={
              <IconBtn label="View">
                <Eye className="h-3.5 w-3.5" />
              </IconBtn>
            }
          />
          {p.locked ? (
            <IconBtn label="Duplicate" onClick={duplicate} disabled={pending}>
              <Copy className="h-3.5 w-3.5" />
            </IconBtn>
          ) : (
            <>
              <IconBtn label="Edit" onClick={onEdit} disabled={pending}>
                <Pencil className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn label="Duplicate" onClick={duplicate} disabled={pending}>
                <Copy className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn
                label="Remove"
                onClick={() => setRetireOpen(true)}
                disabled={pending}
                danger
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </>
          )}
        </div>
      </div>

      <RetirePolicyModal
        open={retireOpen}
        onOpenChange={setRetireOpen}
        policyId={p.id}
        policyName={p.name}
        onDone={onChanged}
      />
    </article>
  );
}

function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Active — click to draft" : "Draft — click to activate"}
      title={on ? "Active" : "Draft"}
      onClick={onClick}
      disabled={disabled}
      className={`relative h-5 w-[34px] shrink-0 rounded-pill transition-colors disabled:opacity-50 ${
        on ? "bg-brand-primary" : "bg-brand-line"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[14px]" : ""
        }`}
      />
    </button>
  );
}

const IconBtn = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    danger?: boolean;
    children: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ label, onClick, disabled, danger, children, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`flex h-8 w-8 items-center justify-center rounded-[8px] border border-brand-line transition-colors disabled:opacity-40 ${
      danger
        ? "text-brand-mute hover:bg-red-50 hover:text-status-cancelled"
        : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
    }`}
    {...rest}
  >
    {children}
  </button>
));
IconBtn.displayName = "IconBtn";

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white py-16 text-center shadow-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
        <SearchX className="h-6 w-6" />
      </div>
      <div className="mt-3 font-display text-[15px] font-bold text-brand-ink">
        {filtered ? "No policies match" : "No policies yet"}
      </div>
      <p className="mt-1 text-[12.5px] text-brand-mute">
        {filtered
          ? "Try a different type or clear your search."
          : "Create your first policy to assign it to your listings."}
      </p>
    </div>
  );
}
