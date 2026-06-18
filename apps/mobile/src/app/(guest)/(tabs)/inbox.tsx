import { Placeholder } from "@/components/Placeholder";
import { t } from "@/i18n";

export default function GuestInbox() {
  return (
    <Placeholder
      title={t("guest.tabs.inbox")}
      note="Your host conversations land in Phase 2 — live reads + realtime, with sending wired directly."
    />
  );
}
