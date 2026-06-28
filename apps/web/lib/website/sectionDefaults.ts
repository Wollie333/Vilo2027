// Starter props for a freshly-added builder section (W8). Every default is a
// COMPLETE, schema-valid `props` object (post-default shape) so a new section
// renders immediately and `saveDraftSectionsAction` validation passes. Text is
// intentionally placeholder-y to prompt the host to edit it.
//
// Client-safe (pure data + crypto.randomUUID, available in the browser).
import type {
  SectionType,
  WebsiteSection,
} from "@/lib/website/sections.schema";

/** Build a new, valid section document of the given type. */
export function newSection(type: SectionType): WebsiteSection {
  const id = crypto.randomUUID();
  switch (type) {
    case "hero":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          headline: "Your headline here",
          subheadline: "A short welcoming line beneath it.",
          align: "center",
          variant: "spotlight",
          overlay: "medium",
          textTone: "auto",
          height: "auto",
        },
      };
    case "intro":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Welcome",
          body: "Tell guests what makes your place special.",
          variant: "centered",
        },
      };
    case "highlights":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Why guests come back",
          variant: "grid",
          items: [
            { title: "Direct rates", body: "No platform markup." },
            {
              title: "Personal welcome",
              body: "We host every guest ourselves.",
            },
            {
              title: "Great location",
              body: "Close to everything that matters.",
            },
          ],
        },
      };
    case "stats":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "By the numbers",
          variant: "band",
          items: [
            { value: "500+", label: "Happy guests" },
            { value: "4.9", label: "Average rating" },
            { value: "10 yrs", label: "Hosting experience" },
          ],
        },
      };
    case "logos":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "As featured in", items: [], variant: "row" },
      };
    case "gallery":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "Gallery", layout: "grid", max: 12 },
      };
    case "map":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Find us",
          address: "",
          caption: "",
          zoom: 14,
          variant: "boxed",
        },
      };
    case "rooms_preview":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Rooms & rates",
          layout: "grid",
          max: 6,
          display: "grid",
        },
      };
    case "location":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "Where you'll be", show_map: true, variant: "split" },
      };
    case "reviews":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "What guests say", max: 6, variant: "grid" },
      };
    case "cta":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Ready to book?",
          body: "Reserve your dates directly — no booking fees.",
          button_label: "Check availability",
          button_href: "#rooms",
          variant: "banner",
        },
      };
    case "host_bio":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Your host",
          variant: "side",
          name: "",
          body: "A few warm lines about you and your team.",
        },
      };
    case "values":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "How we host",
          variant: "border",
          items: [
            {
              title: "Thoughtful",
              body: "The little touches guests remember.",
            },
            { title: "Local", body: "We point you to the best of the area." },
          ],
        },
      };
    case "blog_preview":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "From the journal",
          max: 3,
          variant: "grid",
          display: "grid",
        },
      };
    case "rich_text":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { html: "<p>Add your own text here.</p>", variant: "narrow" },
      };
    case "faq":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Good to know",
          variant: "accordion",
          items: [{ q: "Is there Wi-Fi?", a: "Yes — free, uncapped." }],
        },
      };
    case "contact_form":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Get in touch",
          body: "Have a question? Send us a message and we'll reply soon.",
          submit_label: "Send message",
          success_message:
            "Thanks — your message is on its way. We'll be in touch soon.",
          show_phone: true,
          show_details: true,
          variant: "stacked",
        },
      };
    case "form":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Get in touch",
          body: "Fill in the form and we'll get back to you.",
          variant: "stacked",
        },
      };
    case "specials_preview":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "Current specials", layout: "grid", max: 6 },
      };
    case "amenities":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Amenities",
          items: [
            { icon: "📶", label: "Free Wi-Fi" },
            { icon: "🅿️", label: "Free parking" },
            { icon: "☕", label: "Breakfast included" },
            { icon: "🏊", label: "Swimming pool" },
          ],
          variant: "grid",
        },
      };
    case "policies":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "Things to know", variant: "grid" },
      };
    case "pricing":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Rates",
          items: [
            { label: "Standard room", price: "R1 200", note: "per night" },
            { label: "Deluxe suite", price: "R2 400", note: "per night" },
          ],
          footnote:
            "Rates are indicative — your final price is confirmed at booking.",
        },
      };
    case "video":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "Take a look", url: "", caption: "" },
      };
    case "trust":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Book with confidence",
          show_review_score: true,
          variant: "badges",
          items: [
            { icon: "🔒", label: "Secure payments" },
            { icon: "✅", label: "Verified host" },
            { icon: "🏅", label: "Superhost award" },
          ],
        },
      };
    case "booking_search":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Check availability",
          body: "Choose your dates and see live availability and pricing.",
        },
      };
    case "availability_calendar":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Availability",
          body: "Open dates are bookable — pick one to start your reservation.",
          months: 1,
        },
      };
    case "rate_table":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Our rates",
          note: "Rates are per night from — your final price is confirmed at checkout.",
        },
      };
    case "room_rates":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Room rates",
          note: "Per night, including breakfast. Minimum 2-night stay over weekends.",
          source: "auto",
          items: [
            {
              room: "Garden Room",
              price: "From R1,200 / night",
              detail: "Queen bed · garden view · sleeps 2",
            },
            {
              room: "Vineyard Suite",
              price: "From R1,850 / night",
              detail: "King bed · private balcony · sleeps 2",
            },
            {
              room: "Family Cottage",
              price: "From R2,400 / night",
              detail: "2 bedrooms · kitchenette · sleeps 4",
            },
          ],
        },
      };
    case "seasonal_pricing":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          heading: "Seasonal pricing",
          note: "Rates vary by season. Public holidays are charged at peak.",
          source: "auto",
          items: [
            {
              season: "Peak",
              dates: "Dec – Jan",
              price: "+30%",
              detail: "Festive season & school holidays",
            },
            {
              season: "High",
              dates: "Feb – Apr · Sep – Nov",
              price: "Standard rate",
              detail: "Best weather for the winelands",
            },
            {
              season: "Low",
              dates: "May – Aug",
              price: "−20%",
              detail: "Cosy winter escapes",
            },
          ],
        },
      };
    case "room_gallery":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { variant: "carousel", max: 12 },
      };
    case "room_overview":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { show_facts: true, show_price: true, variant: "split" },
      };
    case "room_amenities":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "Room amenities", variant: "grid" },
      };
    case "room_rate":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          cta_label: "Book this room",
          note: "Your final price is confirmed at checkout.",
          variant: "card",
        },
      };
    case "room_policies":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { heading: "Things to know", variant: "grid" },
      };
    case "el_heading":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          text: "Section heading",
          level: "h2",
          align: "left",
          size: "auto",
          weight: "auto",
          color: "default",
        },
      };
    case "el_text":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          body: "Write something here — a short paragraph of your own copy.",
          align: "left",
          size: "auto",
          weight: "auto",
          color: "default",
        },
      };
    case "el_image":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { width: "full", align: "center" },
      };
    case "el_button":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          label: "Learn more",
          href: "#",
          variant: "primary",
          size: "md",
          align: "left",
        },
      };
    case "el_spacer":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { size: "md" },
      };
    case "el_divider":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: { line: "solid", thickness: "thin", width: "full" },
      };
    case "columns":
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          gap: "md",
          align: "left",
          columns: [
            {
              blocks: [
                { kind: "heading", text: "First column", level: "h3" },
                {
                  kind: "text",
                  body: "Describe this column in a sentence or two.",
                },
              ],
            },
            {
              blocks: [
                { kind: "heading", text: "Second column", level: "h3" },
                {
                  kind: "text",
                  body: "Describe this column in a sentence or two.",
                },
              ],
            },
          ],
        },
      };
    case "flex":
      // The "Section" container — a blank vertical stack the host fills with
      // elements on the canvas. Starts empty so it reads as a blank section.
      return {
        id,
        type,
        enabled: true,
        tone: "default",
        props: {
          direction: "column",
          justify: "start",
          align: "stretch",
          gap: "md",
          wrap: true,
          blocks: [],
        },
      };
    default: {
      // Exhaustiveness guard — a new SectionType must add a default above.
      const never: never = type;
      throw new Error(`No default for section type: ${String(never)}`);
    }
  }
}
