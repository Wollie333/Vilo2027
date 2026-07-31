import { requirePermission } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Dedicated Legal hub — reachable by a Legal Counsel (legal.docs) OR any platform
// admin (platform.settings). Kept OUT of the platform-settings layout so a lawyer
// can manage legal documents without any other admin access.
export default async function AdminLegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission(["legal.docs", "platform.settings"]);

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Legal documents
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          The single source of truth for every legal document — edit, publish,
          and assign each to where it&apos;s used across the platform.
        </p>
      </header>

      {children}
    </div>
  );
}
