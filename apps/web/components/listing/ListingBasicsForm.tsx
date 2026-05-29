"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Field, TextInput } from "@/app/dashboard/setup/_atoms";
import { saveListingPatchAction } from "@/app/dashboard/listings/[id]/edit/actions";
import {
  basicSchema,
  type BasicInput,
} from "@/app/dashboard/listings/[id]/edit/schemas";
import {
  CategoryPicker,
  type CategoryPickerLeaf,
} from "@/lib/taxonomy/CategoryPicker";
import { useTransition } from "react";

type BasicsListing = {
  id: string;
  listing_type: "accommodation" | "experience";
  name: string;
  category_id: string | null;
  accommodation_type: string | null;
  experience_type: string | null;
  description: string;
};

// Single source of truth for a listing's basic info (name · category · about).
// Rendered by the listing editor BasicTab AND the setup "Listing" card.
// The category picker only shows when `categoryLeaves` is supplied — the setup
// card omits it (kind/category is chosen at creation), the editor includes it.
export function ListingBasicsForm({
  listing,
  categoryLeaves,
  submitLabel = "Save basic info",
  onSaved,
}: {
  listing: BasicsListing;
  categoryLeaves?: CategoryPickerLeaf[];
  submitLabel?: string;
  onSaved?: (patch: {
    name: string;
    category_id: string | null;
    description: string;
  }) => void;
}) {
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BasicInput>({
    resolver: zodResolver(basicSchema),
    defaultValues: {
      name: listing.name,
      category_id: listing.category_id ?? null,
      accommodation_type: listing.accommodation_type,
      experience_type: listing.experience_type,
      description: listing.description ?? "",
    },
  });

  const categoryId = watch("category_id") ?? null;
  const description = watch("description") ?? "";

  function onSubmit(values: BasicInput) {
    const leaf = categoryLeaves?.find((l) => l.id === values.category_id);
    start(async () => {
      const patch = {
        name: values.name,
        category_id: values.category_id ?? null,
        // Mirror the chosen leaf slug into the legacy text column so older read
        // paths keep working. Only touched when a category picker is shown.
        ...(categoryLeaves
          ? {
              accommodation_type:
                listing.listing_type === "accommodation"
                  ? (leaf?.slug ?? null)
                  : null,
              experience_type:
                listing.listing_type === "experience"
                  ? (leaf?.slug ?? null)
                  : null,
            }
          : {}),
        description:
          values.description && values.description.length > 0
            ? values.description
            : null,
      };
      const result = await saveListingPatchAction(listing.id, patch);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Basic info saved.");
      onSaved?.({
        name: values.name,
        category_id: values.category_id ?? null,
        description: values.description ?? "",
      });
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Listing name" required error={errors.name?.message}>
        <TextInput
          placeholder="Karoo Stone & Skies Cottage"
          {...register("name")}
        />
      </Field>

      {categoryLeaves ? (
        <Field
          label={
            listing.listing_type === "accommodation"
              ? "Accommodation type"
              : "Experience type"
          }
          error={errors.category_id?.message}
        >
          <CategoryPicker
            leaves={categoryLeaves}
            value={categoryId}
            onChange={(leaf) =>
              setValue("category_id", leaf.id, { shouldDirty: true })
            }
          />
        </Field>
      ) : null}

      <Field
        label="About this place"
        hint="Use headings and bold for the space, the area, and what makes it special."
      >
        <RichTextEditor
          value={description}
          onChange={(html) =>
            setValue("description", html, { shouldDirty: true })
          }
          disabled={pending}
          placeholder="Tell guests what makes this place special — mornings, the views, the why behind it."
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
