"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CategoryPicker,
  type CategoryPickerLeaf,
} from "@/lib/taxonomy/CategoryPicker";

import { createListingAction } from "./actions";
import { newListingSchema, type NewListingInput } from "./schemas";

export function NewListingForm({
  categoryLeaves,
}: {
  categoryLeaves: CategoryPickerLeaf[];
}) {
  const [pending, start] = useTransition();
  const form = useForm<NewListingInput>({
    resolver: zodResolver(newListingSchema),
    defaultValues: {
      name: "",
      listing_type: "accommodation",
      category_id: undefined,
      accommodation_type: undefined,
    },
  });

  const selectedCategoryId = form.watch("category_id") ?? null;

  function onSubmit(values: NewListingInput) {
    const leaf = categoryLeaves.find((l) => l.id === values.category_id);
    start(async () => {
      const result = await createListingAction({
        ...values,
        accommodation_type: leaf?.slug ?? undefined,
      });
      if (result && !result.ok) {
        toast.error(result.error);
      }
      // Success path is a server-side redirect; nothing to do here.
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Basics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Listing name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Karoo Stargazer Cottage"
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
              name="category_id"
              render={() => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <CategoryPicker
                    leaves={categoryLeaves}
                    value={selectedCategoryId}
                    onChange={(leaf) => {
                      form.setValue("category_id", leaf.id, {
                        shouldValidate: true,
                      });
                    }}
                    disabled={pending}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="gap-1.5"
              >
                {pending ? "Creating…" : "Create draft"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
