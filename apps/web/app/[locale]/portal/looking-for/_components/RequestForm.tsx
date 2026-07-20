"use client";

import {
  Banknote,
  Calendar,
  Check,
  ChevronRight,
  ClipboardCheck,
  ImagePlus,
  ListChecks,
  Loader2,
  MapPin,
  Pencil,
  Search,
  Type as TypeIcon,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { ResumeDraftBanner } from "@/components/drafts/ResumeDraftBanner";
import { useAutosaveDraft } from "@/components/drafts/useAutosaveDraft";
import {
  LocationPicker,
  type LocationSelection,
} from "@/components/location/LocationPicker";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoadedDraft } from "@/lib/drafts/store";

import {
  createRequestAction,
  updateRequestAction,
  uploadRequestImageAction,
} from "../actions";
import { TemplateSelector } from "./TemplateSelector";
import type { RequestTemplate } from "./request-templates";
import { RequirementsPicker } from "./RequirementsPicker";
import type { RequirementGroupWithOptions } from "@/lib/looking-for/requirements";

// Numeric fields stay as strings so a restored draft drops straight back into
// the same setters (mirrors the coupon / add-on / special editors).
export type RequestEditValues = {
  title: string;
  description: string;
  category: "accommodation" | "experience" | "venue" | "event" | "other";
  checkIn: string;
  checkOut: string;
  dateFlexibilityDays: string; // "0" = exact dates
  adults: string;
  children: string;
  infants: string;
  childAges: string[]; // one age (0–17) per child, index-aligned
  pets: string; // number of pets, "" = none
  locationText: string;
  region: string;
  destinationFlexible: boolean; // "I'm not sure where yet"
  locationLat: string; // "" = no pin
  locationLng: string;
  searchRadiusKm: string; // "" = no radius
  budgetMin: string;
  budgetMax: string;
  budgetPer: "night" | "total" | "person";
  isUrgent: boolean;
  isPublic: boolean;
  quoteDeadline: string;
  minHostRating: string; // "" = any, else "3" | "3.5" | "4" | "4.5"
  imageUrl: string;
  requirementKeys: string[];
};

export const BLANK_REQUEST: RequestEditValues = {
  title: "",
  description: "",
  category: "accommodation",
  checkIn: "",
  checkOut: "",
  dateFlexibilityDays: "0",
  adults: "2",
  children: "0",
  infants: "0",
  childAges: [],
  pets: "",
  locationText: "",
  region: "",
  destinationFlexible: false,
  locationLat: "",
  locationLng: "",
  searchRadiusKm: "",
  budgetMin: "",
  budgetMax: "",
  budgetPer: "night",
  isUrgent: false,
  isPublic: true,
  quoteDeadline: "",
  minHostRating: "",
  imageUrl: "",
  requirementKeys: [],
};

type SectionKey =
  | "basics"
  | "dates"
  | "location"
  | "requirements"
  | "photo"
  | "review";
type SectionDef = { key: SectionKey; label: string; icon: LucideIcon };

const SECTIONS: SectionDef[] = [
  { key: "basics", label: "Basics", icon: TypeIcon },
  { key: "dates", label: "Dates & guests", icon: Calendar },
  { key: "location", label: "Location & budget", icon: MapPin },
  { key: "requirements", label: "Requirements", icon: ListChecks },
  { key: "photo", label: "Photo & preferences", icon: ImagePlus },
  { key: "review", label: "Review", icon: ClipboardCheck },
];

const PANEL_META: Record<SectionKey, { title: string; desc: string }> = {
  basics: {
    title: "Basics",
    desc: "Tell hosts what you're looking for in one line, plus any detail.",
  },
  dates: {
    title: "Dates & guests",
    desc: "When you'd travel and how many are coming. Dates are optional.",
  },
  location: {
    title: "Location & budget",
    desc: "Where you want to be and roughly what you'd spend. All optional.",
  },
  requirements: {
    title: "Requirements",
    desc: "What the place must have. All optional — pick what matters to you.",
  },
  photo: {
    title: "Photo & preferences",
    desc: "A picture of the vibe, and who should see your request.",
  },
  review: {
    title: "Review",
    desc: "Everything at a glance before hosts start quoting.",
  },
};

const REGIONS = [
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
  "KwaZulu-Natal",
  "Free State",
  "North West",
  "Gauteng",
  "Mpumalanga",
  "Limpopo",
];

// Search-radius presets (km) around the dropped pin.
const RADIUS_OPTIONS = [5, 10, 25, 50, 100, 200];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

interface RequestFormProps {
  mode: "create" | "edit";
  userId: string;
  postId?: string;
  initial: RequestEditValues;
  serverDraft: LoadedDraft | null;
  requirementGroups: RequirementGroupWithOptions[];
}

