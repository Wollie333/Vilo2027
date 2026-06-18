import { Placeholder } from "@/components/Placeholder";
import { t } from "@/i18n";

export default function HostCalendar() {
  return (
    <Placeholder
      title={t("host.tabs.calendar")}
      note="Availability and date blocking land in Phase 3 — live reads with direct block/unblock writes."
    />
  );
}
