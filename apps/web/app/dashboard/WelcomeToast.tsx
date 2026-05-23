"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function WelcomeToast() {
  useEffect(() => {
    toast.success("Welcome to Vilo! Your host profile is live.");
  }, []);
  return null;
}
