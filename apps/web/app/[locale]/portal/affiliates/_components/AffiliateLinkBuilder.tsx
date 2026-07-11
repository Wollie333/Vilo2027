"use client";

import { QRCodeCanvas } from "qrcode.react";
import {
  Check,
  Copy,
  Download,
  Globe,
  Home,
  Mail,
  MessageCircle,
  Package,
  QrCode,
  Rocket,
  Search,
  Sparkles,
  Tag,
  UserPlus,
  Wand2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// Affiliate LINK BUILDER — the affiliate turns their unique code into a link for
// ANY destination on the platform: a curated marketing/system page, any on-site
// path they paste, OR a specific product. Everything routes through /r/<slug>?next=
// (the route already honours ?next= + logs the landing_path), so a promoter of the
// launch page links off /launch, of the home page off /, of a product off /p/<slug>.

type ProductOption = {
  id: string;
  name: string;
  slug: string | null;
  commissionLabel: string | null;
};

type Mode = "page" | "custom" | "product";

const PROMOTABLE_PAGES: {
  path: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    path: "/",
    label: "Home",
    hint: "Wielo homepage",
    icon: <Home className="h-4 w-4" />,
  },
  {
    path: "/launch",
    label: "Launch",
    hint: "The launch / campaign page",
    icon: <Rocket className="h-4 w-4" />,
  },
  {
    path: "/pitch",
    label: "Become a host",
    hint: "The host sales pitch",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    path: "/explore",
    label: "Explore stays",
    hint: "Browse all listings",
    icon: <Search className="h-4 w-4" />,
  },
  {
    path: "/deals",
    label: "Deals",
    hint: "Current specials",
    icon: <Tag className="h-4 w-4" />,
  },
  {
    path: "/looking-for",
    label: "Looking for",
    hint: "Guest requests board",
    icon: <Globe className="h-4 w-4" />,
  },
  {
    path: "/signup",
    label: "Sign up",
    hint: "Create an account",
    icon: <UserPlus className="h-4 w-4" />,
  },
];

function buildLink(baseUrl: string, slug: string, dest: string): string {
  const clean = dest.trim();
  if (!clean || clean === "/") return `${baseUrl}/r/${slug}`;
  return `${baseUrl}/r/${slug}?next=${encodeURIComponent(clean)}`;
}

