import { redirect } from "next/navigation";

// The guest portal's Looking-For surface is shelved until release later this
// year. The nav entry (portal sidebar "Discover") is hidden; this layout guards
// every /portal/looking-for/* route so a direct URL redirects back to the
// portal. Delete this file to bring it back.
export default function PortalLookingForHiddenLayout() {
  redirect("/portal");
}
