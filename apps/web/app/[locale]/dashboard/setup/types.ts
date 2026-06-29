export type SetupStepKey =
  | "profile"
  | "business"
  | "banking"
  | "listing"
  | "rooms"
  | "policies"
  | "review";

export type Host = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  languages_spoken: string[];
  highlights: string[];
  website_url: string;
  paystack_connected: boolean;
};

export type Profile = {
  full_name: string;
  email: string;
  phone: string;
};

export type Listing = {
  id: string;
  name: string;
  property_type: "accommodation";
  category_id: string | null;
  accommodation_type: string | null;
  description: string;
  base_price: number | null;
  weekend_price: number | null;
  cleaning_fee: number | null;
  currency: string;
  max_guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  check_in_time: string;
  check_out_time: string;
  cancellation_policy: "flexible" | "moderate" | "strict" | null;
  house_rules: string;
  is_published: boolean;
  slug: string | null;
  booking_mode: "whole_listing" | "rooms_only" | "flexible";
  // Location — for SEO + search (set on the Listing card).
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type BankAccount = {
  id: string;
  label: string;
  bank_name: string;
  account_holder: string;
  /** Full account number (host's own data) — UI masks it and reveals on click. */
  account_number: string;
  branch_code: string;
  swift_code: string;
  account_type: string;
  is_default: boolean;
};

export type BusinessDetails = {
  legal_name: string;
  trading_name: string;
  vat_number: string;
  company_registration_number: string;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_postcode: string;
  billing_country: string;
};

export type Photo = {
  id: string;
  url: string;
};

export type Room = {
  id: string;
  name: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  base_price: number | null;
  weekend_price: number | null;
  cleaning_fee: number | null;
  bed_type: string | null;
  view_type: string | null;
  is_active: boolean;
  /** Featured photo URL (cover), or first room photo. */
  featured_image: string | null;
  photo_count: number;
};
