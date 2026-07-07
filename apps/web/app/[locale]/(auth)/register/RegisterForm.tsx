"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

import { registerAction } from "../actions";
import { registerSchema, type RegisterInput } from "../schemas";

export function RegisterForm() {
  const [isPending, startTransition] = useTransition();
  const params = useSearchParams();
  const prefillEmail = params.get("email") ?? "";
  const next = params.get("next");
  const inviteToken = params.get("invite_token");
  const fromInvite = Boolean(inviteToken && prefillEmail);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: prefillEmail,
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  function onSubmit(values: RegisterInput) {
    startTransition(async () => {
      const result = await registerAction(values, next);
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  const signInHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader className="space-y-2 pb-4 text-center">
        <CardTitle className="font-display text-2xl font-bold tracking-tight text-brand-ink">
          {fromInvite ? "Accept your invite" : "Create your account"}
        </CardTitle>
        <CardDescription className="text-brand-mute">
          {fromInvite
            ? "Set a password to finish joining the team."
            : "Manage your listings, calendars, and bookings in one place."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      disabled={isPending || fromInvite}
                      readOnly={fromInvite}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <PasswordStrengthMeter
                    password={field.value ?? ""}
                    email={form.getValues("email")}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 space-y-0 pt-1">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-tight">
                    <FormLabel className="text-sm font-normal text-brand-ink">
                      I agree to the{" "}
                      <Link
                        href="/terms"
                        className="font-medium text-brand-primary hover:underline"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy"
                        className="font-medium text-brand-primary hover:underline"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-center text-sm text-brand-mute">
          Already have an account?{" "}
          <Link
            href={signInHref}
            className="font-medium text-brand-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
