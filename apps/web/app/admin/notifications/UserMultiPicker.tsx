"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { searchUsersAction } from "./actions";
import type { UserSearchResult } from "./schemas";

type Props = {
  value: UserSearchResult[];
  onChange: (next: UserSearchResult[]) => void;
};

// Multi-select user picker for the individual-send composer. Combines
// shadcn Command (cmdk) for the searchable dropdown with a chip strip
// for selected items. Typeahead is server-side so it scales beyond
// in-memory filtering.

export function UserMultiPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<
    "any" | "guest" | "host" | "staff" | "super_admin"
  >("any");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [pending, start] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      start(async () => {
        const rows = await searchUsersAction({ query, role });
        setResults(rows);
      });
    }, 200);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, role]);

  const selectedIds = new Set(value.map((v) => v.id));

  function toggle(u: UserSearchResult) {
    if (selectedIds.has(u.id)) {
      onChange(value.filter((x) => x.id !== u.id));
    } else {
      onChange([...value, u]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-mute hover:border-brand-primary/40"
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                {value.length === 0
                  ? "Search users by name or email…"
                  : `${value.length} recipient${value.length === 1 ? "" : "s"} selected`}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Type a name or email…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {pending ? (
                  <div className="px-3 py-4 text-xs text-brand-mute">
                    Searching…
                  </div>
                ) : results.length === 0 ? (
                  <CommandEmpty>
                    No users match. Try a different name, email, or role.
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {results.map((u) => {
                      const selected = selectedIds.has(u.id);
                      return (
                        <CommandItem
                          key={u.id}
                          value={u.id}
                          onSelect={() => toggle(u)}
                          className="flex items-center gap-3"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            className="h-3.5 w-3.5"
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium text-brand-ink">
                              {u.full_name ?? "(no name)"}
                            </span>
                            <span className="truncate text-xs text-brand-mute">
                              {u.email ?? "—"}
                            </span>
                          </div>
                          <span className="rounded bg-brand-accent px-1.5 py-0.5 text-[10px] uppercase text-brand-primary">
                            {u.role}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div>
          <Label className="sr-only">Role filter</Label>
          <Select
            value={role}
            onValueChange={(v) =>
              setRole(v as "any" | "guest" | "host" | "staff" | "super_admin")
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any role</SelectItem>
              <SelectItem value="guest">Guests</SelectItem>
              <SelectItem value="host">Hosts</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="super_admin">Super admins</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-light px-2 py-1 text-xs text-brand-ink"
            >
              <span className="max-w-[200px] truncate">
                {u.full_name ?? u.email ?? u.id}
              </span>
              <button
                type="button"
                onClick={() => toggle(u)}
                className="rounded-full p-0.5 text-brand-mute hover:bg-brand-line hover:text-brand-ink"
                aria-label={`Remove ${u.full_name ?? u.email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
