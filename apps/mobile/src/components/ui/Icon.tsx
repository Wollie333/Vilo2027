import type { LucideIcon } from "lucide-react-native";
import { brand } from "@/theme/tokens";

// A lucide-react-native icon component (e.g. Bell, Search).
export type IconComponent = LucideIcon;

type Props = {
  icon: IconComponent;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/** Standardises size/colour/stroke for the design's Lucide icon set. */
export function Icon({
  icon: Cmp,
  size = 20,
  color = brand.ink,
  strokeWidth = 2,
}: Props) {
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
