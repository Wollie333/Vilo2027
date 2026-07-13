"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Home,
  Image as ImageIcon,
  MapPin,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CategoryPicker,
  type CategoryPickerLeaf,
} from "@/lib/taxonomy/CategoryPicker";

import { createListingAction } from "./actions";
import { newListingSchema, type NewListingInput } from "./schemas";

// The listing-editor journey previewed as a roadmap. Only "Basics" is active
// here; the rest open in the editor once the draft exists.
const JOURNEY: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "basics", label: "Basics", icon: Home },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "location", label: "Location", icon: MapPin },
  { key: "pricing", label: "Rooms & pricing", icon: Receipt },
  { key: "policies", label: "Policies", icon: CalendarClock },
  { key: "review", label: "Review & publish", icon: ClipboardCheck },
];

export function NewListingForm({
  categoryLeaves,
}: {
  categoryLeaves: CategoryPickerLeaf[];
}) {
  const [pending, start] = useTransition();
  const form = useForm<NewListingInput>({
    resolver: zodResolver(newListingSchema),
    defaultValues: {
      name: "",
      property_type: "accommodation",
      category_id: undefined,
      accommodation_type: undefined,
    },
  });

  const selectedCategoryId = form.watch("category_id") ?? null;
  const nameValue = form.watch("name") ?? "";

  // Live "essentials" for the health ring — the two things this first step
  // captures before the draft is created.
  const nameDone = nameValue.trim().length > 0;
  const categoryDone = !!selectedCategoryId;
  const done = (nameDone ? 1 : 0) + (categoryDone ? 1 : 0);
  const pct = Math.round((done / 2) * 100);
  const selectedCategory =
    categoryLeaves.find((l) => l.id === selectedCategoryId) ?? null;

  function onSubmit(values: NewListingInput) {
    const leaf = categoryLeaves.find((l) => l.id === values.category_id);
    start(async () => {
      const result = await createListingAction({
        ...values,
        accommodation_type: leaf?.slug ?? undefined,
      });
      if (result && !result.ok) {
        toast.error(result.error);
      }
      // Success path is a server-side redirect; nothing to do here.
    });
  }

  return (
    <div className="space-y-5">
      {/* ============ IDENTITY BAR ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
          <Home className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/dashboard/properties" className="hover:text-brand-ink">
              Listings
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">New</span>
          </nav>
          <div className="mt-0.5 flex items-center gap-2.5">
            <h1 className="truncate font-display text-[19px] font-extrabold leading-none text-brand-ink">
              {nameValue.trim() || "New listing"}
            </h1>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-mute" />
              Draft
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard/properties"
            className="inline-flex items-center rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* ============ SPLIT: journey rail + panel ============ */}
      <div className="grid gap-6 lg:grid-cols-[262px_1fr]">
        {/* journey roadmap */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 shadow-card">
            <ProgressRing pct={pct} />
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                Let&rsquo;s start
              </div>
              <div className="text-[11px] text-brand-mute">
                {done}/2 basics done · then the editor
              </div>
            </div>
          </div>
          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Setup
          </div>
          <div className="space-y-1">
            {JOURNEY.map(({ key, label, icon: Icon }, i) => {
              const isActive = key === "basics";
              return (
                <div
                  key={key}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left ${
                    isActive
                      ? "border-brand-line bg-white shadow-card"
                      : "border-transparent"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                      isActive
                        ? "bg-brand-primary text-white"
                        : "bg-brand-light text-brand-mute"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13.5px] font-semibold leading-tight ${
                        isActive ? "text-brand-ink" : "text-brand-ink/50"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-brand-mute">
                      {isActive ? "Name & category" : "In the editor next"}
                    </span>
                  </span>
                  <span
                    className={`num shrink-0 text-[11px] font-bold ${
                      isActive ? "text-brand-primary" : "text-brand-line"
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ============ ACTIVE PANEL ============ */}
        <div className="min-w-0">
          <div className="mb-5 flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
              <Home className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-extrabold leading-tight text-brand-ink">
                Listing basics
              </h2>
              <p className="mt-0.5 text-[13.5px] text-brand-mute">
                Just a name and category to create the draft — you&rsquo;ll add
                photos, pricing and policies in the editor next.
              </p>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
            >
              <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card sm:p-6">
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Listing name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Karoo Stargazer Cottage"
                            disabled={pending}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category_id"
                    render={() => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <CategoryPicker
                          leaves={categoryLeaves}
                          value={selectedCategoryId}
                          onChange={(leaf) => {
                            form.setValue("category_id", leaf.id, {
                              shouldValidate: true,
                            });
                          }}
                          disabled={pending}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* single primary CTA on this step */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-5 py-4">
                <div className="min-w-0 text-[12.5px] text-brand-mute">
                  {done === 2 ? (
                    <span className="font-semibold text-brand-ink">
                      {nameValue.trim()} · {selectedCategory?.label}
                    </span>
                  ) : (
                    "Add a name and pick a category to continue."
                  )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={pending}
                  className="gap-1.5"
                >
                  {pending ? "Creating…" : "Create draft & continue"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
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
