import type { Metadata } from "next";

import { safeNextPath } from "@/lib/auth/safeNext";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your listings, bookings, and guests.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { verify?: string; next?: string };
}) {
  const justRegistered = searchParams?.verify === "1";
  const next = safeNextPath(searchParams?.next);
  return <LoginForm justRegistered={justRegistered} next={next} />;
}
