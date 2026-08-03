"use server";

import { z } from "zod";

import {
  applyBookingDateChange,
  previewDateChangeCore,
  type ActionResult,
  type ChangeDatesPreview,
} from "@/lib/bookings/change-dates-core";
import { assertFullHost as requireHost } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";

// Thin host-authored wrappers around the shared date-change core
// (@/lib/bookings/change-dates-core). requireHost() gates the caller; the core
// does the work with the service-role client. The guest counter-offer accept
// path calls the core directly (host derived from the request row).

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const previewSchema = z.object({
  bookingId: z.string().uuid(),
  checkIn: z.string().regex(ISO),
  checkOut: z.string().regex(ISO),
});

export async function previewChangeDatesAction(input: {
  bookingId: string;
  checkIn: string;
  checkOut: string;
}): Promise<ChangeDatesPreview> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const host = await requireHost();
  if (!host.ok) return { ok: false, error: host.error };
  const admin = createAdminClient();
  return previewDateChangeCore(
    admin,
    parsed.data.bookingId,
    host.hostId,
    parsed.data.checkIn,
    parsed.data.checkOut,
  );
}

const applySchema = z.object({
  bookingId: z.string().uuid(),
  checkIn: z.string().regex(ISO),
  checkOut: z.string().regex(ISO),
  total: z.number().min(0).max(100_000_000),
});

export async function changeBookingDatesAction(input: {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  total: number;
}): Promise<ActionResult> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const host = await requireHost();
  if (!host.ok) return { ok: false, error: host.error };
  const admin = createAdminClient();
  return applyBookingDateChange(admin, {
    bookingId: parsed.data.bookingId,
    hostId: host.hostId,
    checkIn: parsed.data.checkIn,
    checkOut: parsed.data.checkOut,
    total: parsed.data.total,
  });
}
