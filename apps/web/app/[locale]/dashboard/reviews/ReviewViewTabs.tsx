"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";

/**
 * Top-level Reviews tabs (Reviews · Activity), styled like the booking/guest
 * record tabs. Switches the ?view= param; leaving the Reviews view drops the
 * feed-only filters so Activity opens clean.
 */
export function ReviewViewTabs({
  active,
  reviewCount,
  needsResponseCount,
  guestRatingCount,
  externalSourceCount,
}: {
  active: string;
  reviewCount: number;
  needsResponseCount: number;
  guestRatingCount: number;
  externalSourceCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

  function setView(key: string) {
    if (key === active) return; // Already on this tab
    setLoadingTab(key);
    startTransition(() => {
      if (key === "activity") {
        router.push(`${pathname}?view=activity`);
      } else if (key === "guest-ratings") {
        router.push(`${pathname}?view=guest-ratings`);
      } else if (key === "external") {
        router.push(`${pathname}?view=external`);
      } else {
        router.push(pathname);
      }
    });
  }

  // Clear loading state when active tab changes
  if (loadingTab === active) {
    setLoadingTab(null);
  }

  return (
    <RecordTabs
      active={active}
      onSelect={setView}
      loadingKey={isPending ? loadingTab : null}
      tabs={[
        { key: "reviews", label: "Reviews", count: reviewCount },
        {
          key: "activity",
          label: "Activity",
          count: needsResponseCount || undefined,
        },
        {
          key: "guest-ratings",
          label: "Guest ratings",
          count: guestRatingCount || undefined,
        },
        {
          key: "external",
          label: "External",
          count: externalSourceCount || undefined,
        },
      ]}
    />
  );
}
