import { Baby, Check, Dog, Users, X } from "lucide-react";

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

export function SuitabilityChips({ s }: { s: Suitability }) {
  const childLabel = s.allowChildren
    ? s.childPrice > 0
      ? `Children welcome — ${formatMoney(s.childPrice, s.currency)}/night`
      : "Children welcome"
    : "Adults only";
  const infantLabel = s.allowInfants
    ? s.infantPrice > 0
      ? `Infants — ${formatMoney(s.infantPrice, s.currency)}/night`
      : "Infants free"
    : "No infants";
  const petLabel = s.allowPets
    ? s.petFee > 0
      ? `Pets welcome — ${formatMoney(s.petFee, s.currency)}/night`
      : "Pets welcome"
    : "No pets";

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
          {s.allowInfants ? `Infants 0–${s.infantMaxAge}` : ""}
          {s.allowInfants && s.allowChildren ? " · " : ""}
          {s.allowChildren
            ? `Children ${s.infantMaxAge + 1}–${s.childMaxAge}`
            : ""}{" "}
          · adults {s.childMaxAge + 1}+.
        </p>
      ) : null}
    </div>
  );
}
