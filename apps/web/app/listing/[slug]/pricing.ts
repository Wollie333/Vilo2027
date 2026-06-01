// The discount maths moved to the canonical pricing engine at @/lib/pricing.
// This file is kept as a thin re-export so existing imports keep working.
export {
  applyStayDiscounts,
  type StayDiscount,
  type StayDiscountInput,
} from "@/lib/pricing/discounts";
