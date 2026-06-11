"use client";

import { usePathname, useRouter } from "next/navigation";

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
}: {
  active: string;
  reviewCount: number;
  needsResponseCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function setView(key: string) {
    if (key === "activity") {
      router.push(`${pathname}?view=activity`);
    } else {
      router.push(pathname);
    }
  }

  return (
    <RecordTabs
      active={active}
      onSelect={setView}
      tabs={[
        { key: "reviews", label: "Reviews", count: reviewCount },
        {
          key: "activity",
          label: "Activity",
          count: needsResponseCount || undefined,
        },
      ]}
    />
  );
}
