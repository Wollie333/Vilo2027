"use client";

import { Check, Copy, Globe } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Domain chip in the editor header (left of the Preview button): shows the
 * site's public domain and, on click, copies the live URL to the clipboard AND
 * opens the live site in a new tab. Uses the custom domain when connected,
 * otherwise the subdomain on the platform root.
 */
export function DomainBar({
  subdomain,
  customDomain,
  root,
}: {
  subdomain: string;
  customDomain: string | null;
  root: string;
}) {
  const [copied, setCopied] = useState(false);
  const domain = customDomain?.trim() || `${subdomain}.${root}`;
  const liveUrl = `https://${domain}`;

  async function onClick() {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      toast.success("Link copied", { description: domain });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy the link");
    }
    // Open the live site in a new tab.
    window.open(liveUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-ghost btn-sm"
      title={`Copy ${liveUrl} and open the live site`}
      style={{ maxWidth: 280 }}
    >
      <Globe style={{ width: 15, height: 15, color: "var(--mute)" }} />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {domain}
      </span>
      {copied ? (
        <Check style={{ width: 14, height: 14, color: "#10B981" }} />
      ) : (
        <Copy style={{ width: 14, height: 14, color: "var(--mute)" }} />
      )}
    </button>
  );
}
