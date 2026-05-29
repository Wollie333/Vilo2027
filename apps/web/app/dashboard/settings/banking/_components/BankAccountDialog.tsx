"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createBankAccountAction, updateBankAccountAction } from "../actions";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  SA_BANKS,
  bankAccountSchema,
  type BankAccountInput,
} from "../schemas";

export type EditingAccount = {
  id: string;
  label: string;
  bank_name: string;
  account_holder: string;
  account_number_last4: string;
  account_type: (typeof ACCOUNT_TYPES)[number];
  branch_code: string;
  swift_code: string | null;
  reference_format: string;
  is_default: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EditingAccount | null;
  hasExistingAccounts: boolean;
  /** Called after a successful create/update (e.g. to refresh a parent that
   *  holds its own copy of the accounts, like the setup wizard). */
  onChanged?: () => void;
};

const EMPTY_DEFAULTS: BankAccountInput = {
  label: "Primary",
  bank_select: "FNB",
  bank_name_other: "",
  account_holder: "",
  account_number: "",
  account_type: "cheque",
  branch_code: "",
  swift_code: "",
  reference_format: "VILO-{booking_ref}",
  is_default: false,
};

export function BankAccountDialog({
  open,
  onOpenChange,
  editing,
  hasExistingAccounts,
  onChanged,
}: Props) {
  const [pending, start] = useTransition();
  const form = useForm<BankAccountInput>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const known = SA_BANKS.includes(
        editing.bank_name as (typeof SA_BANKS)[number],
      );
      form.reset({
        label: editing.label,
        bank_select: known
          ? (editing.bank_name as (typeof SA_BANKS)[number])
          : "Other",
        bank_name_other: known ? "" : editing.bank_name,
        account_holder: editing.account_holder,
        account_number: "",
        account_type: editing.account_type,
        branch_code: editing.branch_code,
        swift_code: editing.swift_code ?? "",
        reference_format: editing.reference_format,
        is_default: editing.is_default,
      });
    } else {
      form.reset({
        ...EMPTY_DEFAULTS,
        is_default: !hasExistingAccounts,
      });
    }
  }, [open, editing, hasExistingAccounts, form]);

  const bankSelect = form.watch("bank_select");

  function onSubmit(values: BankAccountInput) {
    start(async () => {
      const result = editing
        ? await updateBankAccountAction(editing.id, values)
        : await createBankAccountAction(values);
      if (result.ok) {
        toast.success(editing ? "Bank account updated" : "Bank account added");
        onOpenChange(false);
        onChanged?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit bank account" : "Add a bank account"}
          </DialogTitle>
          <DialogDescription>
            Used on EFT payment instructions, invoices, and quotes. Account
            numbers are encrypted at rest.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="bank-account-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Primary"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="bank_select"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={pending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SA_BANKS.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={pending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ACCOUNT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {bankSelect === "Other" ? (
              <FormField
                control={form.control}
                name="bank_name_other"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. HSBC South Africa"
                        disabled={pending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="account_holder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account holder</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="As it appears on the bank statement"
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="account_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Account number{" "}
                      {editing ? (
                        <span className="font-normal text-brand-mute">
                          (leave blank to keep ••••
                          {editing.account_number_last4})
                        </span>
                      ) : null}
                    </FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="6 to 16 digits"
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
                name="branch_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch code</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="6-digit universal branch code"
                        disabled={pending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="swift_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      SWIFT / BIC{" "}
                      <span className="font-normal text-brand-mute">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="For international wires"
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
                name="reference_format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference format</FormLabel>
                    <FormControl>
                      <Input
                        disabled={pending}
                        placeholder="VILO-{booking_ref}"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-brand-mute">
                      <code className="rounded bg-brand-light px-1 py-0.5">
                        {"{booking_ref}"}
                      </code>{" "}
                      is replaced with the booking reference at payment time.
                    </p>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-card border border-brand-line bg-brand-light/40 p-3">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      disabled={pending}
                      className="h-4 w-4 rounded border-brand-line accent-brand-primary"
                    />
                  </FormControl>
                  <div className="flex-1">
                    <FormLabel className="!m-0 cursor-pointer">
                      Use as default account
                    </FormLabel>
                    <p className="text-xs text-brand-mute">
                      Appears on invoices, quotes, and the EFT instructions
                      shown to guests.
                    </p>
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="bank-account-form"
            disabled={pending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Add bank account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
