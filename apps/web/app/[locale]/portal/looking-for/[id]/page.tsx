import { notFound, redirect } from "next/navigation";

import { RequestDetailsHtml } from "@/components/looking-for/RequestDetailsHtml";
import { RequestRequirements } from "@/components/looking-for/RequestRequirements";
import { createServerClient } from "@/lib/supabase/server";

import { markQuotesViewedAction } from "../actions";
import { RequestRecord } from "./RequestRecord";
import { loadRequestRecord } from "./record-data";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/portal/looking-for/${id}`);
  }

  const data = await loadRequestRecord(id, user.id);
  if (!data) notFound();

  // Mark any unseen quotes as viewed + notify their hosts (fire-and-forget).
  markQuotesViewedAction(id).catch(() => {});

  return (
    <RequestRecord
      data={data}
      detailsSlot={
        data.post.description ? (
          <RequestDetailsHtml html={data.post.description} />
        ) : null
      }
      requirementsSlot={<RequestRequirements postId={id} />}
    />
  );
}
