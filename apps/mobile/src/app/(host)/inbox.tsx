import { Placeholder } from "@/components/Placeholder";
import { t } from "@/i18n";

export default function HostInbox() {
  return (
    <Placeholder
      title={t("host.tabs.inbox")}
      note="Guest chats land in Phase 3 — live reads + realtime, with replies wired directly."
    />
  );
}
