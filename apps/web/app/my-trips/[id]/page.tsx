import { redirect } from "next/navigation";

// The guest trip detail lives inside /portal now (it uses the guest-portal
// shell). Keep the old /my-trips/<id> URL as a permanent redirect so existing
// email/confirmation links still land on the trip page.
export default function MyTripDetailLegacyRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/portal/trips/${params.id}`);
}
