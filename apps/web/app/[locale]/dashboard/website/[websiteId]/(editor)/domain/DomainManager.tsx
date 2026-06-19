"use client";

import {
  Check,
  Copy,
  Globe,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  connectCustomDomainAction,
  refreshCustomDomainAction,
  removeCustomDomainAction,
  saveSubdomainAction,
  setCanonicalHostAction,
} from "@/app/[locale]/dashboard/website/actions";

import type { DomainData } from "./loadDomainData";

// Maps a known action error code to a website-namespace i18n key.
const ERR_KEY: Record<string, string> = {
  domainRequired: "domErrRequired",
  domainInvalid: "domErrInvalid",
  domainIsRoot: "domErrIsRoot",
  domain_taken: "domErrTaken",
  domain_not_configured: "domErrNotConfigured",
  vercel_failed: "domErrVercel",
  no_domain: "errGeneric",
  too_short: "errTooShort",
  too_long: "errTooLong",
  invalid_chars: "errInvalidChars",
  reserved: "errReserved",
  subdomain_taken: "errSubdomainTaken",
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  verifying: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
  none: "bg-brand-light text-brand-mute border-brand-line",
};

function StatusPill({ status, label }: { status: string; label: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.none;
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — no-op */
        }
      }}
      className="shrink-0 rounded p-1 text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function DomainManager({ data }: { data: DomainData }) {
  const t = useTranslations("website");
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [busy, start] = useTransition();
  const [editingSub, setEditingSub] = useState(false);
  const [sub, setSub] = useState(data.subdomain);

  function showError(code: string) {
    const key = ERR_KEY[code];
    toast.error(key ? t(key) : t("errGeneric"));
  }

  function onSaveSubdomain() {
    start(async () => {
      const res = await saveSubdomainAction(data.websiteId, sub);
      if (!res.ok) return showError(res.error);
      toast.success(t("domSubdomainSaved"));
      setEditingSub(false);
      router.refresh();
    });
  }

  function onSetCanonical(canonical: "apex" | "www") {
    start(async () => {
      const res = await setCanonicalHostAction(data.websiteId, canonical);
      if (!res.ok) return showError(res.error);
      toast.success(t("domCanonicalSaved"));
      router.refresh();
    });
  }

  // Connection stepper state (mirrors domain_status / ssl_status).
  const steps = [
    { key: "domStepAdded", done: Boolean(data.customDomain) },
    {
      key: "domStepRecords",
      done: data.domainStatus === "verifying" || data.domainStatus === "active",
    },
    { key: "domStepVerified", done: data.domainStatus === "active" },
    { key: "domStepSsl", done: data.sslStatus === "active" },
  ];
  const firstPending = steps.findIndex((s) => !s.done);

  function onConnect() {
    start(async () => {
      const res = await connectCustomDomainAction({
        websiteId: data.websiteId,
        domain,
      });
      if (!res.ok) return showError(res.error);
      toast.success(t("domConnected"));
      setDomain("");
      router.refresh();
    });
  }

  function onRefresh() {
    start(async () => {
      const res = await refreshCustomDomainAction(data.websiteId);
      if (!res.ok) return showError(res.error);
      toast.success(t("domRefreshed"));
      router.refresh();
    });
  }

  function onRemove() {
    start(async () => {
      const res = await removeCustomDomainAction(data.websiteId);
      if (!res.ok) return showError(res.error);
      toast.success(t("domRemoved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Free subdomain — always available, editable */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <Globe className="h-4 w-4 text-brand-mute" />
          {t("domFreeAddress")}
        </h3>
        {editingSub ? (
          <div className="mt-3">
            <div className="flex items-stretch">
              <input
                value={sub}
                onChange={(e) =>
                  setSub(e.target.value.toLowerCase().replace(/\s+/g, ""))
                }
                spellCheck={false}
                autoCapitalize="none"
                className="w-full min-w-0 rounded-l-[10px] border border-brand-line bg-white px-3 py-2 font-mono text-[13px] text-brand-ink outline-none focus:border-brand-primary"
              />
              <span className="inline-flex items-center rounded-r-[10px] border border-l-0 border-brand-line bg-brand-light/60 px-3 font-mono text-[13px] text-brand-mute">
                .{data.rootDomain}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-brand-mute">
              {t("domSubdomainHint")}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onSaveSubdomain}
                disabled={
                  busy || sub.trim().length < 3 || sub === data.subdomain
                }
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t("domSubdomainSave")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSub(data.subdomain);
                  setEditingSub(false);
                }}
                className="rounded-[10px] px-3 py-2 text-[13px] font-medium text-brand-mute hover:text-brand-ink"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="font-mono text-[13px] text-brand-ink">
              {data.subdomain}.{data.rootDomain}
            </p>
            <button
              type="button"
              onClick={() => setEditingSub(true)}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-light"
            >
              <Pencil className="h-3.5 w-3.5 text-brand-mute" />
              {t("domSubdomainEdit")}
            </button>
          </div>
        )}
        <p className="mt-1 text-[12.5px] text-brand-mute">{t("domFreeHint")}</p>
      </section>

      {!data.customDomain ? (
        /* Connect a custom domain */
        <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("domConnectTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">
            {t("domConnectSub")}
          </p>
          {!data.configured ? (
            <p className="mt-3 rounded-[10px] border border-dashed border-brand-line bg-brand-light/50 px-3 py-2 text-[12.5px] text-brand-mute">
              {t("domNotConfigured")}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={t("domPlaceholder")}
              spellCheck={false}
              autoCapitalize="none"
              className="w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink outline-none transition focus:border-brand-primary"
            />
            <button
              type="button"
              onClick={onConnect}
              disabled={busy || !data.configured || domain.trim().length < 3}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("domConnectCta")}
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Connected domain + status */}
          <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-brand-ink">
                  {data.customDomain}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill
                    status={data.domainStatus}
                    label={t(`domStatus_${data.domainStatus}`)}
                  />
                  <span className="inline-flex items-center gap-1 text-[12px] text-brand-mute">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t("domSslLabel")}: {t(`domSsl_${data.sslStatus}`)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {t("domRefreshCta")}
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("domRemoveCta")}
                </button>
              </div>
            </div>

            {data.domainStatus !== "active" ? (
              <p className="mt-4 text-[12.5px] text-brand-mute">
                {t("domPendingHint")}
              </p>
            ) : (
              <p className="mt-4 text-[12.5px] text-emerald-700">
                {t("domActiveHint")}
              </p>
            )}

            {/* Connection stepper */}
            <div className="mt-5 border-t border-brand-line pt-4">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
                {t("domStepsTitle")}
              </div>
              <ol className="grid gap-3 sm:grid-cols-4">
                {steps.map((s, i) => {
                  const current = i === firstPending;
                  return (
                    <li
                      key={s.key}
                      className="flex items-center gap-2 sm:block"
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          s.done
                            ? "bg-brand-primary text-white"
                            : current
                              ? "border border-amber-300 bg-amber-50 text-amber-600"
                              : "border border-brand-line bg-brand-light text-brand-mute"
                        }`}
                      >
                        {s.done ? (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        ) : current ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <span className="text-[12px] font-bold">{i + 1}</span>
                        )}
                      </span>
                      <span
                        className={`text-[12.5px] font-semibold sm:mt-2 sm:block ${
                          s.done ? "text-brand-ink" : "text-brand-mute"
                        }`}
                      >
                        {t(s.key)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Canonical host preference (only for apex/www domains) */}
            {data.canonicalApplicable ? (
              <div className="mt-5 border-t border-brand-line pt-4">
                <div className="text-sm font-semibold text-brand-ink">
                  {t("domCanonicalTitle")}
                </div>
                <p className="mt-0.5 text-[12.5px] text-brand-mute">
                  {t("domCanonicalSub")}
                </p>
                <div className="mt-2 inline-flex rounded-pill border border-brand-line bg-brand-light/60 p-0.5 text-[12.5px] font-semibold">
                  {(["apex", "www"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={busy}
                      onClick={() => onSetCanonical(c)}
                      className={`rounded-pill px-3 py-1.5 transition ${
                        data.canonicalHost === c
                          ? "bg-white text-brand-secondary shadow-sm"
                          : "text-brand-mute hover:text-brand-ink"
                      }`}
                    >
                      {t(c === "apex" ? "domCanonicalApex" : "domCanonicalWww")}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[12px] text-brand-mute">
                  {t("domCanonicalHint")}
                </p>
              </div>
            ) : null}
          </section>

          {/* DNS records */}
          {data.dnsRecords.length > 0 ? (
            <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
              <h3 className="text-sm font-semibold text-brand-ink">
                {t("domDnsTitle")}
              </h3>
              <p className="mt-1 text-[13px] text-brand-mute">
                {t("domDnsSub")}
              </p>
              <div className="mt-4 overflow-hidden rounded-[10px] border border-brand-line">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-brand-light/60 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
                    <tr>
                      <th className="px-3 py-2">{t("domDnsType")}</th>
                      <th className="px-3 py-2">{t("domDnsName")}</th>
                      <th className="px-3 py-2">{t("domDnsValue")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-line">
                    {data.dnsRecords.map((r, i) => (
                      <tr key={`${r.type}-${i}`} className="align-top">
                        <td className="px-3 py-2 font-mono font-semibold text-brand-ink">
                          {r.type}
                        </td>
                        <td className="px-3 py-2 font-mono text-brand-ink">
                          <div className="flex items-center gap-1.5">
                            <span className="break-all">{r.name}</span>
                            <CopyButton value={r.name} label={t("domCopy")} />
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-brand-ink">
                          <div className="flex items-center gap-1.5">
                            <span className="break-all">{r.value}</span>
                            <CopyButton value={r.value} label={t("domCopy")} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Recent activity */}
          {data.events.length > 0 ? (
            <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
              <h3 className="text-sm font-semibold text-brand-ink">
                {t("domActivityTitle")}
              </h3>
              <ul className="mt-3 space-y-2 text-[13px]">
                {data.events.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-brand-mute"
                  >
                    <span>{t(`domEvent_${e.event}`)}</span>
                    <time className="shrink-0 font-mono text-[12px]">
                      {e.createdAt.slice(0, 16).replace("T", " ")}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
