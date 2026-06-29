"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageSquare, Filter, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { fetchLookingForPostsAction } from "../actions";
import { RequestCard } from "./RequestCard";

interface RequestsBoardProps {
  hostId: string;
}

export type LookingForPost = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  check_in_date: string | null;
  check_out_date: string | null;
  adults: number;
  children: number;
  infants: number;
  location_text: string | null;
  location_region: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  budget_per: string | null;
  is_urgent: boolean;
  is_targeted: boolean; // True if this is a private post targeted at the host
  view_count: number;
  quote_count: number;
  created_at: string;
  expires_at: string | null;
  guest_name: string | null;
  guest_avatar: string | null;
  guest_verification: {
    email_verified: boolean;
    phone_verified: boolean;
    id_verified: boolean;
  };
  availability: {
    status: "available" | "partial" | "unavailable" | "unknown";
    available_count: number;
    total_count: number;
    message: string;
  };
  distance_km: number | null;
  already_quoted: boolean;
};

export function RequestsBoard({ hostId }: RequestsBoardProps) {
  const [posts, setPosts] = useState<LookingForPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState({
    category: "all",
    region: "all",
    sortBy: "nearest",
    quickFilter: "all" as "all" | "no_quotes" | "expiring_soon",
  });

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, filters]);

  async function loadPosts() {
    setLoading(true);
    try {
      const result = await fetchLookingForPostsAction({
        hostId,
        category: filters.category === "all" ? undefined : filters.category,
        region: filters.region === "all" ? undefined : filters.region,
        sortBy: filters.sortBy as "nearest" | "newest" | "budget_high",
        quickFilter:
          filters.quickFilter === "all" ? undefined : filters.quickFilter,
      });
      if (result.success && result.data) {
        setPosts(result.data);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    startTransition(() => {
      loadPosts();
    });
  }

  if (loading && posts.length === 0) {
    return (
      <div className="space-y-4">
        <FilterBar filters={filters} onFiltersChange={setFilters} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-card bg-brand-light"
            />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="space-y-4">
        <FilterBar filters={filters} onFiltersChange={setFilters} />
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            No requests yet
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            Guest requests matching your filters will appear here. Check back
            soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FilterBar filters={filters} onFiltersChange={setFilters} />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <RequestCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

interface FilterBarProps {
  filters: {
    category: string;
    region: string;
    sortBy: string;
    quickFilter: "all" | "no_quotes" | "expiring_soon";
  };
  onFiltersChange: (filters: {
    category: string;
    region: string;
    sortBy: string;
    quickFilter: "all" | "no_quotes" | "expiring_soon";
  }) => void;
}

function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-brand-mute">
        <Filter className="h-4 w-4" />
        <span>Filters:</span>
      </div>
      <Select
        value={filters.category}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, category: value })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          <SelectItem value="accommodation">Accommodation</SelectItem>
          <SelectItem value="experience">Experience</SelectItem>
          <SelectItem value="venue">Venue</SelectItem>
          <SelectItem value="event">Event</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.sortBy}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, sortBy: value })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nearest">Nearest first</SelectItem>
          <SelectItem value="newest">Newest first</SelectItem>
          <SelectItem value="budget_high">Budget high→low</SelectItem>
        </SelectContent>
      </Select>
      <div className="ml-auto flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <Select
          value={filters.quickFilter}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              quickFilter: value as "all" | "no_quotes" | "expiring_soon",
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Quick filters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All requests</SelectItem>
            <SelectItem value="no_quotes">No quotes yet</SelectItem>
            <SelectItem value="expiring_soon">Expiring soon</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
