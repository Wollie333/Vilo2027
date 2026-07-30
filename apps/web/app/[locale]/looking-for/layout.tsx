import { redirect } from "next/navigation";

// The public Looking-For (guest request marketplace) is shelved until it's ready
// for release later this year. Nav entry points are hidden (site header, deals
// banner); this layout guards every /looking-for/* route so a direct URL can't
// reach the feature either. Delete this file to bring it back.
export default function LookingForHiddenLayout() {
  redirect("/");
}
