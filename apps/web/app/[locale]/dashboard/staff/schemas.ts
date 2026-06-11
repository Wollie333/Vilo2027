import { z } from "zod";

export const STAFF_ROLES = [
  {
    value: "co_host" as const,
    label: "Co-host",
    body: "Full operational access — bookings, listings, inbox.",
  },
  {
    value: "cleaner" as const,
    label: "Cleaner",
    body: "Sees the calendar and updates blocked dates.",
  },
  {
    value: "assistant" as const,
    label: "Assistant",
    body: "Handles bookings and inbox replies.",
  },
];

export type StaffRole = (typeof STAFF_ROLES)[number]["value"];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  co_host: "Co-host",
  cleaner: "Cleaner",
  assistant: "Assistant",
};

export const inviteStaffSchema = z.object({
  email: z.string().trim().email("Must be a valid email."),
  role: z.enum(["co_host", "cleaner", "assistant"]),
});
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const updateStaffRoleSchema = z.object({
  role: z.enum(["co_host", "cleaner", "assistant"]),
});
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;
