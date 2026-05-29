"use client";

import { Landmark, MoreVertical, Plus, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  archiveBankAccountAction,
  setDefaultBankAccountAction,
} from "../actions";
import { ACCOUNT_TYPE_LABELS, type ACCOUNT_TYPES } from "../schemas";

import { BankAccountDialog, type EditingAccount } from "./BankAccountDialog";

export type Account = {
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

export function BankAccountList({
  accounts,
  onChanged,
}: {
  accounts: Account[];
  onChanged?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingAccount | null>(null);
  const [pending, start] = useTransition();

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setDialogOpen(true);
  }

  function handleSetDefault(id: string) {
    start(async () => {
      const result = await setDefaultBankAccountAction(id);
      if (result.ok) {
        toast.success("Default account updated");
        onChanged?.();
      } else toast.error(result.error);
    });
  }

  function handleArchive(id: string) {
    start(async () => {
      const result = await archiveBankAccountAction(id);
      if (result.ok) {
        toast.success("Account archived");
        onChanged?.();
      } else toast.error(result.error);
    });
  }

  return (
    <>
      <div className="rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Bank accounts
            </h3>
            <p className="mt-0.5 text-xs text-brand-mute">
              The default account is what guests see on EFT instructions and
              what prints on invoices and quotes.
            </p>
          </div>
          <Button
            size="sm"
            onClick={openAdd}
            className="gap-1.5"
            disabled={pending}
          >
            <Plus className="h-4 w-4" />
            Add account
          </Button>
        </div>

        {accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-brand-ink">
              No bank accounts yet
            </p>
            <p className="max-w-sm text-xs text-brand-mute">
              Add at least one account before turning on EFT or issuing
              invoices. You can keep multiple — one is always the default.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-light text-brand-primary">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-semibold text-brand-ink">
                        {a.label}
                      </span>
                      {a.is_default ? (
                        <Badge className="gap-1 bg-brand-accent text-brand-secondary hover:bg-brand-accent">
                          <ShieldCheck className="h-3 w-3" />
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-brand-ink">
                      {a.bank_name} ·{" "}
                      <span className="font-mono">
                        ••••{a.account_number_last4}
                      </span>
                    </p>
                    <p className="text-xs text-brand-mute">
                      {a.account_holder} · {ACCOUNT_TYPE_LABELS[a.account_type]}{" "}
                      · Branch {a.branch_code}
                      {a.swift_code ? ` · SWIFT ${a.swift_code}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(a)}
                    disabled={pending}
                  >
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={pending}
                        aria-label="More actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={a.is_default || pending}
                        onClick={() => handleSetDefault(a.id)}
                      >
                        Set as default
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={a.is_default || pending}
                        onClick={() => handleArchive(a.id)}
                        className="text-status-cancelled focus:text-status-cancelled"
                      >
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BankAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        hasExistingAccounts={accounts.length > 0}
        onChanged={onChanged}
      />
    </>
  );
}
