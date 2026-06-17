"use client";

import {
  BarChart3,
  BedDouble,
  Cable,
  CalendarCheck,
  Calendar as CalendarIcon,
  CalendarRange,
  CreditCard,
  FileMinus,
  FileText,
  Home as HomeIcon,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  MessageSquare,
  PackagePlus,
  Receipt,
  RotateCcw,
  RotateCw,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type Route = {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
};

const MAIN: Route[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    keywords: ["home", "dashboard"],
  },
  {
    href: "/dashboard/bookings",
    label: "Bookings",
    icon: CalendarCheck,
    keywords: ["reservations", "guests"],
  },
  {
    href: "/dashboard/inbox",
    label: "Inbox",
    icon: MessageSquare,
    keywords: ["messages", "chat"],
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: CalendarIcon,
    keywords: ["dates", "availability"],
  },
  {
    href: "/dashboard/properties",
    label: "Listings",
    icon: HomeIcon,
    keywords: ["properties", "homes"],
  },
  { href: "/dashboard/rooms", label: "Rooms", icon: BedDouble },
  {
    href: "/dashboard/seasonal-pricing",
    label: "Seasonal pricing",
    icon: CalendarRange,
    keywords: ["rates", "pricing"],
  },
  {
    href: "/dashboard/reviews",
    label: "Reviews",
    icon: Star,
    keywords: ["ratings", "feedback"],
  },
  {
    href: "/dashboard/payments",
    label: "Payments",
    icon: CreditCard,
    keywords: ["payouts", "money"],
  },
];

const CONNECT: Route[] = [
  {
    href: "/dashboard/channels",
    label: "Channels",
    icon: Cable,
    keywords: ["airbnb", "booking.com"],
  },
  {
    href: "/dashboard/calendar-sync",
    label: "Calendar sync",
    icon: RotateCw,
    keywords: ["ical", "import"],
  },
  {
    href: "/dashboard/staff",
    label: "Staff",
    icon: Users,
    keywords: ["team", "co-host"],
  },
];

const TOOLS: Route[] = [
  { href: "/dashboard/quotes", label: "Quotes", icon: FileText },
  {
    href: "/dashboard/invoices",
    label: "Invoices",
    icon: Receipt,
    keywords: ["billing"],
  },
  {
    href: "/dashboard/credit-notes",
    label: "Credit Notes",
    icon: FileMinus,
    keywords: ["refund", "credit", "billing"],
  },
  {
    href: "/dashboard/addons",
    label: "Add-ons",
    icon: PackagePlus,
    keywords: ["extras", "upsell"],
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
    keywords: ["analytics", "metrics"],
  },
  {
    href: "/dashboard/refunds",
    label: "Refunds",
    icon: RotateCcw,
    keywords: ["money back"],
  },
];

const SETTINGS: Route[] = [
  {
    href: "/dashboard/settings",
    label: "Account settings",
    icon: Settings,
    keywords: ["profile"],
  },
  { href: "/dashboard/settings/host", label: "Host profile", icon: Settings },
  {
    href: "/dashboard/settings/banking",
    label: "Banking",
    icon: CreditCard,
    keywords: ["eft", "bank"],
  },
  {
    href: "/dashboard/settings/subscription",
    label: "Subscription & plan",
    icon: Lock,
    keywords: ["upgrade", "plan"],
  },
  {
    href: "/dashboard/settings/data",
    label: "Privacy & data",
    icon: Lock,
    keywords: ["popia", "export", "delete account"],
  },
  {
    href: "/dashboard/help",
    label: "Help & docs",
    icon: LifeBuoy,
    keywords: ["support"],
  },
];

type PaletteCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const QuickNavCtx = React.createContext<PaletteCtx | null>(null);

export function useQuickNav() {
  const ctx = React.useContext(QuickNavCtx);
  if (!ctx)
    throw new Error("useQuickNav must be used inside <QuickNavProvider>");
  return ctx;
}

export function QuickNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <QuickNavCtx.Provider value={{ open, setOpen }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a page — try 'refunds', 'bookings', 'banking'…" />
        <CommandList>
          <CommandEmpty>No matching pages.</CommandEmpty>

          <CommandGroup heading="Main">
            {MAIN.map((r) => (
              <CommandItem
                key={r.href}
                value={[r.label, ...(r.keywords ?? [])].join(" ")}
                onSelect={() => go(r.href)}
              >
                <r.icon className="text-brand-mute" />
                <span>{r.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Connect">
            {CONNECT.map((r) => (
              <CommandItem
                key={r.href}
                value={[r.label, ...(r.keywords ?? [])].join(" ")}
                onSelect={() => go(r.href)}
              >
                <r.icon className="text-brand-mute" />
                <span>{r.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Tools">
            {TOOLS.map((r) => (
              <CommandItem
                key={r.href}
                value={[r.label, ...(r.keywords ?? [])].join(" ")}
                onSelect={() => go(r.href)}
              >
                <r.icon className="text-brand-mute" />
                <span>{r.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Settings">
            {SETTINGS.map((r) => (
              <CommandItem
                key={r.href}
                value={[r.label, ...(r.keywords ?? [])].join(" ")}
                onSelect={() => go(r.href)}
              >
                <r.icon className="text-brand-mute" />
                <span>{r.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </QuickNavCtx.Provider>
  );
}
