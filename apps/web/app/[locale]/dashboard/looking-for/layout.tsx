import { redirect } from "next/navigation";

// Looking-For is shelved until it's ready for release later this year. The nav
// entry points are hidden (see LOOKING_FOR_HIDDEN in the dashboard Sidebar), and
// this layout guards every /dashboard/looking-for/* route so a direct URL can't
// reach the feature either. Delete this file to bring the section back.
export default function LookingForHiddenLayout() {
  redirect("/dashboard");
}
