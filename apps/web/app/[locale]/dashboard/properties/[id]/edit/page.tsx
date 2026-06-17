import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { Editor } from "./Editor";
import { loadListingEditorData } from "./editorData";

export const metadata: Metadata = {
  title: "Edit listing",
};

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string; add?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/dashboard/properties/${params.id}/edit`);
  }

  // RLS (host_manage_own_listings) makes this implicitly own-only.
  const data = await loadListingEditorData(supabase, params.id);
  if (!data) {
    notFound();
  }

  return (
    <Editor
      {...data}
      initialTab={searchParams?.tab}
      autoCreateRoom={searchParams?.add === "1"}
    />
  );
}
