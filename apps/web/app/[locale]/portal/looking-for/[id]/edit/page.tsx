import { redirect, notFound } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { loadFormDraft } from "@/lib/drafts/store";
import {
  RequestForm,
  type RequestEditValues,
} from "../../_components/RequestForm";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function EditRequestPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/portal/looking-for/${id}/edit`);
  }

  const { data: post, error } = await supabase
    .from("looking_for_posts")
    .select(
      `
      id,
      title,
      description,
      category,
      check_in_date,
      check_out_date,
      adults,
      children,
      infants,
      location_text,
      location_region,
      budget_min,
      budget_max,
      budget_per,
      is_urgent,
      is_public,
      quote_deadline,
      min_host_rating,
      image_url,
      guest_id
    `,
    )
    .eq("id", id)
    .single();

  if (error || !post) {
    notFound();
  }

  // Verify ownership
  if (post.guest_id !== user.id) {
    redirect("/portal/looking-for");
  }

  const initial: RequestEditValues = {
    title: post.title ?? "",
    description: post.description ?? "",
    category: (post.category ??
      "accommodation") as RequestEditValues["category"],
    checkIn: post.check_in_date ?? "",
    checkOut: post.check_out_date ?? "",
    adults: String(post.adults ?? 2),
    children: String(post.children ?? 0),
    infants: String(post.infants ?? 0),
    locationText: post.location_text ?? "",
    region: post.location_region ?? "",
    budgetMin: post.budget_min != null ? String(post.budget_min) : "",
    budgetMax: post.budget_max != null ? String(post.budget_max) : "",
    budgetPer: (post.budget_per ?? "night") as RequestEditValues["budgetPer"],
    isUrgent: post.is_urgent ?? false,
    isPublic: post.is_public ?? true,
    quoteDeadline: post.quote_deadline
      ? String(post.quote_deadline).slice(0, 10)
      : "",
    minHostRating:
      post.min_host_rating != null ? String(post.min_host_rating) : "",
    imageUrl: post.image_url ?? "",
  };

  const serverDraft = await loadFormDraft(supabase, user.id, {
    entityType: "looking_for_request",
    entityId: post.id,
    scopeId: null,
  });

  return (
    <RequestForm
      mode="edit"
      userId={user.id}
      postId={post.id}
      initial={initial}
      serverDraft={serverDraft}
    />
  );
}
