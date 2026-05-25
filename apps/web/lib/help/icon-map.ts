import {
  Activity,
  Banknote,
  BookOpen,
  Cable,
  CalendarCheck,
  Code2,
  CreditCard,
  HelpCircle,
  Home,
  LifeBuoy,
  MessageSquare,
  RotateCw,
  Search,
  ShieldCheck,
  Star,
  UserCog,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export const HELP_ICON_MAP: Record<string, LucideIcon> = {
  activity: Activity,
  banknote: Banknote,
  "book-open": BookOpen,
  cable: Cable,
  "calendar-check": CalendarCheck,
  "code-2": Code2,
  "credit-card": CreditCard,
  "help-circle": HelpCircle,
  home: Home,
  "life-buoy": LifeBuoy,
  "message-square": MessageSquare,
  "rotate-cw": RotateCw,
  search: Search,
  "shield-check": ShieldCheck,
  star: Star,
  "user-cog": UserCog,
  users: Users,
  video: Video,
};

export const HELP_ICON_CHOICES: { value: string; label: string }[] =
  Object.keys(HELP_ICON_MAP)
    .sort()
    .map((value) => ({
      value,
      label: value
        .split("-")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" "),
    }));

export function resolveHelpIcon(name: string | null | undefined): LucideIcon {
  if (name && HELP_ICON_MAP[name]) return HELP_ICON_MAP[name];
  return BookOpen;
}