export function RequestForm({
  mode,
  userId,
  postId,
  initial,
  serverDraft,
  requirementGroups,
}: RequestFormProps) {
  const router = useRouter();
  const [savePending, startSave] = useTransition();
  const [section, setSection] = useState<SectionKey>("basics");
  const sectionIdx = SECTIONS.findIndex((s) => s.key === section);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [dateFlexibilityDays, setDateFlexibilityDays] = useState(
    initial.dateFlexibilityDays,
  );
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [infants, setInfants] = useState(initial.infants);
  const [childAges, setChildAges] = useState<string[]>(initial.childAges);
  const [pets, setPets] = useState(initial.pets);
  const [locationText, setLocationText] = useState(initial.locationText);
  const [region, setRegion] = useState(initial.region);
  const [destinationFlexible, setDestinationFlexible] = useState(
    initial.destinationFlexible,
  );
  const [locationLat, setLocationLat] = useState(initial.locationLat);
  const [locationLng, setLocationLng] = useState(initial.locationLng);
  const [searchRadiusKm, setSearchRadiusKm] = useState(initial.searchRadiusKm);
  const [budgetMin, setBudgetMin] = useState(initial.budgetMin);
  const [budgetMax, setBudgetMax] = useState(initial.budgetMax);
  const [budgetPer, setBudgetPer] = useState(initial.budgetPer);
  const [isUrgent, setIsUrgent] = useState(initial.isUrgent);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [quoteDeadline, setQuoteDeadline] = useState(initial.quoteDeadline);
  const [minHostRating, setMinHostRating] = useState(initial.minHostRating);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [requirementKeys, setRequirementKeys] = useState<string[]>(
    initial.requirementKeys,
  );

  const [dirty, setDirty] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // ---- Auto-save drafts ----
  const draftValue = useMemo<RequestEditValues>(
    () => ({
      title,
      description,
      category,
      checkIn,
      checkOut,
      dateFlexibilityDays,
      adults,
      children,
      infants,
      childAges,
      pets,
      locationText,
      region,
      destinationFlexible,
      locationLat,
      locationLng,
      searchRadiusKm,
      budgetMin,
      budgetMax,
      budgetPer,
      isUrgent,
      isPublic,
      quoteDeadline,
      minHostRating,
      imageUrl,
      requirementKeys,
    }),
    [
      title,
      description,
      category,
      checkIn,
      checkOut,
      dateFlexibilityDays,
      adults,
      children,
      infants,
      childAges,
      pets,
      locationText,
      region,
      destinationFlexible,
      locationLat,
      locationLng,
      searchRadiusKm,
      budgetMin,
      budgetMax,
      budgetPer,
      isUrgent,
      isPublic,
      quoteDeadline,
      minHostRating,
      imageUrl,
      requirementKeys,
    ],
  );

  const applyDraft = useCallback((p: RequestEditValues) => {
    setTitle(p.title);
    setDescription(p.description);
    setCategory(p.category);
    setCheckIn(p.checkIn);
    setCheckOut(p.checkOut);
    setDateFlexibilityDays(p.dateFlexibilityDays);
    setAdults(p.adults);
    setChildren(p.children);
    setInfants(p.infants);
    setChildAges(p.childAges ?? []);
    setPets(p.pets ?? "");
    setLocationText(p.locationText);
    setRegion(p.region);
    setDestinationFlexible(p.destinationFlexible ?? false);
    setLocationLat(p.locationLat ?? "");
    setLocationLng(p.locationLng ?? "");
    setSearchRadiusKm(p.searchRadiusKm ?? "");
    setBudgetMin(p.budgetMin);
    setBudgetMax(p.budgetMax);
    setBudgetPer(p.budgetPer);
    setIsUrgent(p.isUrgent);
    setIsPublic(p.isPublic);
    setQuoteDeadline(p.quoteDeadline);
    setMinHostRating(p.minHostRating);
    setImageUrl(p.imageUrl);
    setRequirementKeys(p.requirementKeys ?? []);
    setDirty(true);
    toast.success("Draft restored");
  }, []);

  const draftTarget = useMemo(
    () => ({
      entityType: "looking_for_request" as const,
      entityId: postId ?? null,
      scopeId: null,
    }),
    [postId],
  );

  const draft = useAutosaveDraft({
    userId,
    target: draftTarget,
    value: draftValue,
    onRestore: applyDraft,
    serverDraft,
  });

  function touch() {
    if (!dirty) setDirty(true);
  }

  // ---- Derived labels ----
  const trimmedTitle = title.trim();
  const displayTitle = trimmedTitle || "New request";
  const guestCount =
    (Number(adults) || 0) + (Number(children) || 0) + (Number(infants) || 0);
  const flexDays = Number(dateFlexibilityDays) || 0;
  const flexSuffix = checkIn && flexDays > 0 ? ` · ${flexLabel(flexDays)}` : "";
  const datesLabel =
    checkIn && checkOut
      ? `${fmtShort(checkIn)} → ${fmtShort(checkOut)}${flexSuffix}`
      : checkIn
        ? `From ${fmtShort(checkIn)}${flexSuffix}`
        : "Flexible dates";
  const whereLabel = destinationFlexible
    ? "Flexible destination"
    : locationText || region || "Anywhere";
  const childCount = Number(children) || 0;

  // Nights between the selected dates (0 when open-ended) — drives the live
  // budget breakdown below. Both dates required for a concrete count.
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const from = new Date(`${checkIn}T00:00:00`);
    const to = new Date(`${checkOut}T00:00:00`);
    const diff = Math.round((to.getTime() - from.getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  }, [checkIn, checkOut]);

  // Client-side "≈ R X/night · R Y total" from the chosen budget + nights.
  // Pure display — budget_min/budget_max/budget_per stay the stored truth.
  const derivedBudget = useMemo(() => {
    const amount = Number(budgetMax) || Number(budgetMin) || 0;
    if (amount <= 0) return null;
    const heads = guestCount || 1;
    let perNight: number | null = null;
    let total: number | null = null;
    if (budgetPer === "night") {
      perNight = amount;
      total = nights > 0 ? amount * nights : null;
    } else if (budgetPer === "total") {
      total = amount;
      perNight = nights > 0 ? amount / nights : null;
    } else {
      // per person → treat as a per-guest total for the whole stay
      total = amount * heads;
      perNight = nights > 0 ? total / nights : null;
    }
    return { perNight, total };
  }, [budgetMax, budgetMin, budgetPer, nights, guestCount]);
  const requirementLabels = requirementGroups
    .flatMap((g) => g.options)
    .filter((o) => requirementKeys.includes(o.slug))
    .map((o) => o.label);
  const budgetLabel =
    budgetMin || budgetMax
      ? `${budgetMin ? `R${budgetMin}` : "R0"}${
          budgetMax ? ` – R${budgetMax}` : "+"
        } / ${budgetPer}`
      : "Flexible budget";

  // ---- Readiness checklist ----
  const checklist = useMemo(() => {
    const items = [
      { label: "Title (5+ characters)", done: trimmedTitle.length >= 5 },
      { label: "Travel dates set", done: Boolean(checkIn && checkOut) },
      { label: "At least 1 adult", done: (Number(adults) || 0) >= 1 },
      {
        label: "Location or region",
        done: destinationFlexible || Boolean(locationText || region),
      },
      { label: "Budget set", done: Boolean(budgetMin || budgetMax) },
    ];
    const done = items.filter((i) => i.done).length;
    return {
      items,
      done,
      pct: Math.round((done / items.length) * 100),
      // "Ready" only needs the schema minimum (title + an adult); the rest lifts
      // the ring but never blocks posting.
      ready: trimmedTitle.length >= 5 && (Number(adults) || 0) >= 1,
      allDone: done === items.length,
    };
  }, [
    trimmedTitle,
    checkIn,
    checkOut,
    adults,
    locationText,
    region,
    destinationFlexible,
    budgetMin,
    budgetMax,
  ]);

  function sectionDone(key: SectionKey): boolean {
    switch (key) {
      case "basics":
        return trimmedTitle.length >= 5;
      case "dates":
        return (Number(adults) || 0) >= 1;
      case "location":
        return destinationFlexible || Boolean(locationText || region);
      case "requirements":
        return true; // optional
      case "photo":
        return true; // everything here is optional
      case "review":
        return checklist.ready;
    }
  }

  function railSub(key: SectionKey): string {
    switch (key) {
      case "basics":
        return trimmedTitle || "What are you looking for?";
      case "dates":
        return `${datesLabel} · ${guestCount} guest${guestCount === 1 ? "" : "s"}`;
      case "location":
        return `${whereLabel} · ${budgetLabel}`;
      case "requirements":
        return requirementKeys.length > 0
          ? `${requirementKeys.length} selected`
          : "Optional";
      case "photo":
        return imageUrl ? "Photo added" : isPublic ? "Public" : "Private";
      case "review":
        return checklist.ready ? "Ready to post" : "Add a title first";
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image is too large — please keep it under 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setImageError("Only image files are allowed.");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadRequestImageAction(fd);
    setUploading(false);
    if (res.success) {
      setImageUrl(res.url);
      touch();
    } else {
      setImageError(res.error);
    }
  }

  function handleTemplateSelect(template: RequestTemplate) {
    setSelectedTemplate(template.id);
    const d = template.defaults;
    if (d.category) setCategory(d.category);
    if (d.title) setTitle(d.title);
    if (d.description) setDescription(d.description);
    if (d.adults !== undefined) setAdults(String(d.adults));
    if (d.children !== undefined) setChildren(String(d.children));
    if (d.infants !== undefined) setInfants(String(d.infants));
    if (d.is_urgent !== undefined) setIsUrgent(d.is_urgent);
    touch();
  }

  // Map drop / search pick → set the pin + prefill the text location and region.
  function handleLocationSelect(s: LocationSelection) {
    setLocationLat(String(s.latitude));
    setLocationLng(String(s.longitude));
    // Fill the human-readable location if the user hasn't typed their own.
    const parts = [
      s.address_line1 || s.city,
      s.municipality,
      s.province,
    ].filter((x): x is string => Boolean(x));
    const label = parts.slice(0, 2).join(", ");
    if (label && !locationText.trim()) setLocationText(label);
    // Snap the region dropdown to the matched province when we have one.
    if (s.province && REGIONS.includes(s.province)) setRegion(s.province);
    // Default a sensible radius the first time a pin is dropped.
    if (!searchRadiusKm) setSearchRadiusKm("25");
    touch();
  }

  function buildPayload() {
    const numOrUndef = (s: string) => (s.trim() === "" ? undefined : Number(s));
    // Ages for the children currently counted; drop blanks so we never store 0
    // for an un-answered slot.
    const ages =
      childCount > 0
        ? childAges
            .slice(0, childCount)
            .map((a) => a.trim())
            .filter((a) => a !== "")
            .map(Number)
        : [];
    return {
      title: trimmedTitle,
      description: description.trim() || undefined,
      category,
      check_in_date: checkIn || undefined,
      check_out_date: checkOut || undefined,
      date_flexibility_days: checkIn ? flexDays : 0,
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      infants: Number(infants) || 0,
      child_ages: ages.length > 0 ? ages : undefined,
      pets: numOrUndef(pets),
      location_text: locationText.trim() || undefined,
      location_region: region || undefined,
      destination_flexible: destinationFlexible,
      location_lat: numOrUndef(locationLat),
      location_lng: numOrUndef(locationLng),
      search_radius_km: numOrUndef(searchRadiusKm),
      budget_min: numOrUndef(budgetMin),
      budget_max: numOrUndef(budgetMax),
      budget_per: budgetPer,
      is_urgent: isUrgent,
      is_public: isPublic,
      quote_deadline: quoteDeadline || undefined,
      min_host_rating: minHostRating ? Number(minHostRating) : undefined,
      image_url: imageUrl || undefined,
      requirement_keys: requirementKeys,
    };
  }

  function handleSave() {
    if (trimmedTitle.length < 5) {
      toast.error("Add a title of at least 5 characters.");
      setSection("basics");
      return;
    }
    if ((Number(adults) || 0) < 1) {
      toast.error("Your request needs at least 1 adult.");
      setSection("dates");
      return;
    }
    if (checkIn && checkOut && checkOut < checkIn) {
      toast.error("Check-out can't be before check-in.");
      setSection("dates");
      return;
    }
    if (checkIn && quoteDeadline && quoteDeadline > checkIn) {
      toast.error(
        "The quote deadline must be on or before your check-in date.",
      );
      setSection("photo");
      return;
    }
    startSave(async () => {
      const payload = buildPayload();
      try {
        const res =
          mode === "create"
            ? await createRequestAction({ ...payload, guest_id: userId })
            : await updateRequestAction(postId as string, payload);
        if (!res?.success) {
          toast.error(res?.error ?? "Something went wrong.");
          return;
        }
        draft.clearSaved();
        setDirty(false);
        toast.success(mode === "create" ? "Request posted" : "Request saved");
        const newId =
          mode === "create" && "data" in res
            ? (res as { data?: { id?: string } }).data?.id
            : postId;
        router.push(
          newId ? `/portal/looking-for/${newId}` : "/portal/looking-for",
        );
        router.refresh();
      } catch {
        toast.error("An unexpected error occurred.");
      }
    });
  }

  const panelMeta = PANEL_META[section];

  return (
    <div className="space-y-5">
      {draft.hasDraft ? (
        <ResumeDraftBanner
          savedAt={draft.savedAt}
          onRestore={draft.restore}
          onDiscard={draft.discard}
          label="request changes"
        />
      ) : null}

      {/* ============ IDENTITY BAR ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[11px] border border-brand-line bg-brand-light text-brand-secondary">
          <Search className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/portal/looking-for" className="hover:text-brand-ink">
              Looking For
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">
              {mode === "create" ? "New request" : "Editing"}
            </span>
          </nav>
          <h1 className="mt-0.5 truncate font-display text-[19px] font-extrabold leading-none tracking-wide text-brand-ink">
            {displayTitle}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <span
            className={`mr-1 hidden items-center gap-1.5 text-[12px] md:inline-flex ${
              dirty ? "text-status-pending" : "text-brand-mute"
            }`}
          >
            {draft.status === "saving" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                Saving draft…
              </>
            ) : dirty ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                Unsaved changes
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-brand-primary" /> Saved
              </>
            )}
          </span>
          <Link
            href="/portal/looking-for"
            className="inline-flex items-center rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            Cancel
          </Link>
          {/* Review has its own primary CTA, so the identity bar shows the
              Post/Save button on every step EXCEPT the last — never two. */}
          {section !== "review" ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={savePending || uploading}
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {savePending
                ? "Saving…"
                : mode === "create"
                  ? "Post request"
                  : "Save request"}
            </button>
          ) : null}
        </div>
      </div>

      {/* ============ SPLIT: rail + panel ============ */}
      <div className="grid gap-6 lg:grid-cols-[288px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 shadow-card">
            <ProgressRing pct={checklist.pct} />
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                {checklist.ready ? "Ready to post" : "Almost ready"}
              </div>
              <div className="text-[11px] text-brand-mute">
                {checklist.ready
                  ? "The more detail, the better the quotes"
                  : "Finish the steps below"}
              </div>
            </div>
          </div>

          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Steps
          </div>
          <div className="space-y-1">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const active = section === key;
              const done = sectionDone(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSection(key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-brand-line bg-white shadow-card"
                      : "border-transparent hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${
                      active
                        ? "bg-brand-primary text-white"
                        : "bg-brand-accent/70 text-brand-secondary"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13.5px] font-semibold leading-tight ${
                        active ? "text-brand-ink" : "text-brand-ink/80"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-brand-mute">
                      {railSub(key)}
                    </span>
                  </span>
                  {done ? (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ============ PANEL ============ */}
        <div className="min-w-0">
          <div className="mb-4">
            <h2 className="font-display text-[17px] font-bold text-brand-ink">
              {panelMeta.title}
            </h2>
            <p className="mt-0.5 text-[13px] text-brand-mute">
              {panelMeta.desc}
            </p>
          </div>

          {/* ----- BASICS ----- */}
          {section === "basics" ? (
            <div className="space-y-4">
              {mode === "create" ? (
                <TemplateSelector
                  onSelect={handleTemplateSelect}
                  selectedId={selectedTemplate}
                />
              ) : null}
              <div className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
                <div className="space-y-2">
                  <Label htmlFor="title">What are you looking for?</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Weekend getaway for a family of 4 in Franschhoek"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      touch();
                    }}
                  />
                  {trimmedTitle.length > 0 && trimmedTitle.length < 5 ? (
                    <p className="text-xs text-red-600">
                      A little longer — 5 characters or more.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Details (optional)</Label>
                  <RichTextEditor
                    value={description}
                    onChange={(html) => {
                      setDescription(html);
                      touch();
                    }}
                    placeholder="Add headings, bullet points and detail — what you need, must-haves, the occasion…"
                  />
                </div>
                <div className="space-y-2 sm:max-w-xs">
                  <Label>Category</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => {
                      setCategory(v as RequestEditValues["category"]);
                      touch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accommodation">
                        Accommodation
                      </SelectItem>
                      <SelectItem value="experience">Experience</SelectItem>
                      <SelectItem value="venue">Venue</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- DATES & GUESTS ----- */}
          {section === "dates" ? (
            <div className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="check_in">Check-in date</Label>
                  <DatePicker
                    id="check_in"
                    value={checkIn}
                    onChange={(iso) => {
                      setCheckIn(iso);
                      touch();
                    }}
                    clearable
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="check_out">Check-out date</Label>
                  <DatePicker
                    id="check_out"
                    value={checkOut}
                    min={checkIn || undefined}
                    onChange={(iso) => {
                      setCheckOut(iso);
                      touch();
                    }}
                    clearable
                  />
                </div>
              </div>
              {checkIn ? (
                <div className="space-y-2 sm:max-w-xs">
                  <Label>How flexible are your dates?</Label>
                  <Select
                    value={dateFlexibilityDays}
                    onValueChange={(v) => {
                      setDateFlexibilityDays(v);
                      touch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Exact dates</SelectItem>
                      <SelectItem value="1">± 1 day</SelectItem>
                      <SelectItem value="2">± 2 days</SelectItem>
                      <SelectItem value="3">± 3 days</SelectItem>
                      <SelectItem value="7">± 1 week</SelectItem>
                      <SelectItem value="14">± 2 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-brand-mute">
                    Let hosts know if your trip can shift a little — more
                    flexibility means more quotes.
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-4">
                <NumberField
                  id="adults"
                  label="Adults"
                  min={1}
                  max={50}
                  value={adults}
                  onChange={(v) => {
                    setAdults(v);
                    touch();
                  }}
                />
                <NumberField
                  id="children"
                  label="Children (2–12)"
                  min={0}
                  max={20}
                  value={children}
                  onChange={(v) => {
                    setChildren(v);
                    touch();
                  }}
                />
                <NumberField
                  id="infants"
                  label="Infants (0–2)"
                  min={0}
                  max={10}
                  value={infants}
                  onChange={(v) => {
                    setInfants(v);
                    touch();
                  }}
                />
              </div>

              {/* Ages for each child — helps hosts size beds and price. */}
              {childCount > 0 ? (
                <div className="space-y-2 border-t border-brand-line pt-4">
                  <Label>Ages of children</Label>
                  <div className="flex flex-wrap gap-3">
                    {Array.from({ length: childCount }).map((_, i) => (
                      <div key={i} className="w-20 space-y-1">
                        <Label
                          htmlFor={`child_age_${i}`}
                          className="text-[11px] text-brand-mute"
                        >
                          Child {i + 1}
                        </Label>
                        <Input
                          id={`child_age_${i}`}
                          type="number"
                          min={0}
                          max={17}
                          placeholder="Age"
                          value={childAges[i] ?? ""}
                          onChange={(e) => {
                            const next = [...childAges];
                            // Pad so index i is writable even on a sparse array.
                            while (next.length < childCount) next.push("");
                            next[i] = e.target.value;
                            setChildAges(next);
                            touch();
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="border-t border-brand-line pt-4 sm:max-w-xs">
                <NumberField
                  id="pets"
                  label="Travelling with pets?"
                  min={0}
                  max={20}
                  placeholder="Number of pets"
                  value={pets}
                  onChange={(v) => {
                    setPets(v);
                    touch();
                  }}
                />
                <p className="mt-1.5 text-xs text-brand-mute">
                  Let hosts know so they can confirm they&apos;re pet-friendly.
                </p>
              </div>
            </div>
          ) : null}

          {/* ----- LOCATION & BUDGET ----- */}
          {section === "location" ? (
            <div className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
              {/* Not-sure-where toggle — relaxes the location requirement so the
                  request can post without a pinned destination. */}
              <ToggleRow
                icon={<MapPin className="h-4 w-4" />}
                title="I'm not sure where yet"
                desc="Open to suggestions — hosts anywhere can quote you"
                checked={destinationFlexible}
                onChange={(v) => {
                  setDestinationFlexible(v);
                  touch();
                }}
              />

              {/* Map pin + search — drop a pin where you want to be. */}
              <div className="space-y-2 border-t border-brand-line pt-4">
                <Label>Where do you want to be?</Label>
                <LocationPicker
                  latitude={locationLat ? Number(locationLat) : null}
                  longitude={locationLng ? Number(locationLng) : null}
                  radiusKm={searchRadiusKm ? Number(searchRadiusKm) : null}
                  onSelect={handleLocationSelect}
                />
              </div>

              {/* Radius around the pin (only meaningful once a pin is set). */}
              <div className="grid gap-4 border-t border-brand-line pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Search radius</Label>
                  <Select
                    value={searchRadiusKm || "none"}
                    onValueChange={(v) => {
                      setSearchRadiusKm(v === "none" ? "" : v);
                      touch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No radius" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No radius</SelectItem>
                      {RADIUS_OPTIONS.map((km) => (
                        <SelectItem key={km} value={String(km)}>
                          Within {km} km
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-brand-mute">
                    Hosts within this distance of your pin are the best match.
                  </p>
                </div>
                {locationLat && locationLng ? (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setLocationLat("");
                        setLocationLng("");
                        setSearchRadiusKm("");
                        touch();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-2 text-[13px] font-medium text-brand-mute transition hover:text-brand-ink"
                    >
                      <X className="h-3.5 w-3.5" /> Clear pin
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 border-t border-brand-line pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select
                    value={region || "any"}
                    onValueChange={(v) => {
                      setRegion(v === "any" ? "" : v);
                      touch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any region</SelectItem>
                      {REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location_text">
                    Specific location (optional)
                  </Label>
                  <Input
                    id="location_text"
                    placeholder="e.g. Near Table Mountain, Camps Bay"
                    value={locationText}
                    onChange={(e) => {
                      setLocationText(e.target.value);
                      touch();
                    }}
                  />
                </div>
              </div>
              <div className="space-y-4 border-t border-brand-line pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Budget range</Label>
                  <span className="text-[13px] font-semibold text-brand-ink">
                    {budgetLabel}
                  </span>
                </div>
                <BudgetRangeSlider
                  min={budgetMin}
                  max={budgetMax}
                  onChange={(lo, hi) => {
                    setBudgetMin(lo);
                    setBudgetMax(hi);
                    touch();
                  }}
                />
                <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                  <div className="space-y-2 sm:max-w-[12rem]">
                    <Label>Per</Label>
                    <Select
                      value={budgetPer}
                      onValueChange={(v) => {
                        setBudgetPer(v as RequestEditValues["budgetPer"]);
                        touch();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="night">Per night</SelectItem>
                        <SelectItem value="total">Total</SelectItem>
                        <SelectItem value="person">Per person</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {derivedBudget ? (
                    <p className="text-[13px] text-brand-mute">
                      ≈{" "}
                      {derivedBudget.perNight != null ? (
                        <span className="font-semibold text-brand-ink">
                          {rZar(derivedBudget.perNight)}/night
                        </span>
                      ) : null}
                      {derivedBudget.perNight != null &&
                      derivedBudget.total != null
                        ? " · "
                        : ""}
                      {derivedBudget.total != null ? (
                        <span className="font-semibold text-brand-ink">
                          {rZar(derivedBudget.total)} total
                        </span>
                      ) : null}
                      {nights > 0 ? (
                        <span className="text-brand-mute">
                          {" "}
                          over {nights} night{nights === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- REQUIREMENTS ----- */}
          {section === "requirements" ? (
            <div className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
              <RequirementsPicker
                groups={requirementGroups}
                value={requirementKeys}
                onChange={(keys) => {
                  setRequirementKeys(keys);
                  touch();
                }}
              />
            </div>
          ) : null}

          {/* ----- PHOTO & PREFERENCES ----- */}
          {section === "photo" ? (
            <div className="space-y-4">
              <div className="space-y-3 rounded-card border border-brand-line bg-white p-5 shadow-card">
                <div>
                  <h3 className="font-medium text-brand-ink">
                    Photo (optional)
                  </h3>
                  <p className="mt-0.5 text-sm text-brand-mute">
                    One image to bring your request to life — a place or a vibe.
                    Max 5MB.
                  </p>
                </div>
                {imageUrl ? (
                  <div className="relative w-full max-w-sm overflow-hidden rounded-card border border-brand-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Request"
                      className="aspect-video w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl("");
                        setImageError(null);
                        touch();
                      }}
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-brand-line bg-brand-light/50 px-6 py-8 text-center transition-colors hover:border-brand-primary ${
                      uploading ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
                    ) : (
                      <ImagePlus className="h-6 w-6 text-brand-mute" />
                    )}
                    <span className="text-sm font-medium text-brand-ink">
                      {uploading ? "Uploading…" : "Upload an image"}
                    </span>
                    <span className="text-xs text-brand-mute">
                      JPG, PNG, WEBP or GIF · up to 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageChange}
                      disabled={uploading}
                    />
                  </label>
                )}
                {imageError ? (
                  <p className="text-sm text-red-600">{imageError}</p>
                ) : null}
              </div>

              <div className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
                <ToggleRow
                  icon={<Zap className="h-4 w-4" />}
                  title="Urgent request"
                  desc="Get prioritized in host notifications"
                  checked={isUrgent}
                  onChange={(v) => {
                    setIsUrgent(v);
                    touch();
                  }}
                />
                <ToggleRow
                  title="Public request"
                  desc="Visible to all hosts in the directory"
                  checked={isPublic}
                  onChange={(v) => {
                    setIsPublic(v);
                    touch();
                  }}
                />
                <div className="grid gap-4 border-t border-brand-line pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quote_deadline">
                      Quote deadline (optional)
                    </Label>
                    <DatePicker
                      id="quote_deadline"
                      value={quoteDeadline}
                      max={checkIn || undefined}
                      onChange={(iso) => {
                        setQuoteDeadline(iso);
                        touch();
                      }}
                      clearable
                    />
                    <p className="text-xs text-brand-mute">
                      {checkIn
                        ? `Stop accepting quotes after this date (on or before your check-in, ${fmtShort(checkIn)}).`
                        : "Stop accepting quotes after this date."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum host rating (optional)</Label>
                    <Select
                      value={minHostRating || "any"}
                      onValueChange={(v) => {
                        setMinHostRating(v === "any" ? "" : v);
                        touch();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any rating</SelectItem>
                        <SelectItem value="3">3+ stars</SelectItem>
                        <SelectItem value="3.5">3.5+ stars</SelectItem>
                        <SelectItem value="4">4+ stars</SelectItem>
                        <SelectItem value="4.5">4.5+ stars</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-brand-mute">
                      Only show to highly-rated hosts
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- REVIEW ----- */}
          {section === "review" ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <div className="flex items-center gap-3 border-b border-brand-line px-5 py-4">
                  <ProgressRing pct={checklist.pct} />
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-bold text-brand-ink">
                      {checklist.ready ? "Ready to post" : "Almost ready"}
                    </div>
                    <div className="text-[12px] text-brand-mute">
                      {checklist.ready
                        ? "Hosts will start sending you quotes."
                        : "Add a title (5+ characters) to post."}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 p-5 sm:grid-cols-2">
                  {checklist.items.map((it) => (
                    <div
                      key={it.label}
                      className="flex items-center gap-2 text-[12.5px]"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          it.done
                            ? "bg-brand-primary text-white"
                            : "bg-brand-light text-brand-mute"
                        }`}
                      >
                        {it.done ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-mute" />
                        )}
                      </span>
                      <span
                        className={
                          it.done ? "text-brand-ink" : "text-brand-mute"
                        }
                      >
                        {it.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <SummaryRow
                  label="Title"
                  value={trimmedTitle || "Not set"}
                  muted={!trimmedTitle}
                  onEdit={() => setSection("basics")}
                />
                <SummaryRow
                  label="Category"
                  value={category.charAt(0).toUpperCase() + category.slice(1)}
                  onEdit={() => setSection("basics")}
                />
                <SummaryRow
                  label="When"
                  value={datesLabel}
                  muted={!checkIn}
                  onEdit={() => setSection("dates")}
                />
                <SummaryRow
                  label="Guests"
                  value={`${guestCount} guest${guestCount === 1 ? "" : "s"}`}
                  onEdit={() => setSection("dates")}
                />
                <SummaryRow
                  label="Where"
                  value={whereLabel}
                  muted={whereLabel === "Anywhere"}
                  onEdit={() => setSection("location")}
                />
                <SummaryRow
                  label="Budget"
                  value={budgetLabel}
                  muted={budgetLabel === "Flexible budget"}
                  onEdit={() => setSection("location")}
                />
                <SummaryRow
                  label="Requirements"
                  value={
                    requirementLabels.length > 0
                      ? requirementLabels.join(" · ")
                      : "None set"
                  }
                  muted={requirementLabels.length === 0}
                  onEdit={() => setSection("requirements")}
                />
                <SummaryRow
                  label="Visibility"
                  value={`${isPublic ? "Public" : "Private"}${
                    isUrgent ? " · Urgent" : ""
                  }`}
                  onEdit={() => setSection("photo")}
                  last
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {mode === "create"
                      ? "Post this request"
                      : "Save your changes"}
                  </div>
                  <div className="text-[12px] text-brand-mute">
                    <span className="inline-flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5" />
                      Hosts quote you directly — no obligation.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={savePending || uploading}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {savePending
                    ? "Saving…"
                    : mode === "create"
                      ? "Post request"
                      : "Save request"}
                </button>
              </div>
            </div>
          ) : null}

          {/* ----- STEP NAV (content steps only) ----- */}
          {section !== "review" ? (
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setSection(SECTIONS[Math.max(0, sectionIdx - 1)].key)
                }
                disabled={sectionIdx === 0}
                className="inline-flex items-center rounded-pill border border-brand-line bg-white px-4 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() =>
                  setSection(
                    SECTIONS[Math.min(SECTIONS.length - 1, sectionIdx + 1)].key,
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-[13px] font-medium text-brand-ink transition hover:border-brand-primary/40 hover:bg-brand-light"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function fmtShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function flexLabel(days: number): string {
  if (days <= 0) return "Exact dates";
  if (days === 7) return "± 1 week";
  if (days === 14) return "± 2 weeks";
  return `± ${days} day${days === 1 ? "" : "s"}`;
}

// Whole-rand display for the live budget breakdown (no cents in the wizard).
function rZar(n: number): string {
  return `R${Math.round(n).toLocaleString("en-ZA")}`;
}

const BUDGET_SLIDER_MAX = 50000;
const BUDGET_SLIDER_STEP = 250;

// Dual-thumb budget range (no slider primitive in components/ui yet — two
// overlaid range inputs, the standard pattern). Empty max === "no limit".
function BudgetRangeSlider({
  min,
  max,
  onChange,
}: {
  min: string;
  max: string;
  onChange: (lo: string, hi: string) => void;
}) {
  const lo = Math.min(Math.max(Number(min) || 0, 0), BUDGET_SLIDER_MAX);
  const hi =
    max.trim() === ""
      ? BUDGET_SLIDER_MAX
      : Math.min(Math.max(Number(max) || 0, 0), BUDGET_SLIDER_MAX);
  const loPct = (lo / BUDGET_SLIDER_MAX) * 100;
  const hiPct = (hi / BUDGET_SLIDER_MAX) * 100;
  const thumb =
    "pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent focus:outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand-primary [&::-moz-range-thumb]:bg-white";
  return (
    <div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-light" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-primary"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={BUDGET_SLIDER_MAX}
          step={BUDGET_SLIDER_STEP}
          value={lo}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi);
            onChange(v <= 0 ? "" : String(v), max);
          }}
          className={thumb}
          aria-label="Budget minimum"
        />
        <input
          type="range"
          min={0}
          max={BUDGET_SLIDER_MAX}
          step={BUDGET_SLIDER_STEP}
          value={hi}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo);
            onChange(min, v >= BUDGET_SLIDER_MAX ? "" : String(v));
          }}
          className={thumb}
          aria-label="Budget maximum"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px] text-brand-mute">
        <span>{rZar(lo)}</span>
        <span>
          {max.trim() === "" ? `${rZar(BUDGET_SLIDER_MAX)}+` : rZar(hi)}
        </span>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            {icon}
          </div>
        ) : null}
        <div>
          <p className="font-medium text-brand-ink">{title}</p>
          <p className="text-sm text-brand-mute">{desc}</p>
        </div>
      </div>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  last,
  onEdit,
}: {
  label: string;
  value: string;
  muted?: boolean;
  last?: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 ${
        last ? "" : "border-b border-[#EEF4F0]"
      }`}
    >
      <div className="w-24 shrink-0 text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </div>
      <div
        className={`min-w-0 flex-1 truncate text-[13px] ${
          muted ? "italic text-brand-mute" : "font-medium text-brand-ink"
        }`}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-mute transition hover:border-brand-primary/40 hover:text-brand-ink"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#E4EFE8"
          strokeWidth="3.4"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#10B981"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[11.5px] font-bold tabular-nums text-brand-ink">
        {pct}%
      </div>
    </div>
  );
}
