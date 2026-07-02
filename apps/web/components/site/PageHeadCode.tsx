"use client";

import { useEffect } from "react";

import { useConsentGranted } from "@/lib/site/consent";

/**
 * Inject a page's custom code (meta tags / verification / tracking snippets, set
 * in Page settings → Custom code) into <head> or before </body> on mount, and
 * remove it on unmount so client navigation doesn't leak one page's code onto the
 * next. Scripts parsed from innerHTML do NOT execute, so we recreate <script>
 * nodes (copying attributes + body) to run them — matching how a CMS "code
 * injection" box behaves.
 *
 * Rendered on the LIVE site only (same gate as the pixels). Because these snippets
 * commonly set cookies, they are ALSO POPIA consent-gated: when the site requires
 * consent, nothing injects until the visitor accepts (re-runs on the shared
 * consent-change signal).
 */
function useInjectedSnippet(
  html: string,
  target: "head" | "body",
  consentRequired: boolean,
) {
  const granted = useConsentGranted(consentRequired);
  useEffect(() => {
    const code = html.trim();
    if (!code || !granted) return;
    const root = target === "head" ? document.head : document.body;
    const tpl = document.createElement("template");
    tpl.innerHTML = code;
    const added: Node[] = [];
    tpl.content.childNodes.forEach((node) => {
      if (node.nodeName === "SCRIPT") {
        const src = node as HTMLScriptElement;
        const script = document.createElement("script");
        for (const attr of Array.from(src.attributes)) {
          script.setAttribute(attr.name, attr.value);
        }
        script.textContent = src.textContent;
        root.appendChild(script);
        added.push(script);
      } else {
        const clone = node.cloneNode(true);
        root.appendChild(clone);
        added.push(clone);
      }
    });
    return () => {
      for (const node of added) node.parentNode?.removeChild(node);
    };
  }, [html, target, granted]);
}

export function PageHeadCode({
  html,
  consentRequired = true,
}: {
  html: string;
  consentRequired?: boolean;
}) {
  useInjectedSnippet(html, "head", consentRequired);
  return null;
}

export function PageBodyCode({
  html,
  consentRequired = true,
}: {
  html: string;
  consentRequired?: boolean;
}) {
  useInjectedSnippet(html, "body", consentRequired);
  return null;
}
