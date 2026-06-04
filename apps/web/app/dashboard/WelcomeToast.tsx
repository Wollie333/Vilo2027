"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";

export function WelcomeToast() {
  const brandName = useBrandName();
  useEffect(() => {
    toast.success(`Welcome to ${brandName}! Your host profile is live.`);
  }, [brandName]);
  return null;
}
