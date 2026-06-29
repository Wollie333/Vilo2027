import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { RequestForm } from "../../_components/RequestForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditRequestPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/portal/looking-for/${id}/edit`);
  }

  // Fetch the post
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link href={`/portal/looking-for/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Search className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-brand-ink">
            Edit Request
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Update your request details
          </p>
        </div>
      </div>

      <RequestForm
        mode="edit"
        userId={user.id}
        initialData={{
          id: post.id,
          title: post.title,
          description: post.description ?? undefined,
          category: post.category as
            | "accommodation"
            | "experience"
            | "venue"
            | "event"
            | "other",
          check_in_date: post.check_in_date ?? undefined,
          check_out_date: post.check_out_date ?? undefined,
          adults: post.adults,
          children: post.children ?? 0,
          infants: post.infants ?? 0,
          location_text: post.location_text ?? undefined,
          location_region: post.location_region ?? undefined,
          budget_min: post.budget_min ?? undefined,
          budget_max: post.budget_max ?? undefined,
          budget_per: post.budget_per as
            | "night"
            | "total"
            | "person"
            | undefined,
          is_urgent: post.is_urgent ?? false,
          is_public: post.is_public ?? true,
        }}
      />
    </div>
  );
}
