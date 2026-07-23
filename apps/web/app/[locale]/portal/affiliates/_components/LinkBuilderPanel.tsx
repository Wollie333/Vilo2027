"use client";

import { QRCodeCanvas } from "qrcode.react";
import { Download, Link2, Mail, MessageCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { CopyLinkButton } from "./CopyLinkButton";

// Link builder — pixel-match of the design's "Link builder" card. Turns the
// affiliate's code into a link for any page / a product / a campaign signup,
// with a live QR. Routes through /r/<slug>?next= (or /c/<campaign>/<slug> for a
// campaign) exactly as the attribution spine expects.
type ProductOpt = { id: string; name: string; slug: string | null };
type CampaignOpt = { slug: string; name: string };
type Mode = "page" | "product" | "campaign";

export function LinkBuilderPanel({
  baseUrl,
  slug,
  products,
  campaigns,
}: {
  baseUrl: string;
  slug: string;
  products: ProductOpt[];
  campaigns: CampaignOpt[];
}) {
  const [mode, setMode] = useState<Mode>("page");
  const [path, setPath] = useState("/pricing");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [campaignSlug, setCampaignSlug] = useState(campaigns[0]?.slug ?? "");
  const qrWrap = useRef<HTMLDivElement>(null);

  const link = useMemo(() => {
    if (mode === "campaign" && campaignSlug) {
      return `${baseUrl}/c/${campaignSlug}/${slug}`;
    }
    if (mode === "product") {
      const p = products.find((x) => x.id === productId);
      const dest = p?.slug ? `/p/${p.slug}` : "/";
      return `${baseUrl}/r/${slug}?next=${encodeURIComponent(dest)}`;
    }
    let p = path.trim();
    if (p && !p.startsWith("/")) p = "/" + p;
    if (!p || p === "/") return `${baseUrl}/r/${slug}`;
    return `${baseUrl}/r/${slug}?next=${encodeURIComponent(p)}`;
  }, [mode, path, productId, campaignSlug, baseUrl, slug, products]);

  const display = link.replace(/^https?:\/\//, "");
  const share = encodeURIComponent(link);

  function seg(m: Mode, label: string) {
    return (
      <button className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
        {label}
      </button>
    );
  }

  function downloadQr() {
    const canvas = qrWrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `wielo-${slug}.png`;
    a.click();
  }

  return (
    <section className="am-card fade mt-6 overflow-hidden">
      <div className="smallcaps border-b border-brand-line px-5 py-3.5">
        Link builder
      </div>
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[1fr_300px]">
        <div>
          <label className="flabel">Send people to</label>
          <div className="seg">
            {seg("page", "Any page")}
            {seg("product", "A product")}
            {campaigns.length > 0 ? seg("campaign", "Campaign signup") : null}
          </div>
          <div className="mt-3">
            {mode === "page" ? (
              <>
                <input
                  className="fld mono text-[13px]"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  spellCheck={false}
                />
                <p className="fhelp">
                  Paste any Wielo page or path. Your referral code is added
                  automatically.
                </p>
              </>
            ) : null}
            {mode === "product" ? (
              <select
                className="fld"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : null}
            {mode === "campaign" ? (
              <select
                className="fld"
                value={campaignSlug}
                onChange={(e) => setCampaignSlug(e.target.value)}
              >
                {campaigns.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <label className="flabel mt-4">Your link</label>
          <div className="copyfield">
            <Link2 className="h-4 w-4 shrink-0 text-brand-mute" />
            <span className="mono flex-1 truncate text-[13px] text-brand-ink">
              {display}
            </span>
            <CopyLinkButton value={link} />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <a
              className="btn-ghost"
              href={`https://wa.me/?text=${share}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
            <a
              className="btn-ghost"
              href={`mailto:?subject=${encodeURIComponent("Join me on Wielo")}&body=${share}`}
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
            <button className="btn-ghost" type="button" onClick={downloadQr}>
              <Download className="h-3.5 w-3.5" /> Save QR
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-brand-line bg-[#FAFCFB] p-5">
          <div ref={qrWrap} className="rounded-[10px] bg-white p-2">
            <QRCodeCanvas
              value={link}
              size={144}
              level="M"
              marginSize={1}
              fgColor="#052E1F"
            />
          </div>
          <div className="mt-2 text-[11px] text-brand-mute">
            Live QR for your link
          </div>
        </div>
      </div>
    </section>
  );
}
