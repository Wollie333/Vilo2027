"use client";

import { Baby, Check, Dog, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCurrency } from "@/components/currency/CurrencyProvider";

// Surfaces the host's children / infants / pets settings (allowed + per-night
// price + age bands) as small chips. Purely presentational; drops into existing
// sections without changing the listing layout.

export type Suitability = {
  allowChildren: boolean;
  allowInfants: boolean;
  allowPets: boolean;
  childPrice: number;
  infantPrice: number;
  petFee: number;
  infantMaxAge: number;
  childMaxAge: number;
  currency: string;
};

function Chip({
  ok,
  icon: Icon,
  children,
}: {
  ok: boolean;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-medium ${
        ok
          ? "border-brand-line bg-brand-light/60 text-brand-ink"
          : "border-brand-line bg-white text-brand-mute"
      }`}
    >
      <Icon className="h-3.5 w-3.5 text-brand-primary" />
      {children}
      {ok ? (
        <Check className="h-3 w-3 text-brand-primary" />
      ) : (
        <X className="h-3 w-3 text-brand-mute" />
      )}
    </span>
  );
}

export function SuitabilityChips({ s }: { s: Suitability }) {
  const t = useTranslations("listing");
  // Browse-context prices → show in the viewer's display currency (≈ estimate for
  // a converted ZAR amount). formatFrom mirrors <Money> for string interpolation.
  const { formatFrom } = useCurrency();
  const price = (amount: number) => formatFrom(amount, s.currency);
  const childLabel = s.allowChildren
    ? s.childPrice > 0
      ? t("suitChildrenPriced", { price: price(s.childPrice) })
      : t("suitChildren")
    : t("suitAdultsOnly");
  const infantLabel = s.allowInfants
    ? s.infantPrice > 0
      ? t("suitInfantsPriced", { price: price(s.infantPrice) })
      : t("suitInfantsFree")
    : t("suitNoInfants");
  const petLabel = s.allowPets
    ? s.petFee > 0
      ? t("suitPetsPriced", { price: price(s.petFee) })
      : t("suitPets")
    : t("suitNoPets");

  // Age bands, built from the parts that apply (adults always shown).
  const ageParts: string[] = [];
  if (s.allowInfants)
    ageParts.push(t("suitAgesInfants", { max: s.infantMaxAge }));
  if (s.allowChildren)
    ageParts.push(
      t("suitAgesChildren", { min: s.infantMaxAge + 1, max: s.childMaxAge }),
    );
  ageParts.push(t("suitAgesAdults", { min: s.childMaxAge + 1 }));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip ok={s.allowChildren} icon={Users}>
          {childLabel}
        </Chip>
        <Chip ok={s.allowInfants} icon={Baby}>
          {infantLabel}
        </Chip>
        <Chip ok={s.allowPets} icon={Dog}>
          {petLabel}
        </Chip>
      </div>
      {s.allowChildren || s.allowInfants ? (
        <p className="mt-2 text-[12px] text-brand-mute">
          {ageParts.join(" · ")}.
        </p>
      ) : null}
    </div>
  );
}
