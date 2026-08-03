import { requirePermission } from "@/lib/admin";

import { HelpAdminNav } from "./_components/HelpAdminNav";

export const dynamic = "force-dynamic";

// Shared shell for the Help & docs CMS — one permission gate + a horizontal
// tab-nav across every sub-surface (articles, categories, FAQs, videos,
// suggestions, status, settings). Each page keeps its own <h1>/description.
export default async function AdminHelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("help.manage");

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="flex items-baseline gap-2">
          <h1 className="font-display text-lg font-bold text-brand-ink">
            Help &amp; docs
          </h1>
          <span className="text-[12px] text-brand-mute">
            Manage everything under /help and /dashboard/help
          </span>
        </div>
        <div className="mt-3">
          <HelpAdminNav />
        </div>
      </div>

      {children}
    </div>
  );
}
