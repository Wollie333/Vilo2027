"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// The emerald "Copy" button in the referral copyfield. Kept tiny + reusable so
// the referral card + link builder can stay server-rendered around it.
export function CopyLinkButton({
  value,
  className = "btn-pri h-9 px-4",
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" /> Copy
        </>
      )}
    </button>
  );
}
