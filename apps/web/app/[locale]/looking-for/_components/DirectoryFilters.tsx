"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DirectoryFiltersProps {
  currentCategory?: string;
  currentRegion?: string;
  currentSort?: string;
}

const REGIONS = [
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
  "KwaZulu-Natal",
  "Free State",
  "North West",
  "Gauteng",
  "Mpumalanga",
  "Limpopo",
];

export function DirectoryFilters({
  currentCategory,
  currentRegion,
  currentSort,
}: DirectoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/looking-for?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-brand-line bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-brand-mute">
        <Filter className="h-4 w-4" />
        <span>Filters:</span>
      </div>

      <Select
        value={currentCategory ?? "all"}
        onValueChange={(value) => updateFilter("category", value)}
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
        value={currentRegion ?? "all"}
        onValueChange={(value) => updateFilter("region", value)}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All regions</SelectItem>
          {REGIONS.map((region) => (
            <SelectItem key={region} value={region}>
              {region}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentSort ?? "default"}
        onValueChange={(value) => updateFilter("sort", value)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Urgent first</SelectItem>
          <SelectItem value="newest">Newest first</SelectItem>
          <SelectItem value="budget_high">Budget high→low</SelectItem>
          <SelectItem value="expiring">Expiring soon</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
