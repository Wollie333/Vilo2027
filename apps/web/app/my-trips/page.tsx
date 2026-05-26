import { redirect } from "next/navigation";

// /my-trips used to be the guest-facing index. It lives inside /portal now;
// keep the old URL as a permanent redirect so existing email links still land.
export default function MyTripsLegacyRedirect() {
  redirect("/portal/trips");
}
