"use client";

import { useEffect } from "react";

/**
 * Injects a page's custom head code (meta tags / verification / tracking
 * snippets, set in Page settings) into <head> on mount, and removes it on
 * unmount so client navigation between pages doesn't leak one page's code onto
 * the next. Scripts parsed from innerHTML do NOT execute, so we recreate
 * <script> nodes (copying attributes + body) to run them — matching how a CMS
 * "header code injection" box behaves. Rendered on the LIVE site only (never in
 * the builder preview), the same gate as the pixel/analytics.
 */
export function PageHeadCode({ html }: { html: string }) {
  useEffect(() => {
    const code = html.trim();
    if (!code) return;
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
        document.head.appendChild(script);
        added.push(script);
      } else {
        const clone = node.cloneNode(true);
        document.head.appendChild(clone);
        added.push(clone);
      }
    });
    return () => {
      for (const node of added) node.parentNode?.removeChild(node);
    };
  }, [html]);
  return null;
}
