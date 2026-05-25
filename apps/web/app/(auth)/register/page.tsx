import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "../_components/AuthShell";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create your account · Vilo",
  description: "Sign up to start managing direct bookings with Vilo.",
};

export default function RegisterPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
