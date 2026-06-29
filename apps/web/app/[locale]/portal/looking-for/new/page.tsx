import { redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { RequestForm } from "../_components/RequestForm";

export default async function NewRequestPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal/looking-for/new");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link href="/portal/looking-for">
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
            Post a Request
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Tell hosts what you&apos;re looking for and receive personalized
            quotes
          </p>
        </div>
      </div>

      <RequestForm mode="create" userId={user.id} />
    </div>
  );
}
