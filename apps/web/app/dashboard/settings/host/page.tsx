import { redirect } from "next/navigation";

// The public-host-page editor was merged into /dashboard/settings.
// Keep this route alive as a redirect so any bookmarked link still works.
export default function HostSettingsRedirect(): never {
  redirect("/dashboard/settings");
}