export function AffiliateLinkBuilder({
  baseUrl,
  slug,
  products,
}: {
  baseUrl: string;
  slug: string;
  products: ProductOption[];
}) {
  const [mode, setMode] = useState<Mode>("page");
  const [pagePath, setPagePath] = useState("/launch");
  const [customPath, setCustomPath] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrWrap = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((p) => p.id === productId);

  // The chosen destination path per mode (custom is validated on-site).
  const customValid = customPath.trim().startsWith("/");
  const dest = useMemo(() => {
    if (mode === "custom") return customValid ? customPath.trim() : "";
    if (mode === "product")
      return selectedProduct?.slug ? `/p/${selectedProduct.slug}` : "/";
    return pagePath;
  }, [mode, customPath, customValid, selectedProduct, pagePath]);

  const link = buildLink(baseUrl, slug, dest);
  const display = link.replace(/^https?:\/\//, "");
  const linkReady = mode !== "custom" || customValid;

  const destLabel = useMemo(() => {
    if (mode === "product") return selectedProduct?.name ?? "a product";
    if (mode === "custom") return customPath.trim() || "a page";
    return PROMOTABLE_PAGES.find((p) => p.path === pagePath)?.label ?? "a page";
  }, [mode, selectedProduct, customPath, pagePath]);

  const shareText = `Check this out on Wielo: ${link}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(
    "Something for you on Wielo",
  )}&body=${encodeURIComponent(shareText)}`;

  async function copy() {
    if (!linkReady) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  function downloadQr() {
    const canvas = qrWrap.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `wielo-affiliate-${slug}.png`;
    a.click();
    toast.success("QR code downloaded");
  }

  const tab = (m: Mode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setShowQr(false);
      }}
      className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
        mode === m
          ? "bg-brand-primary text-white shadow-sm"
          : "border border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        <Wand2 className="h-3.5 w-3.5 text-brand-primary" />
        Build a link for any page or product
      </div>
      <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-brand-mute">
        Promote anything on Wielo with your code attached. Pick a page, paste
        any link, or choose a product — you still get credit for every signup
        and sale.
      </p>

      {/* Mode tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {tab("page", "Popular pages", <Globe className="h-3.5 w-3.5" />)}
        {tab("custom", "Any page", <Wand2 className="h-3.5 w-3.5" />)}
        {tab("product", "A product", <Package className="h-3.5 w-3.5" />)}
      </div>

      {/* Destination picker */}
      <div className="mt-4">
        {mode === "page" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {PROMOTABLE_PAGES.map((p) => (
              <button
                key={p.path}
                type="button"
                onClick={() => setPagePath(p.path)}
                className={`flex items-start gap-2.5 rounded-[11px] border p-3 text-left transition ${
                  pagePath === p.path
                    ? "border-brand-primary bg-brand-light"
                    : "border-brand-line bg-white hover:border-brand-accent hover:bg-brand-light"
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 ${
                    pagePath === p.path
                      ? "text-brand-primary"
                      : "text-brand-mute"
                  }`}
                >
                  {p.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-brand-ink">
                    {p.label}
                  </span>
                  <span className="block truncate text-[11px] text-brand-mute">
                    {p.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {mode === "custom" ? (
          <div>
            <label className="text-[11px] font-semibold text-brand-mute">
              On-site path (starts with /)
            </label>
            <input
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="/property/sea-view-cottage"
              spellCheck={false}
              className="mt-1.5 w-full rounded-[11px] border border-brand-line bg-brand-light px-3.5 py-2.5 font-mono text-[13px] text-brand-ink outline-none focus:border-brand-primary"
            />
            {customPath.trim() && !customValid ? (
              <p className="mt-1.5 text-[11.5px] font-medium text-rose-600">
                Enter a path that starts with “/” — e.g. /explore or
                /property/your-listing.
              </p>
            ) : (
              <p className="mt-1.5 text-[11.5px] text-brand-mute">
                Copy the part after the domain from any Wielo page and paste it
                here.
              </p>
            )}
          </div>
        ) : null}

        {mode === "product" ? (
          products.length === 0 ? (
            <div className="rounded-[11px] border border-dashed border-brand-line bg-brand-light p-4 text-center text-[12.5px] text-brand-mute">
              No products are live to promote yet.
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-semibold text-brand-mute">
                Product
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="mt-1.5 w-full rounded-[11px] border border-brand-line bg-white px-3.5 py-2.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.commissionLabel
                      ? ` — you earn ${p.commissionLabel}`
                      : ""}
                  </option>
                ))}
              </select>
              {selectedProduct && !selectedProduct.slug ? (
                <p className="mt-1.5 text-[11.5px] text-brand-mute">
                  This product has no public page yet — the link lands on the
                  homepage with your code attached.
                </p>
              ) : null}
            </div>
          )
        ) : null}
      </div>

      {/* Generated link */}
      <div className="mt-4 border-t border-brand-line pt-4">
        <div className="text-[11px] font-semibold text-brand-mute">
          Your link for {destLabel}
        </div>
        <div className="mt-2 flex h-12 items-center gap-2.5 rounded-[11px] border border-brand-accent bg-brand-light pl-4 pr-1.5">
          <Globe className="h-4 w-4 shrink-0 text-brand-mute" />
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-brand-ink">
            {linkReady ? display : "Enter a valid path above…"}
          </span>
          <button
            type="button"
            onClick={copy}
            disabled={!linkReady}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            disabled={!linkReady}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
          >
            <QrCode className="h-3.5 w-3.5" /> {showQr ? "Hide QR" : "QR code"}
          </button>
          <a
            href={linkReady ? waHref : undefined}
            aria-disabled={!linkReady}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink ${
              linkReady ? "" : "pointer-events-none opacity-50"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <a
            href={linkReady ? mailHref : undefined}
            aria-disabled={!linkReady}
            className={`inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink ${
              linkReady ? "" : "pointer-events-none opacity-50"
            }`}
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </a>
        </div>

        {showQr && linkReady ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-[12px] border border-brand-line bg-[#FAFCFB] p-5 sm:flex-row sm:items-center">
            <div
              ref={qrWrap}
              className="rounded-[10px] border border-brand-line bg-white p-2.5"
            >
              <QRCodeCanvas
                value={link}
                size={132}
                level="M"
                marginSize={1}
                fgColor="#0F3D2E"
              />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[13px] font-semibold text-brand-ink">
                Scan to open your link
              </p>
              <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-brand-mute">
                Great for print, business cards or a phone-to-phone share. The
                scan carries your affiliate code.
              </p>
              <button
                type="button"
                onClick={downloadQr}
                className="mt-2.5 inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
              >
                <Download className="h-3.5 w-3.5" /> Download PNG
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
