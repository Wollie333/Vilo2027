import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createServerClient } from "@/lib/supabase/server";

// The full-screen Website-CMS editors (blog post, page builder, forms, nav) live
// OUTSIDE /dashboard so they escape the dashboard shell (sidebar + header) and
// fill the viewport exactly like the mockups. This root only enforces an
// authenticated session and loads the builder design system; the per-website
// owner + feature gate lives in [websiteId]/layout. The emerald `.vilo-builder`
// styles are scoped, so importing them here is inert until a page opts in.
import "../dashboard/website/builder.css";
import "../dashboard/website/nav.css";
import "./blog-editor.css";
import "./form-editor.css";

export const dynamic = "force-dynamic";

export default async function WebsiteEditorRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/website");

  return children;
}
