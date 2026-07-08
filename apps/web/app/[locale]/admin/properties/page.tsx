import {
  BedDouble,
  Images,
  CalendarCheck,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Search } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnErrorWithCount } from "@/lib/supabase/query";

import { AdminSegments } from "../_components/AdminSegments";
import { AdminStatBand } from "../_components/AdminStatBand";
import { AdminTable, type AdminColumn } from "../_components/AdminTable";
import { ListingActions } from "./ListingActions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { q?: string; status?: string };

const STATUSES = ["all", "published", "draft", "featured"] as const;

function isStatus(v: string | undefined): v is (typeof STATUSES)[number] {
  return STATUSES.includes((v ?? "") as (typeof STATUSES)[number]);
}

// Strip characters that carry meaning in a PostgREST `.or()` filter so a search
// term can't inject extra conditions (e.g. "x,is_published.eq.false").
function sanitizeSearch(q: string): string {
  return q
    .replace(/[,()\\*%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function rand(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("listings.edit");

  const q = (searchParams?.q ?? "").trim();
  const qSafe = sanitizeSearch(q);
  const status: (typeof STATUSES)[number] = isStatus(searchParams?.status)
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";

  const service = createAdminClient();
  let query = service
    .from("properties")
    .select(
      `
      id, name, slug, property_type, is_published, is_featured, city, province,
      base_price, currency, avg_rating, total_reviews, created_at,
      host:hosts ( id, handle, display_name, is_verified )
    `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (qSafe) {
    query = query.or(
      `name.ilike.%${qSafe}%,city.ilike.%${qSafe}%,slug.ilike.%${qSafe}%`,
    );
  }
  if (status === "published") query = query.eq("is_published", true);
  else if (status === "draft") query = query.eq("is_published", false);
  else if (status === "featured") query = query.eq("is_featured", true);

  const { data: rows, count } = await throwOnErrorWithCount(
    query,
    "admin/listings",
  );

  type HostRel = {
    id: string;
    handle: string;
    display_name: string;
    is_verified: boolean;
  };
  type Row = {
    id: string;
    name: string;
    slug: string | null;
    property_type: string;
    is_published: boolean;
    is_featured: boolean;
    city: string | null;
    province: string | null;
    base_price: number;
    currency: string;
    avg_rating: number | null;
    total_reviews: number | null;
    created_at: string;
    host: HostRel | HostRel[] | null;
    rooms: number;
    photos: number;
    bookings: number;
  };

  const base =
    (rows as Omit<Row, "rooms" | "photos" | "bookings">[] | null) ?? [];
  const listedIds = base.map((l) => l.id);

  // Enrichment — rooms / photos / bookings counts for the visible page (batched).
  const roomsBy = new Map<string, number>();
  const photosBy = new Map<string, number>();
  const bookingsBy = new Map<string, number>();
  if (listedIds.length > 0) {
    const [{ data: roomRows }, { data: photoRows }, { data: bookingRows }] =
      await Promise.all([
        service
          .from("property_rooms")
          .select("property_id")
          .in("property_id", listedIds),
        service
          .from("property_photos")
          .select("property_id")
          .in("property_id", listedIds),
        service
          .from("bookings")
          .select("property_id")
          .in("property_id", listedIds),
      ]);
    for (const r of roomRows ?? [])
      roomsBy.set(r.property_id, (roomsBy.get(r.property_id) ?? 0) + 1);
    for (const r of photoRows ?? [])
      photosBy.set(r.property_id, (photosBy.get(r.property_id) ?? 0) + 1);
    for (const r of bookingRows ?? [])
      if (r.property_id)
        bookingsBy.set(r.property_id, (bookingsBy.get(r.property_id) ?? 0) + 1);
  }

  const list: Row[] = base.map((l) => ({
    ...l,
    rooms: roomsBy.get(l.id) ?? 0,
    photos: photosBy.get(l.id) ?? 0,
    bookings: bookingsBy.get(l.id) ?? 0,
  }));

  // KPI + segment counts (all non-deleted listings).
  const { data: allRows } = await service
    .from("properties")
    .select("is_published, is_featured")
    .is("deleted_at", null);
  let total = 0;
  let published = 0;
  let draft = 0;
  let featured = 0;
  for (const l of allRows ?? []) {
    total += 1;
    if (l.is_published) published += 1;
    else draft += 1;
    if (l.is_featured) featured += 1;
  }

  const columns: AdminColumn<Row>[] = [
    {
      header: "Listing",
      cell: (l) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{l.name}</div>
          <div className="truncate text-[11px] uppercase tracking-wider text-brand-mute">
            {l.property_type}
            {l.city ? ` · ${l.city}` : ""}
          </div>
        </div>
      ),
    },
    {
      header: "Host",
      cell: (l) => {
        const host = Array.isArray(l.host) ? l.host[0] : l.host;
        return host ? (
          <span className="inline-flex items-center gap-1.5">
            <Link
              href={`/admin/hosts/${host.id}`}
              className="text-[12px] text-brand-primary hover:underline"
            >
              {host.display_name}
            </Link>
            {host.is_verified ? (
              <ShieldCheck
                className="h-3.5 w-3.5 text-brand-primary"
                aria-label="Verified host"
              />
            ) : null}
          </span>
        ) : (
          <span className="text-brand-mute">—</span>
        );
      },
    },
    {
      header: "Content",
      cell: (l) => (
        <div className="flex items-center gap-3 text-[12px] text-brand-mute">
          <span className="inline-flex items-center gap-1" title="Rooms">
            <BedDouble className="h-3.5 w-3.5" /> {l.rooms}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${l.photos === 0 ? "text-status-pending" : ""}`}
            title="Photos"
          >
            <Images className="h-3.5 w-3.5" /> {l.photos}
          </span>
        </div>
      ),
    },
    {
      header: "Bookings",
      align: "right",
      cell: (l) => (
        <span className="num inline-flex items-center justify-end gap-1 text-[12px] text-brand-mute">
          <CalendarCheck className="h-3.5 w-3.5" /> {l.bookings}
        </span>
      ),
    },
    {
      header: "Rating",
      cell: (l) =>
        (l.total_reviews ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-ink">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {Number(l.avg_rating ?? 0).toFixed(1)}
            <span className="text-brand-mute">({l.total_reviews})</span>
          </span>
        ) : (
          <span className="text-[12px] text-brand-mute">—</span>
        ),
    },
    {
      header: "From",
      align: "right",
      cell: (l) => (
        <span className="num font-medium text-brand-ink">
          {rand(Number(l.base_price))}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (l) => (
        <div className="flex flex-wrap items-center gap-1">
          {l.is_published ? (
            <Pill tone="good">Published</Pill>
          ) : (
            <Pill tone="pending">Draft</Pill>
          )}
          {l.is_featured ? <Pill tone="primary">Featured</Pill> : null}
        </div>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (l) => (
        <ListingActions
          listingId={l.id}
          slug={l.slug}
          isPublished={l.is_published}
          isFeatured={l.is_featured}
          name={l.name}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Listings
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every accommodation listing on the platform — moderate, feature or
          take one offline.
        </p>
      </header>

      {/* KPI band — matches the overview's seamless stat tiles. */}
      <AdminStatBand
        cols={4}
        stats={[
          { label: "Total listings", value: total, href: "/admin/properties" },
          {
            label: "Published",
            value: published,
            href: "/admin/properties?status=published",
          },
          {
            label: "Draft",
            value: draft,
            tone: draft > 0 ? "amber" : "default",
            href: "/admin/properties?status=draft",
          },
          {
            label: "Featured",
            value: featured,
            tone: "primary",
            href: "/admin/properties?status=featured",
          },
        ]}
      />

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(l) => l.id}
        empty="No listings match this filter."
        topBar={
          <AdminSegments
            param="status"
            current={status}
            options={[
              { key: "all", label: "All", count: total },
              { key: "published", label: "Published", count: published },
              { key: "draft", label: "Draft", count: draft },
              { key: "featured", label: "Featured", count: featured },
            ]}
          />
        }
        toolbar={
          <form
            action="/admin/properties"
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            {status !== "all" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
              <Search className="h-4 w-4 text-brand-mute" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name, city or handle…"
                className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary"
            >
              Search
            </button>
            {q ? (
              <Link
                href={
                  status === "all"
                    ? "/admin/properties"
                    : `/admin/properties?status=${status}`
                }
                className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </form>
        }
        footer={
          <div className="text-[12px] tabular-nums text-brand-mute">
            Showing {list.length} of {count ?? list.length}
            {count != null && count > PAGE_SIZE
              ? " — narrow your search to see more"
              : ""}
          </div>
        }
      />
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "pending" | "primary";
}) {
  const cls =
    tone === "good"
      ? "bg-status-confirmed/10 text-status-confirmed"
      : tone === "primary"
        ? "bg-brand-primary/10 text-brand-primary"
        : "bg-status-pending/10 text-status-pending";
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}
