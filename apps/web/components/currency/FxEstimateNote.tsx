"use client";

import { useTranslations } from "next-intl";

import { useCurrency } from "./CurrencyProvider";

// Inline clarifier shown ONLY when the displayed price actually differs from
// what will be charged. We only convert ZAR-settled listings, so that's exactly
// "settlement is ZAR AND the viewer picked a non-ZAR display currency". A non-ZAR
// settlement renders natively (shown == charged) → no note. Renders nothing
// otherwise, so it's safe to drop in unconditionally.
export function FxEstimateNote({
  settlementCurrency = "ZAR",
  className,
}: {
  settlementCurrency?: string;
  className?: string;
}) {
  const { currency } = useCurrency();
  const t = useTranslations("currency");
  if (settlementCurrency !== "ZAR" || currency === "ZAR") return null;
  return (
    <p className={className}>
      {t("estimateNote", { display: currency, settlement: settlementCurrency })}
    </p>
  );
}
