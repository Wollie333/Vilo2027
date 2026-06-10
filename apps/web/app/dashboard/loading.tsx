import { ContentSkeleton } from "@/app/_components/ContentSkeleton";

// Instant Suspense fallback for every host dashboard navigation. See
// ContentSkeleton for why this exists.
export default function DashboardLoading() {
  return <ContentSkeleton />;
}
