import { Placeholder } from "@/components/Placeholder";
import { t } from "@/i18n";

export default function HostOverview() {
  return (
    <Placeholder
      title={t("host.tabs.overview")}
      note="Today's KPIs and upcoming stays land in Phase 3 — wired to live host analytics."
    />
  );
}
