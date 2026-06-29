"use client";

import { useState, useTransition } from "react";
import { Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateQuotaAction } from "./actions";

interface QuotaFormProps {
  quota: {
    plan_id: string;
    plan_name: string;
    guest_posts_per_day: number | null;
    guest_posts_per_month: number | null;
    host_quotes_per_day: number | null;
    host_quotes_per_month: number | null;
  };
}

export function QuotaForm({ quota }: QuotaFormProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [guestPostsDay, setGuestPostsDay] = useState(
    quota.guest_posts_per_day?.toString() ?? "",
  );
  const [guestPostsMonth, setGuestPostsMonth] = useState(
    quota.guest_posts_per_month?.toString() ?? "",
  );
  const [hostQuotesDay, setHostQuotesDay] = useState(
    quota.host_quotes_per_day?.toString() ?? "",
  );
  const [hostQuotesMonth, setHostQuotesMonth] = useState(
    quota.host_quotes_per_month?.toString() ?? "",
  );

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      const result = await updateQuotaAction({
        plan_id: quota.plan_id,
        guest_posts_per_day: guestPostsDay ? parseInt(guestPostsDay, 10) : null,
        guest_posts_per_month: guestPostsMonth
          ? parseInt(guestPostsMonth, 10)
          : null,
        host_quotes_per_day: hostQuotesDay ? parseInt(hostQuotesDay, 10) : null,
        host_quotes_per_month: hostQuotesMonth
          ? parseInt(hostQuotesMonth, 10)
          : null,
      });
      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <tr className="border-b border-brand-line last:border-0">
      <td className="px-6 py-3 font-medium text-brand-ink">
        {quota.plan_name}
      </td>
      <td className="px-6 py-3">
        <Input
          type="number"
          min={0}
          placeholder="Unlimited"
          className="w-24"
          value={guestPostsDay}
          onChange={(e) => setGuestPostsDay(e.target.value)}
        />
      </td>
      <td className="px-6 py-3">
        <Input
          type="number"
          min={0}
          placeholder="Unlimited"
          className="w-24"
          value={guestPostsMonth}
          onChange={(e) => setGuestPostsMonth(e.target.value)}
        />
      </td>
      <td className="px-6 py-3">
        <Input
          type="number"
          min={0}
          placeholder="Unlimited"
          className="w-24"
          value={hostQuotesDay}
          onChange={(e) => setHostQuotesDay(e.target.value)}
        />
      </td>
      <td className="px-6 py-3">
        <Input
          type="number"
          min={0}
          placeholder="Unlimited"
          className="w-24"
          value={hostQuotesMonth}
          onChange={(e) => setHostQuotesMonth(e.target.value)}
        />
      </td>
      <td className="px-6 py-3 text-right">
        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            "Saved"
          ) : (
            <>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save
            </>
          )}
        </Button>
      </td>
    </tr>
  );
}
