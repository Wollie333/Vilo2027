"use client";

import {
  Heart,
  LogOut,
  Luggage,
  MessageSquare,
  Menu,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";

import { signOutAction } from "@/app/[locale]/(auth)/actions";
import { BrandName, useBrandName } from "@/components/brand/BrandProvider";
import { createClient } from "@/lib/supabase/client";

import { UtilityBar } from "./UtilityBar";
import { VLogo } from "./VLogo";

const NAV = [
  { href: "#destinations", key: "destinations" },
  { href: "#types", key: "propertyTypes" },
  { href: "/deals", key: "deals" },
  { href: "/looking-for", key: "guestRequests" },
  // "For hosts" (/booking-management) is hidden for now.
  { href: "/launch", key: "launch" },
] as const;

type Session = {
  kind: "guest" | "host" | "admin";
  displayName: string;
  avatarUrl: string | null;
  email: string;
} | null;

export function SiteHeader() {
  const brand = useBrandName();
  const t = useTranslations("nav");
  const [elevated, setElevated] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onScroll() {
      setElevated(window.scrollY > 520);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Resolve the session role purely on the client. Tiny extra round-trip on
  // first paint, but it lets SiteHeader stay a single client component that
  // every page can drop in without prop changes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) {
        setSession(null);
        return;
      }
      const [{ data: host }, { data: staff }, { data: profile }] =
        await Promise.all([
          supabase
            .from("hosts")
            .select("id")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .maybeSingle(),
          supabase
            .from("platform_staff")
            .select("is_active")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("user_profiles")
            .select("full_name, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),
        ]);
      if (cancelled) return;
      const kind: "guest" | "host" | "admin" = staff?.is_active
        ? "admin"
        : host
          ? "host"
          : "guest";
      setSession({
        kind,
        displayName: profile?.full_name ?? user.email ?? "You",
        avatarUrl: profile?.avatar_url ?? null,
        email: user.email ?? "",
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the avatar menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  return (
    <>
      {/* UtilityBar (black top strip) hidden for now — re-enable when needed. */}
      {false ? <UtilityBar /> : null}
      <header
        ref={headerRef}
        className={`sticky top-0 z-40 border-b border-brand-line bg-white/90 backdrop-blur transition-shadow ${
          elevated ? "nav-elevated" : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 lg:px-8">
          <Link
            href="/"
            aria-label={`${brand} home`}
            className="flex shrink-0 items-center gap-2.5"
          >
            <VLogo size={36} gradientId="home-nav-logo" />
            <div className="leading-none">
              <div className="font-display text-[18px] font-bold tracking-tight text-brand-ink">
                <BrandName />
              </div>
              <div className="mt-0.5 hidden text-[10px] text-brand-mute sm:block">
                {t("brandTagline")}
              </div>
            </div>
          </Link>

          <button
            type="button"
            aria-label="Search stays"
            className={`hidden items-center gap-2 rounded-pill border border-brand-line bg-white py-1.5 pl-4 pr-1.5 text-sm text-brand-mute transition-shadow hover:shadow-card md:flex ${
              elevated ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <span className="font-medium text-brand-ink">
              {t("searchAnywhere")}
            </span>
            <span className="h-4 w-px bg-brand-line" />
            <span>{t("searchAnyWeek")}</span>
            <span className="h-4 w-px bg-brand-line" />
            <span>{t("searchGuests")}</span>
            <span className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white">
              <Search className="h-4 w-4" />
            </span>
          </button>

          <nav className="ml-auto hidden items-center gap-6 text-sm text-brand-mute lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 whitespace-nowrap hover:text-brand-ink"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {session ? (
              <UserMenu
                session={session}
                open={menuOpen}
                setOpen={setMenuOpen}
                ref={menuRef}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="hidden items-center gap-1.5 rounded px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent md:inline-flex"
                >
                  <Heart className="h-4 w-4" />
                  {t("saved")}
                </button>
                <Link
                  href="/login"
                  className="hidden rounded px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent md:inline-flex"
                >
                  {t("signIn")}
                </Link>
                <Link
                  href="/signup"
                  className="hidden items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary sm:inline-flex"
                >
                  {t("join", { brand })}
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? "Close menu" : "Open menu"}
              aria-expanded={navOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-brand-line bg-white text-brand-ink transition-shadow hover:shadow-card lg:hidden"
            >
              {navOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile / tablet nav — the desktop <nav> is lg:flex, so below 1024px
            this drop panel is the only way to reach the menu. */}
        {navOpen ? (
          <div className="border-t border-brand-line bg-white lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col px-5 py-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  className="rounded px-2 py-3 text-[15px] font-medium text-brand-ink hover:bg-brand-accent"
                >
                  {t(item.key)}
                </Link>
              ))}

              {!session ? (
                <div className="mt-2 flex flex-col gap-2 border-t border-brand-line pt-3 sm:hidden">
                  <Link
                    href="/login"
                    onClick={() => setNavOpen(false)}
                    className="rounded border border-brand-line px-4 py-2.5 text-center text-sm font-medium text-brand-ink hover:bg-brand-accent"
                  >
                    {t("signIn")}
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setNavOpen(false)}
                    className="rounded bg-brand-primary px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-secondary"
                  >
                    {t("join", { brand })}
                  </Link>
                </div>
              ) : null}
            </nav>
          </div>
        ) : null}
      </header>
    </>
  );
}

const UserMenu = forwardRef<
  HTMLDivElement,
  {
    session: NonNullable<Session>;
    open: boolean;
    setOpen: (v: boolean) => void;
  }
>(function UserMenuInner({ session, open, setOpen }, ref) {
  const initials = session.displayName.slice(0, 2).toUpperCase();
  const homeHref =
    session.kind === "admin"
      ? "/admin"
      : session.kind === "host"
        ? "/dashboard"
        : "/portal";
  const tripsHref = session.kind === "guest" ? "/portal/trips" : homeHref;
  const inboxHref =
    session.kind === "guest" ? "/portal/inbox" : "/dashboard/inbox";
  const settingsHref =
    session.kind === "guest" ? "/portal/settings" : "/dashboard/settings";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-pill border border-brand-line bg-white py-1.5 pl-2 pr-3 text-sm font-medium text-brand-ink transition-shadow hover:shadow-card"
      >
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-brand-secondary text-[10px] font-bold text-white">
          {session.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.avatarUrl}
              alt={session.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </span>
        <span className="hidden max-w-[120px] truncate md:inline">
          {session.displayName.split(" ")[0]}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-card border border-brand-line bg-white shadow-lift"
        >
          <div className="border-b border-brand-line px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Signed in as
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-brand-ink">
              {session.displayName}
            </div>
            <div className="truncate text-[11px] text-brand-mute">
              {session.email}
            </div>
          </div>
          <div className="py-1">
            <MenuLink
              href={homeHref}
              icon={<User className="h-4 w-4" />}
              label={
                session.kind === "admin"
                  ? "Admin console"
                  : session.kind === "host"
                    ? "Host dashboard"
                    : "Portal overview"
              }
              onClick={() => setOpen(false)}
            />
            {session.kind === "guest" ? (
              <MenuLink
                href={tripsHref}
                icon={<Luggage className="h-4 w-4" />}
                label="My trips"
                onClick={() => setOpen(false)}
              />
            ) : null}
            <MenuLink
              href={inboxHref}
              icon={<MessageSquare className="h-4 w-4" />}
              label="Messages"
              onClick={() => setOpen(false)}
            />
            <MenuLink
              href={settingsHref}
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              onClick={() => setOpen(false)}
            />
          </div>
          <form action={signOutAction} className="border-t border-brand-line">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
});

function MenuLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-light"
    >
      {icon}
      {label}
    </Link>
  );
}
