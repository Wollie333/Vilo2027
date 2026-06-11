import {
  Baby,
  Bike,
  Clock,
  Coffee,
  Croissant,
  Flame,
  Flower2,
  type LucideIcon,
  PawPrint,
  Plane,
  Sparkles,
  Sun,
  Utensils,
  Wine,
} from "lucide-react";

import { type AddonCategory, type PricingModel } from "./schemas";

/**
 * Ready-made add-on templates a host can add with one click — the extras most
 * South-African stays (guesthouses, B&Bs, lodges, self-catering) commonly
 * offer. Prices are sensible ZAR defaults the host can edit after adding.
 */
export type AddonTemplate = {
  key: string;
  name: string;
  description: string;
  category: AddonCategory;
  pricingModel: PricingModel;
  unitPrice: number;
  minQuantity: number;
  maxQuantity: number | null;
  leadTimeDays: number;
  icon: LucideIcon;
};

export const ADDON_TEMPLATES: AddonTemplate[] = [
  {
    key: "breakfast",
    name: "Breakfast hamper",
    description:
      "Fresh-baked pastries, seasonal fruit, free-range eggs, yoghurt and a pot of locally-roasted coffee — delivered to the room each morning.",
    category: "food_drink",
    pricingModel: "per_guest_per_night",
    unitPrice: 180,
    minQuantity: 1,
    maxQuantity: null,
    leadTimeDays: 1,
    icon: Croissant,
  },
  {
    key: "braai",
    name: "Braai pack for the grid",
    description:
      "Boerewors, lamb chops, sosaties, rolls and firelighters — everything for an evening braai, prepped for the number of guests.",
    category: "food_drink",
    pricingModel: "per_stay",
    unitPrice: 480,
    minQuantity: 1,
    maxQuantity: 5,
    leadTimeDays: 1,
    icon: Flame,
  },
  {
    key: "chef",
    name: "Private chef dinner",
    description:
      "A three-course dinner prepared at the property by a local chef — seasonal menu, vegetarian on request.",
    category: "food_drink",
    pricingModel: "per_night",
    unitPrice: 950,
    minQuantity: 1,
    maxQuantity: null,
    leadTimeDays: 2,
    icon: Utensils,
  },
  {
    key: "bubbly",
    name: "Welcome bubbly",
    description: "A bottle of South African MCC chilled and ready on arrival.",
    category: "romance",
    pricingModel: "per_stay",
    unitPrice: 350,
    minQuantity: 1,
    maxQuantity: 4,
    leadTimeDays: 1,
    icon: Wine,
  },
  {
    key: "massage",
    name: "In-room couples massage",
    description:
      "A 60-minute treatment for two with a local therapist, in the comfort of your room.",
    category: "romance",
    pricingModel: "per_stay",
    unitPrice: 1200,
    minQuantity: 1,
    maxQuantity: 2,
    leadTimeDays: 2,
    icon: Flower2,
  },
  {
    key: "firewood",
    name: "Firewood bundle",
    description:
      "Seasoned hardwood for the in-room fireplace or boma, stacked and ready on arrival.",
    category: "comfort",
    pricingModel: "per_stay",
    unitPrice: 120,
    minQuantity: 1,
    maxQuantity: 10,
    leadTimeDays: 0,
    icon: Flame,
  },
  {
    key: "housekeeping",
    name: "Daily housekeeping",
    description:
      "A mid-stay tidy with fresh towels and a bed refresh, once per day of your stay.",
    category: "comfort",
    pricingModel: "per_night",
    unitPrice: 200,
    minQuantity: 1,
    maxQuantity: null,
    leadTimeDays: 0,
    icon: Sparkles,
  },
  {
    key: "cot",
    name: "Cot / crib hire",
    description:
      "A clean travel cot with linen for little ones, set up before you arrive.",
    category: "comfort",
    pricingModel: "per_stay",
    unitPrice: 150,
    minQuantity: 1,
    maxQuantity: 3,
    leadTimeDays: 1,
    icon: Baby,
  },
  {
    key: "airport",
    name: "Airport transfer · return",
    description:
      "Door-to-door return transfer from the nearest airport, up to 4 passengers with luggage.",
    category: "transport",
    pricingModel: "per_stay",
    unitPrice: 850,
    minQuantity: 1,
    maxQuantity: 1,
    leadTimeDays: 2,
    icon: Plane,
  },
  {
    key: "bikes",
    name: "Mountain-bike hire",
    description:
      "A mountain bike with helmet per guest, per day, ready to ride.",
    category: "transport",
    pricingModel: "per_guest_per_night",
    unitPrice: 220,
    minQuantity: 1,
    maxQuantity: null,
    leadTimeDays: 1,
    icon: Bike,
  },
  {
    key: "early-checkin",
    name: "Early check-in",
    description:
      "Arrive from 10:00 instead of the standard check-in time, subject to availability.",
    category: "flexibility",
    pricingModel: "per_stay",
    unitPrice: 250,
    minQuantity: 1,
    maxQuantity: 1,
    leadTimeDays: 1,
    icon: Sun,
  },
  {
    key: "late-checkout",
    name: "Late checkout · 2pm",
    description:
      "Hold the room until 14:00 instead of the standard checkout, subject to next-day availability.",
    category: "flexibility",
    pricingModel: "per_stay",
    unitPrice: 250,
    minQuantity: 1,
    maxQuantity: 1,
    leadTimeDays: 0,
    icon: Clock,
  },
  {
    key: "pet",
    name: "Pet fee",
    description: "Bring your dog — covers the extra cleaning after your stay.",
    category: "flexibility",
    pricingModel: "per_stay",
    unitPrice: 200,
    minQuantity: 1,
    maxQuantity: null,
    leadTimeDays: 0,
    icon: PawPrint,
  },
  {
    key: "coffee",
    name: "Barista coffee pack",
    description:
      "Freshly-roasted local beans, a plunger and farm milk restocked daily for your stay.",
    category: "food_drink",
    pricingModel: "per_night",
    unitPrice: 90,
    minQuantity: 1,
    maxQuantity: null,
    leadTimeDays: 1,
    icon: Coffee,
  },
];
