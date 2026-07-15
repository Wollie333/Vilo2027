"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createUser } from "./[id]/actions";

type AccountType = "guest" | "host" | "quote_only";

const ACCOUNT_TYPES: { value: AccountType; label: string; hint: string }[] = [
  { value: "host", label: "Host", hint: "Full host dashboard." },
  {
    value: "quote_only",
    label: "Quote-only",
    hint: "Scoped quotes-only shell.",
  },
  { value: "guest", label: "Guest", hint: "Books & requests quotes." },
];

// Admin "Add user" dialog on the Users list. Creates the auth user + profile +
// host substrate for the chosen account type, then lands on the new record so
// the existing subscription/product controls can assign a plan.
export function AddUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("host");
  const [pending, start] = useTransition();

  function submit() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email address.");
      return;
    }
    start(async () => {
      const r = await createUser({
        email: trimmed,
        fullName: fullName.trim() || null,
        accountType,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      // Surface the magic sign-in link so the admin can test / hand it over.
      if (r.loginUrl) {
        try {
          await navigator.clipboard.writeText(r.loginUrl);
          toast.success("User created — sign-in link copied to clipboard.");
        } catch {
          toast.success("User created.");
        }
      } else {
        toast.success("User created.");
      }
      setOpen(false);
      setEmail("");
      setFullName("");
      setAccountType("host");
      router.push(`/admin/users/${r.userId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5"
      >
        <UserPlus className="h-4 w-4" />
        Add user
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
        </DialogHeader>
        <p className="text-[12.5px] text-brand-mute">
          Creates the account (no password — a magic sign-in link is copied for
          you). You&apos;ll land on their record to assign a subscription.
        </p>
        <div className="mt-1 space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Full name (optional)</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Account type</Label>
            <Select
              value={accountType}
              onValueChange={(v) => setAccountType(v as AccountType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} — {t.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Creating…" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
