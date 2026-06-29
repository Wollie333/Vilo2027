"use client";

import { Globe } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { createWebsiteAction } from "../actions";

const ERROR_KEY: Record<string, string> = {
  too_short: "errTooShort",
  too_long: "errTooLong",
  invalid_chars: "errInvalidChars",
  reserved: "errReserved",
  subdomain_taken: "errSubdomainTaken",
  already_exists: "errAlreadyExists",
  business_not_found: "errBusinessNotFound",
};

export function CreateWebsiteCard({
  businessId,
  businessName,
  defaultSubdomain,
}: {
  businessId: string;
  businessName: string;
  defaultSubdomain: string;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [sub, setSub] = useState(defaultSubdomain);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";

  function onChange(v: string) {
    // Live-sanitise to a DNS-safe label as the host types.
    setSub(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    setError(null);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await createWebsiteAction({ businessId, subdomain: sub });
      if (res.ok) {
        router.push(`/dashboard/website/${res.id}`);
        router.refresh();
      } else {
        setError(t(ERROR_KEY[res.error] ?? "errGeneric"));
      }
    });
  }

  return (
    <div className="p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Globe className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-brand-ink">
            {t("businessSiteFor", { business: businessName })}
          </h2>
          <p className="text-[13px] text-brand-mute">{t("createBody")}</p>
        </div>
      </div>

      <label className="mt-4 block text-[13px] font-semibold text-brand-ink">
        {t("subdomainLabel")}
      </label>
      <div className="mt-1.5 flex max-w-md items-stretch overflow-hidden rounded-[10px] border border-brand-line focus-within:border-brand-primary">
        <input
          value={sub}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          className="min-w-0 flex-1 px-3 py-2.5 font-mono text-sm text-brand-ink outline-none"
          placeholder="your-place"
        />
        <span className="flex items-center bg-brand-light px-3 font-mono text-[13px] text-brand-mute">
          .{root}
        </span>
      </div>
      <p className="mt-1.5 text-[11.5px] text-brand-mute">
        {t("subdomainHint")}
      </p>

      {error ? (
        <p className="mt-2 text-[12.5px] font-medium text-status-cancelled">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={pending || sub.length < 3}
        className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? t("creating") : t("createCta")}
      </button>
    </div>
  );
}
