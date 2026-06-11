import { Baby, Check, Dog, Users, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { formatMoney } from "@/lib/format";

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

export async function SuitabilityChips({ s }: { s: Suitability }) {
  const t = await getTranslations("listing");
  const childLabel = s.allowChildren
    ? s.childPrice > 0
      ? t("suitChildrenPriced", {
          price: formatMoney(s.childPrice, s.currency),
        })
      : t("suitChildren")
    : t("suitAdultsOnly");
  const infantLabel = s.allowInfants
    ? s.infantPrice > 0
      ? t("suitInfantsPriced", {
          price: formatMoney(s.infantPrice, s.currency),
        })
      : t("suitInfantsFree")
    : t("suitNoInfants");
  const petLabel = s.allowPets
    ? s.petFee > 0
      ? t("suitPetsPriced", { price: formatMoney(s.petFee, s.currency) })
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
