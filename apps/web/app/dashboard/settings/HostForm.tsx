"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, ExternalLink, Save } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
import { Textarea } from "@/components/ui/textarea";

import { saveHostAction } from "./actions";
import { hostSchema, type HostInput } from "./schemas";

export function HostForm({
  defaults,
  handle,
  isVerified,
}: {
  defaults: HostInput;
  handle: string;
  isVerified: boolean;
}) {
  const [pending, start] = useTransition();
  const form = useForm<HostInput>({
    resolver: zodResolver(hostSchema),
    defaultValues: defaults,
  });

  function onSubmit(values: HostInput) {
    start(async () => {
      const result = await saveHostAction(values);
      if (result.ok) toast.success("Host page saved");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-3 text-brand-mute">
          <span className="font-mono text-brand-ink">
            viloplatform.com/{handle}
          </span>
          {isVerified ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified host
            </span>
          ) : null}
          <Link
            href={`/${handle}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
          >
            View public
            <ExternalLink className="h-3 w-3" />
          </Link>
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
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Karoo Cottages"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-brand-mute">
                    Shown on every listing card and your host page. Changing
                    this doesn&rsquo;t change your URL handle.
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Bio{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Tell guests who you are and what makes your stays special."
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
              name="website_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Website{" "}
                    <span className="font-normal text-brand-mute">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://karoocottages.co.za"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={pending} className="gap-1.5">
                <Save className="h-4 w-4" />
                {pending ? "Saving…" : "Save host page"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
