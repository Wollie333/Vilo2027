import { z } from "zod";

import { passwordSchema } from "@/lib/auth/password";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address."),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((value) => value === true, {
      message: "You must accept the terms to continue.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const magicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
