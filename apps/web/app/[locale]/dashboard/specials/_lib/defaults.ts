import type { SpecialInput } from "../schemas";

// Blank wizard state for a new special. property_id starts empty (the editor
// blocks submit until one is chosen); everything else carries the DB defaults.
export function emptySpecial(): SpecialInput {
  return {
    property_id: "",
    room_id: null,
    title: "",
    description: null,
    hero_image_path: null,
    badge: null,
    date_mode: "fixed",
    fixed_check_in: null,
    fixed_check_out: null,
    window_start: null,
    window_end: null,
    min_nights: null,
    max_nights: null,
    price_mode: "flat",
    flat_total: null,
    per_night_price: null,
    max_guests: null,
    quantity: 1,
    go_live_at: null,
    book_by: null,
    categories: [],
    custom_tags: [],
    is_featured: false,
    cancellation_policy_id: null,
    show_in_directory: true,
    show_on_website: true,
    status: "draft",
    addons: [],
  };
}
