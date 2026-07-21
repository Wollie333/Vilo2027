"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Save } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { changePasswordAction } from "./actions";
import { passwordSchema, type PasswordInput } from "./schemas";

export function PasswordCard() {
  const [pending, start] = useTransition();
  const form = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  function onSubmit(values: PasswordInput) {
    start(async () => {
      const result = await changePasswordAction(values);
      if (result.ok) {
        toast.success("Password changed");
        form.reset({
          current_password: "",
          new_password: "",
          confirm_password: "",
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2.5 border-b border-brand-line px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
          <KeyRound className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-brand-ink">
            Change password
          </h3>
          <p className="mt-0.5 text-xs text-brand-mute">
            At least 8 characters. You&rsquo;ll stay signed in on this device.
          </p>
        </div>
      </div>
      <div className="px-5 py-5">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="current_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      disabled={pending}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Change password"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
