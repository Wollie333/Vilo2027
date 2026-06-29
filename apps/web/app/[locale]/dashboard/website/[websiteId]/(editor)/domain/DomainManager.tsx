"use client";

import {
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  Pencil,
  Plug,
  RefreshCw,
  Route,
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

function statusTag(status: string, t: ReturnType<typeof useTranslations>) {
  const cls =
    status === "active" ? "green" : status === "error" ? "red" : "amber";
  return (
    <span className={`tag ${cls}`}>
      <span className="d" />
      {t(`domStatus_${status}`)}
    </span>
  );
}

export function DomainManager({ data }: { data: DomainData }) {
  const t = useTranslations("website");
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [busy, start] = useTransition();
  const [editingSub, setEditingSub] = useState(false);
  const [sub, setSub] = useState(data.subdomain);

  const glyph = (data.subdomain[0] || "·").toUpperCase();
  const fullSub = `${data.subdomain}.${data.rootDomain}`;

  function showError(code: string) {
    const key = ERR_KEY[code];
    toast.error(key ? t(key) : t("errGeneric"));
  }
  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => toast.success(t("domCopied")),
      () => {},
    );
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
  function onSetCanonical(c: "apex" | "www") {
    start(async () => {
      const res = await setCanonicalHostAction(data.websiteId, c);
      if (!res.ok) return showError(res.error);
      toast.success(t("domCanonicalSaved"));
      router.refresh();
    });
  }

  return (
    <div className="wielo-cms wrap-set">
      <div className="mb-5">
        <h1
          className="font-display text-[20px] font-extrabold"
          style={{ color: "var(--ink)" }}
        >
          {t("domainHeading")}
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--mute)" }}>
          {t("domainSub")}
        </p>
      </div>

      {/* PRIMARY DOMAIN */}
      <div className="sblock">
        <div className="sblock-h">
          <span className="si">
            <Globe style={{ width: 19, height: 19 }} />
          </span>
          <div>
            <h2>{t("domPrimaryTitle")}</h2>
            <p>{t("domPrimarySub")}</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="domhero">
            <span className="dg" style={{ background: "#064E3B" }}>
              {glyph}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="mono text-[15px] font-bold"
                  style={{ color: "var(--ink)" }}
                >
                  {fullSub}
                </span>
                <span className="tag green">
                  <span className="d" />
                  {t("domLive")}
                </span>
                <span className="tag sky">
                  <span className="d" />
                  {t("domSslSecured")}
                </span>
              </div>
              <div
                className="mt-1.5 text-[12px]"
                style={{ color: "var(--mute)" }}
              >
                {t("domFreeBlurb")}
              </div>
            </div>
            <a
              href={`https://${fullSub}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm shrink-0"
            >
              <ExternalLink
                style={{ width: 14, height: 14, color: "var(--mute)" }}
              />
              {t("domVisit")}
            </a>
          </div>

          <div className="setrow">
            <div className="lbl">
              <b>{t("domSubRow")}</b>
              <span>{t("domSubRowSub")}</span>
            </div>
            <div className="ctl">
              {editingSub ? (
                <>
                  <input
                    className="field mono"
                    style={{ width: 200 }}
                    value={sub}
                    spellCheck={false}
                    autoCapitalize="none"
                    onChange={(e) =>
                      setSub(e.target.value.toLowerCase().replace(/\s+/g, ""))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={onSaveSubdomain}
                    disabled={
                      busy || sub.trim().length < 3 || sub === data.subdomain
                    }
                  >
                    {busy ? (
                      <Loader2
                        className="animate-spin"
                        style={{ width: 14, height: 14 }}
                      />
                    ) : null}
                    {t("domSubdomainSave")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSub(data.subdomain);
                      setEditingSub(false);
                    }}
                  >
                    {t("cancel")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingSub(true)}
                >
                  <Pencil
                    style={{ width: 14, height: 14, color: "var(--mute)" }}
                  />
                  {t("domSubdomainEdit")}
                </button>
              )}
            </div>
          </div>

          {data.customDomain ? (
            <div className="setrow">
              <div className="lbl">
                <b style={{ fontFamily: "'JetBrains Mono'", fontSize: 13 }}>
                  {data.customDomain}
                </b>
                <span>{t("domCustomRowSub")}</span>
              </div>
              <div className="ctl">{statusTag(data.domainStatus, t)}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* CONNECT CUSTOM DOMAIN */}
      <div className="sblock">
        <div className="sblock-h">
          <span className="si">
            <Link2 style={{ width: 19, height: 19 }} />
          </span>
          <div>
            <h2>{t("domConnectTitle")}</h2>
            <p>{t("domConnectSub")}</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          {!data.customDomain ? (
            <div className="setrow">
              <div className="lbl">
                <b>{t("domAddTitle")}</b>
                <span>
                  {t("domAddSub")}
                  {!data.configured ? ` ${t("domNotConfigured")}` : ""}
                </span>
              </div>
              <div className="ctl">
                <input
                  className="field mono"
                  style={{ width: 240 }}
                  value={domain}
                  placeholder={t("domPlaceholder")}
                  spellCheck={false}
                  autoCapitalize="none"
                  onChange={(e) => setDomain(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onConnect}
                  disabled={
                    busy || !data.configured || domain.trim().length < 3
                  }
                >
                  {busy ? (
                    <Loader2
                      className="animate-spin"
                      style={{ width: 14, height: 14 }}
                    />
                  ) : (
                    <Plug style={{ width: 14, height: 14 }} />
                  )}
                  {t("domConnectShort")}
                </button>
              </div>
            </div>
          ) : (
            <div className="setrow">
              <div className="lbl">
                <b style={{ fontFamily: "'JetBrains Mono'", fontSize: 13 }}>
                  {data.customDomain}
                </b>
                <span>
                  {data.domainStatus === "active"
                    ? t("domActiveHint")
                    : t("domPendingHint")}
                </span>
              </div>
              <div className="ctl">
                {statusTag(data.domainStatus, t)}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onRefresh}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2
                      className="animate-spin"
                      style={{ width: 14, height: 14 }}
                    />
                  ) : (
                    <RefreshCw
                      style={{ width: 14, height: 14, color: "var(--mute)" }}
                    />
                  )}
                  {t("domRefreshCta")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#B91C1C" }}
                  onClick={onRemove}
                  disabled={busy}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                  {t("domRemoveCta")}
                </button>
              </div>
            </div>
          )}

          {data.dnsRecords.length > 0 ? (
            <div className="setrow" style={{ display: "block" }}>
              <div className="mb-1 flex items-center gap-2">
                <b className="text-[13.5px]" style={{ color: "var(--ink)" }}>
                  {t("domDnsTitle")}
                </b>
                <span className="tag amber">
                  <span className="d" />
                  {t("domDnsWaiting")}
                </span>
              </div>
              <div
                className="mb-2 text-[12px]"
                style={{ color: "var(--mute)" }}
              >
                {t("domDnsRegistrar")}
              </div>
              <div className="dns">
                <div className="dh">
                  <div>{t("domDnsType")}</div>
                  <div>{t("domDnsName")}</div>
                  <div>{t("domDnsValue")}</div>
                  <div>{t("domTtl")}</div>
                  <div />
                </div>
                {data.dnsRecords.map((r, i) => (
                  <div className="dr" key={`${r.type}-${i}`}>
                    <div>{r.type}</div>
                    <div>{r.name}</div>
                    <div style={{ wordBreak: "break-all" }}>{r.value}</div>
                    <div>3600</div>
                    <div
                      className="cp"
                      role="button"
                      tabIndex={0}
                      onClick={() => copy(r.value)}
                      aria-label={t("domCopy")}
                    >
                      <Copy style={{ width: 13, height: 13 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {data.customDomain ? (
            <div className="setrow">
              <div className="lbl">
                <b>{t("domSslCert")}</b>
                <span>{t("domSslCertSub")}</span>
              </div>
              <div className="ctl">
                <span
                  className={`tag ${data.sslStatus === "active" ? "green" : "gray"}`}
                >
                  <span className="d" />
                  {t(`domSsl_${data.sslStatus}`)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* FORWARDING & HTTPS */}
      <div className="sblock">
        <div className="sblock-h">
          <span className="si">
            <Route style={{ width: 19, height: 19 }} />
          </span>
          <div>
            <h2>{t("domForwardingTitle")}</h2>
            <p>{t("domForwardingSub")}</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="setrow">
            <div className="lbl">
              <b>{t("domForceHttps")}</b>
              <span>{t("domForceHttpsSub")}</span>
            </div>
            <div className="ctl">
              <span className="tag green">
                <span className="d" />
                {t("domAlwaysOn")}
              </span>
            </div>
          </div>
          {data.canonicalApplicable ? (
            <div className="setrow">
              <div className="lbl">
                <b>{t("domCanonicalTitle")}</b>
                <span>{t("domCanonicalSub")}</span>
              </div>
              <div className="ctl">
                <div className="eseg">
                  {(["apex", "www"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={busy}
                      className={data.canonicalHost === c ? "on" : ""}
                      onClick={() => onSetCanonical(c)}
                    >
                      {t(c === "apex" ? "domCanonicalApex" : "domCanonicalWww")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
