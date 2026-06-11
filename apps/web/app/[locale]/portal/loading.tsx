import { ContentSkeleton } from "@/app/_components/ContentSkeleton";

// Instant Suspense fallback for every guest portal navigation. See
// ContentSkeleton for why this exists.
export default function PortalLoading() {
  return <ContentSkeleton />;
}
