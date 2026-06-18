import { Placeholder } from "@/components/Placeholder";
import { t } from "@/i18n";

export default function GuestTrips() {
  return (
    <Placeholder
      title={t("guest.tabs.trips")}
      note="Your upcoming and past trips land in Phase 2 — wired to your live bookings."
    />
  );
}
