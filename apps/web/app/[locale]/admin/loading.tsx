import { ContentSkeleton } from "@/app/_components/ContentSkeleton";

// Instant Suspense fallback for every admin navigation. See ContentSkeleton
// for why this exists.
export default function AdminLoading() {
  return <ContentSkeleton />;
}
