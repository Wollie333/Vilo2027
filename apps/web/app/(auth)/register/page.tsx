import type { Metadata } from "next";
import { Suspense } from "react";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create your account · Vilo",
  description: "Sign up to start managing direct bookings with Vilo.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
