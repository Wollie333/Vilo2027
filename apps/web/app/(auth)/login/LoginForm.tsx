"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { loginAction, magicLinkAction } from "../actions";
import {
  loginSchema,
  magicLinkSchema,
  type LoginInput,
  type MagicLinkInput,
} from "../schemas";

export function LoginForm({ justRegistered }: { justRegistered: boolean }) {
  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader className="space-y-2 pb-4 text-center">
        <CardTitle className="font-display text-2xl font-bold tracking-tight text-brand-ink">
          Welcome back
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Sign in to manage your listings and bookings.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {justRegistered ? (
          <div className="mb-5 rounded border border-brand-line bg-brand-accent/60 px-4 py-3 text-sm text-brand-ink">
            Check your inbox to verify your email, then sign in below.
          </div>
        ) : null}

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic">Magic link</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="mt-5">
            <PasswordPane />
          </TabsContent>

          <TabsContent value="magic" className="mt-5">
            <MagicLinkPane />
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-sm text-brand-mute">
          Don&rsquo;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-brand-primary hover:underline"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function PasswordPane() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginInput) {
    startTransition(async () => {
      const result = await loginAction(values);
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" size="lg" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}

function MagicLinkPane() {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: MagicLinkInput) {
    startTransition(async () => {
      const result = await magicLinkAction(values);
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      setSentTo(values.email);
    });
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <div className="rounded border border-brand-line bg-brand-accent/60 px-4 py-3 text-sm text-brand-ink">
          If an account exists for <strong>{sentTo}</strong>, a sign-in link is
          on its way. It expires in 1 hour.
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            setSentTo(null);
            form.reset();
          }}
        >
          Send another link
        </Button>
      </div>
    );
  }

  return (
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
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" size="lg" disabled={isPending}>
          {isPending ? "Sending…" : "Email me a sign-in link"}
        </Button>

        <p className="text-center text-xs text-brand-mute">
          We&rsquo;ll send a one-time link to existing accounts only.
        </p>
      </form>
    </Form>
  );
}
