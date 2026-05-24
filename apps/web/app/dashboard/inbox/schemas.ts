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
