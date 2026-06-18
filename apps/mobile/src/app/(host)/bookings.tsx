import { Placeholder } from "@/components/Placeholder";
import { t } from "@/i18n";

export default function HostBookings() {
  return (
    <Placeholder
      title={t("host.tabs.bookings")}
      note="Reservations with status filters land in Phase 3 — wired to your live bookings."
    />
  );
}
