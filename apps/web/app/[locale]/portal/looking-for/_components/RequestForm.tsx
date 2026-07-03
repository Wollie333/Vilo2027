"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Loader2, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createRequestAction,
  updateRequestAction,
  uploadRequestImageAction,
} from "../actions";
import { TemplateSelector } from "./TemplateSelector";
import type { RequestTemplate } from "./request-templates";

const requestSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  category: z.enum(["accommodation", "experience", "venue", "event", "other"]),
  check_in_date: z.string().optional(),
  check_out_date: z.string().optional(),
  adults: z.number().min(1).max(50),
  children: z.number().min(0).max(20),
  infants: z.number().min(0).max(10),
  location_text: z.string().optional(),
  location_region: z.string().optional(),
  budget_min: z.number().optional(),
  budget_max: z.number().optional(),
  budget_per: z.enum(["night", "total", "person"]).optional(),
  is_urgent: z.boolean(),
  is_public: z.boolean(),
  quote_deadline: z.string().optional(),
  min_host_rating: z.number().min(1).max(5).optional(),
  image_url: z.string().optional(),
});

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestFormProps {
  mode: "create" | "edit";
  userId: string;
  initialData?: Partial<RequestFormData> & { id?: string };
}

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

export function RequestForm({ mode, userId, initialData }: RequestFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(
    undefined,
  );
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      title: initialData?.title ?? "",
      description: initialData?.description ?? "",
      category: initialData?.category ?? "accommodation",
      check_in_date: initialData?.check_in_date ?? "",
      check_out_date: initialData?.check_out_date ?? "",
      adults: initialData?.adults ?? 2,
      children: initialData?.children ?? 0,
      infants: initialData?.infants ?? 0,
      location_text: initialData?.location_text ?? "",
      location_region: initialData?.location_region ?? "",
      budget_min: initialData?.budget_min,
      budget_max: initialData?.budget_max,
      budget_per: initialData?.budget_per ?? "night",
      is_urgent: initialData?.is_urgent ?? false,
      is_public: initialData?.is_public ?? true,
      quote_deadline: initialData?.quote_deadline ?? "",
      min_host_rating: initialData?.min_host_rating,
      image_url: initialData?.image_url ?? "",
    },
  });

  const category = watch("category");
  const isUrgent = watch("is_urgent");
  const isPublic = watch("is_public");
  const imageUrl = watch("image_url");

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file fires onChange again.
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
      setValue("image_url", res.url);
    } else {
      setImageError(res.error);
    }
  }

  function handleTemplateSelect(template: RequestTemplate) {
    setSelectedTemplate(template.id);

    // Apply template defaults to form
    if (template.defaults.category) {
      setValue("category", template.defaults.category);
    }
    if (template.defaults.title) {
      setValue("title", template.defaults.title);
    }
    if (template.defaults.description) {
      setValue("description", template.defaults.description);
    }
    if (template.defaults.adults !== undefined) {
      setValue("adults", template.defaults.adults);
    }
    if (template.defaults.children !== undefined) {
      setValue("children", template.defaults.children);
    }
    if (template.defaults.infants !== undefined) {
      setValue("infants", template.defaults.infants);
    }
    if (template.defaults.is_urgent !== undefined) {
      setValue("is_urgent", template.defaults.is_urgent);
    }
  }

  async function onSubmit(data: RequestFormData) {
    setError(null);
    startTransition(async () => {
      try {
        let result;
        if (mode === "create") {
          result = await createRequestAction({ ...data, guest_id: userId });
        } else if (initialData?.id) {
          result = await updateRequestAction(initialData.id, data);
        }

        if (result?.success) {
          router.push("/portal/looking-for");
          router.refresh();
        } else {
          setError(result?.error ?? "Something went wrong");
        }
      } catch {
        setError("An unexpected error occurred");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Template Selector - only show in create mode */}
      {mode === "create" && (
        <TemplateSelector
          onSelect={handleTemplateSelect}
          selectedId={selectedTemplate}
        />
      )}

      {/* Basic Info */}
      <div className="space-y-4 rounded-card border border-brand-line bg-white p-6">
        <h2 className="font-display font-semibold text-brand-ink">
          Basic Information
        </h2>

        <div className="space-y-2">
          <Label htmlFor="title">What are you looking for?</Label>
          <Input
            id="title"
            placeholder="e.g., Weekend getaway for family of 4 in Franschhoek"
            {...register("title")}
          />
          {errors.title && (
            <p className="text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Additional details (optional)</Label>
          <Textarea
            id="description"
            placeholder="Any specific requirements, preferences, or questions for hosts..."
            rows={4}
            {...register("description")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(value) =>
                setValue("category", value as RequestFormData["category"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accommodation">Accommodation</SelectItem>
                <SelectItem value="experience">Experience</SelectItem>
                <SelectItem value="venue">Venue</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Region</Label>
            <Select
              value={watch("location_region") ?? ""}
              onValueChange={(value) => setValue("location_region", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location_text">Specific location (optional)</Label>
          <Input
            id="location_text"
            placeholder="e.g., Near Table Mountain, Camps Bay beachfront"
            {...register("location_text")}
          />
        </div>
      </div>

      {/* Photo */}
      <div className="space-y-4 rounded-card border border-brand-line bg-white p-6">
        <div>
          <h2 className="font-display font-semibold text-brand-ink">
            Photo (optional)
          </h2>
          <p className="mt-1 text-sm text-brand-mute">
            Add one image to bring your request to life — a place, a vibe, or an
            example of what you have in mind. Max 5MB.
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
                setValue("image_url", "");
                setImageError(null);
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

        {imageError && <p className="text-sm text-red-600">{imageError}</p>}
      </div>

      {/* Dates & Guests */}
      <div className="space-y-4 rounded-card border border-brand-line bg-white p-6">
        <h2 className="font-display font-semibold text-brand-ink">
          Dates & Guests
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="check_in_date">Check-in date</Label>
            <Input
              id="check_in_date"
              type="date"
              {...register("check_in_date")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="check_out_date">Check-out date</Label>
            <Input
              id="check_out_date"
              type="date"
              {...register("check_out_date")}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="adults">Adults</Label>
            <Input
              id="adults"
              type="number"
              min={1}
              max={50}
              {...register("adults", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="children">Children (2-12)</Label>
            <Input
              id="children"
              type="number"
              min={0}
              max={20}
              {...register("children", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="infants">Infants (0-2)</Label>
            <Input
              id="infants"
              type="number"
              min={0}
              max={10}
              {...register("infants", { valueAsNumber: true })}
            />
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="space-y-4 rounded-card border border-brand-line bg-white p-6">
        <h2 className="font-display font-semibold text-brand-ink">
          Budget (optional)
        </h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="budget_min">Minimum (R)</Label>
            <Input
              id="budget_min"
              type="number"
              min={0}
              placeholder="0"
              {...register("budget_min", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_max">Maximum (R)</Label>
            <Input
              id="budget_max"
              type="number"
              min={0}
              placeholder="No limit"
              {...register("budget_max", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>Per</Label>
            <Select
              value={watch("budget_per") ?? "night"}
              onValueChange={(value) =>
                setValue("budget_per", value as RequestFormData["budget_per"])
              }
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
        </div>
      </div>

      {/* Options */}
      <div className="space-y-4 rounded-card border border-brand-line bg-white p-6">
        <h2 className="font-display font-semibold text-brand-ink">Options</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-brand-ink">Urgent request</p>
              <p className="text-sm text-brand-mute">
                Get prioritized in host notifications
              </p>
            </div>
          </div>
          <Checkbox
            checked={isUrgent}
            onCheckedChange={(checked) => setValue("is_urgent", !!checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-brand-ink">Public request</p>
            <p className="text-sm text-brand-mute">
              Visible to all hosts in the directory
            </p>
          </div>
          <Checkbox
            checked={isPublic}
            onCheckedChange={(checked) => setValue("is_public", !!checked)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-brand-line pt-2">
          <div className="space-y-2">
            <Label htmlFor="quote_deadline">Quote deadline (optional)</Label>
            <Input
              id="quote_deadline"
              type="date"
              {...register("quote_deadline")}
            />
            <p className="text-xs text-brand-mute">
              Stop accepting quotes after this date
            </p>
          </div>
          <div className="space-y-2">
            <Label>Minimum host rating (optional)</Label>
            <Select
              value={watch("min_host_rating")?.toString() ?? "any"}
              onValueChange={(v) =>
                setValue(
                  "min_host_rating",
                  v && v !== "any" ? parseFloat(v) : undefined,
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any rating" />
              </SelectTrigger>
              <SelectContent>
                {/* Radix Select forbids an empty-string item value — use a sentinel. */}
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

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || uploading}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Post Request" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
