import { z } from "zod";

export const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Message can't be empty.")
    .max(4000, "Message is too long."),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const templateInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Give it a short name (2+ chars).")
    .max(60, "Title is too long."),
  body: z
    .string()
    .trim()
    .min(2, "Body can't be empty.")
    .max(2000, "Body is too long."),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export type TemplateInput = z.infer<typeof templateInputSchema>;
