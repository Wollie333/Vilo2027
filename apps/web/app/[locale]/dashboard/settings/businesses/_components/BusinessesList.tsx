"use client";

import { Building2, MoreVertical, Plus, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { Link } from "@/i18n/navigation";

import { archiveBusinessAction, setDefaultBusinessAction } from "../actions";
import { BUSINESS_LOCALE_LABELS, type BusinessLocale } from "../schemas";

export type BusinessListItem = {
  id: string;
  trading_name: string | null;
  legal_name: string | null;
  vat_number: string | null;
  city: string | null;
  province: string | null;
  country: string;
  default_currency: string;
  default_language: string;
  is_default: boolean;
  listing_count: number;
};

function displayName(b: BusinessListItem): string {
  return b.trading_name?.trim() || b.legal_name?.trim() || "Untitled business";
}

function localeLabel(code: string): string {
  return BUSINESS_LOCALE_LABELS[code as BusinessLocale] ?? code.toUpperCase();
}

export function BusinessesList({
  businesses,
}: {
  businesses: BusinessListItem[];
}) {
  const t = useTranslations("businesses");
  const [pending, start] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState<BusinessListItem | null>(
    null,
  );

  function handleSetDefault(id: string) {
    start(async () => {
      const res = await setDefaultBusinessAction(id);
      if (res.ok) toast.success(t("defaultSet"));
      else toast.error(res.error);
    });
  }

  function handleArchive(id: string) {
    start(async () => {
      const res = await archiveBusinessAction(id);
      if (res.ok) {
        toast.success(t("archived"));
        setConfirmArchive(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
          <h3 className="font-display text-base font-semibold text-brand-ink">
            {t("title")}
          </h3>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/dashboard/settings/businesses/new">
              <Plus className="h-4 w-4" />
              {t("addBusiness")}
            </Link>
          </Button>
        </div>

        {businesses.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {businesses.map((b) => {
              const addr = [b.city, b.province, b.country]
                .filter(Boolean)
                .join(", ");
              return (
                <li
                  key={b.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-semibold text-brand-ink">
                          {displayName(b)}
                        </span>
                        {b.is_default ? (
                          <Badge className="gap-1 bg-brand-accent text-brand-secondary hover:bg-brand-accent">
                            <ShieldCheck className="h-3 w-3" />
                            {t("defaultBadge")}
                          </Badge>
                        ) : null}
                      </div>
                      {addr ? (
                        <p className="mt-0.5 text-sm text-brand-ink">{addr}</p>
                      ) : null}
                      <p className="text-xs text-brand-mute">
                        {b.default_currency} · {localeLabel(b.default_language)}{" "}
                        · {t("listingsCount", { count: b.listing_count })}
                        {b.vat_number ? ` · VAT ${b.vat_number}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/settings/businesses/${b.id}`}>
                        {t("edit")}
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={pending}
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/settings/businesses/${b.id}`}>
                            {t("manageBanking")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={b.is_default || pending}
                          onClick={() => handleSetDefault(b.id)}
                        >
                          {t("setDefault")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={b.is_default || pending}
                          onClick={() => setConfirmArchive(b)}
                          className="text-status-cancelled focus:text-status-cancelled"
                        >
                          {t("archive")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={confirmArchive !== null}
        onOpenChange={(o) => !o && setConfirmArchive(null)}
        intent="destructive"
        title={t("archiveConfirmTitle")}
        description={t("archiveConfirmBody")}
        actions={[
          { label: t("cancel"), kind: "ghost" },
          {
            label: t("archive"),
            kind: "danger",
            onClick: () => {
              if (confirmArchive) handleArchive(confirmArchive.id);
              return false; // keep open until the action resolves/toasts
            },
          },
        ]}
      />
    </>
  );
}
