export type CategoryKind = "accommodation" | "experience";

export type ListingCategoryRow = {
  id: string;
  parent_id: string | null;
  kind: CategoryKind;
  slug: string;
  label: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_published: boolean;
  hero_image_url: string | null;
  og_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  intro_markdown: string | null;
  faq: Array<{ q: string; a: string }>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AmenityGroupRow = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AmenityCatalogRow = {
  id: string;
  group_id: string;
  slug: string;
  label: string;
  icon: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CategoryNode = ListingCategoryRow & {
  children: CategoryNode[];
};

export type CategoryTreeByKind = {
  accommodation: CategoryNode[];
  experience: CategoryNode[];
};

export type AmenityGroupWithItems = AmenityGroupRow & {
  items: AmenityCatalogRow[];
};
