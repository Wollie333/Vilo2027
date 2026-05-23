import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Vilo",
  description: "Sign in to manage your listings, bookings, and guests.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { verify?: string };
}) {
  const justRegistered = searchParams?.verify === "1";
  return <LoginForm justRegistered={justRegistered} />;
}
