"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Save } from "lucide-react";
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
    defaultValues: { new_password: "", confirm_password: "" },
  });

  function onSubmit(values: PasswordInput) {
    start(async () => {
      const result = await changePasswordAction(values);
      if (result.ok) {
        toast.success("Password changed");
        form.reset({ new_password: "", confirm_password: "" });
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <KeyRound className="h-4 w-4 text-brand-mute" /> Change password
        </CardTitle>
        <CardDescription className="text-brand-mute">
          At least 8 characters. You&rsquo;ll stay signed in on this device.
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
      </CardContent>
    </Card>
  );
}
