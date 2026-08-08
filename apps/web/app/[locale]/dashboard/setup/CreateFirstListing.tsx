"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Home as HomeIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { BusyOverlay } from "@/components/ui/BusyOverlay";
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

import { createSetupListingAction } from "./actions";
import {
  newListingSchema,
  type NewListingInput,
} from "../properties/new/schemas";

// The finish-setup wizard's opening step for a host who has NO listing yet
// (the leaner signup no longer seeds one). Captures just the name + category to
// create the draft, then refreshes — page.tsx re-runs, now finds the listing,
// and renders the full SetupWizard so the host continues seamlessly. No
// placeholder is ever created until the host saves what they typed here.
export function CreateFirstListing({
  displayName,
  categoryLeaves,
}: {
  displayName: string;
  categoryLeaves: CategoryPickerLeaf[];
}) {
  const router = useRouter();
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

  function onSubmit(values: NewListingInput) {
    const leaf = categoryLeaves.find((l) => l.id === values.category_id);
    start(async () => {
      const result = await createSetupListingAction({
        ...values,
        accommodation_type: leaf?.slug ?? undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Draft created — reload; page.tsx now finds the listing and renders the
      // full setup wizard on the first incomplete step.
      router.refresh();
    });
  }

  function onInvalid() {
    if (!form.getValues("name")?.trim()) {
      toast.error("Give your place a name (at least 3 characters).");
    } else if (!selectedCategoryId) {
      toast.error("Pick a category to continue.");
    } else {
      toast.error("Please check the form and try again.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Identity bar — matches the setup wizard shell. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
          <HomeIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/dashboard" className="hover:text-brand-ink">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">Finish setup</span>
          </nav>
          <div className="mt-0.5 flex items-center gap-2.5">
            <h1 className="truncate font-display text-[19px] font-extrabold leading-none text-brand-ink">
              Let&rsquo;s set up your place
            </h1>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-mute" />
              Draft
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-brand-mute" /> Exit
          </Link>
        </div>
      </div>

      {/* Opening panel — name + category. */}
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
            <HomeIcon className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-brand-ink">
                What are you listing{displayName ? `, ${displayName}` : ""}?
              </h2>
              <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-secondary">
                Step 1
              </span>
            </div>
            <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-brand-mute">
              Just a name and a type to get started — you&rsquo;ll add photos,
              rooms, pricing and policies in the next steps.
            </p>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            className="space-y-6"
            noValidate
          >
            <section className="overflow-hidden rounded-card border border-brand-line bg-white p-6 shadow-card md:p-7">
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

            <div className="flex items-center justify-end border-t border-brand-line pt-5">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create & continue"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </Form>
      </div>

      <BusyOverlay show={pending} label="Creating your listing…" />
    </div>
  );
}
