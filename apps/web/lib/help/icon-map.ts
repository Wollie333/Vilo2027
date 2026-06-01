import {
  Activity,
  Banknote,
  BedDouble,
  BookOpen,
  Cable,
  CalendarCheck,
  CalendarRange,
  Code2,
  CreditCard,
  FileText,
  HelpCircle,
  Home,
  LifeBuoy,
  MapPin,
  MessageSquare,
  PackagePlus,
  RotateCw,
  Search,
  ShieldCheck,
  Star,
  Ticket,
  UserCog,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export const HELP_ICON_MAP: Record<string, LucideIcon> = {
  activity: Activity,
  banknote: Banknote,
  "bed-double": BedDouble,
  "book-open": BookOpen,
  cable: Cable,
  "calendar-check": CalendarCheck,
  "calendar-range": CalendarRange,
  "code-2": Code2,
  "credit-card": CreditCard,
  "file-text": FileText,
  "help-circle": HelpCircle,
  home: Home,
  "life-buoy": LifeBuoy,
  "map-pin": MapPin,
  "message-square": MessageSquare,
  "package-plus": PackagePlus,
  "rotate-cw": RotateCw,
  search: Search,
  "shield-check": ShieldCheck,
  star: Star,
  ticket: Ticket,
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
