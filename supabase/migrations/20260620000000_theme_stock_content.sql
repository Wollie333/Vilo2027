-- Theme Stock Content: Professional copy + stock images for Warm and Coastal themes
-- Each theme has 7 complete pages with realistic South African B&B content
-- When activated, sites are immediately presentable without any editing required

-- ============================================================================
-- WARM THEME: Cape Winelands Heritage Guesthouse
-- Tone: Warm, inviting, heritage, farm-to-table, stoep sundowners
-- ============================================================================

UPDATE public.site_themes
SET
  description = 'Heritage-inspired warmth with earth tones and serif elegance',
  preview_image_path = 'https://picsum.photos/seed/vilo-theme-warm/800/500',
  page_templates = '[
  {
    "kind": "home",
    "slug": "home",
    "title": "Home",
    "nav_label": "Home",
    "nav_order": 0,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000001-0001-4000-8000-000000000001",
        "type": "hero",
        "enabled": true,
        "props": {
          "headline": "A peaceful retreat in the heart of the Winelands",
          "subheadline": "Wake up to mountain views, wander through our gardens, and let the tranquility of the Cape wrap around you.",
          "image_path": "https://picsum.photos/seed/vilo-warm-hero/1920/1080",
          "cta_label": "Check availability",
          "cta_href": "/rooms",
          "align": "center"
        }
      },
      {
        "id": "b0000001-0001-4000-8000-000000000002",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Welcome to our guesthouse",
          "body": "Nestled between vineyards and fynbos, our family-run guesthouse has welcomed guests for over a decade. Each morning begins with farm-fresh breakfasts on the stoep, and each evening ends with sundowners overlooking the valley.\n\nWhether you are here for the wine routes, hiking trails, or simply to unwind, we have created a space where time slows down and every detail is considered. From the antique furniture to the garden paths lined with lavender, this is a place built for lingering."
        }
      },
      {
        "id": "b0000001-0001-4000-8000-000000000003",
        "type": "rooms_preview",
        "enabled": true,
        "props": {
          "heading": "Our rooms",
          "max": 6
        }
      },
      {
        "id": "b0000001-0001-4000-8000-000000000004",
        "type": "reviews",
        "enabled": true,
        "props": {
          "heading": "What our guests say",
          "max": 6
        }
      },
      {
        "id": "b0000001-0001-4000-8000-000000000005",
        "type": "location",
        "enabled": true,
        "props": {
          "heading": "Getting here",
          "show_map": true
        }
      },
      {
        "id": "b0000001-0001-4000-8000-000000000006",
        "type": "cta",
        "enabled": true,
        "props": {
          "heading": "Ready to book your stay?",
          "body": "Reserve directly with us — no booking fees, just a warm welcome waiting for you.",
          "button_label": "Check availability",
          "button_href": "/rooms"
        }
      }
    ]
  },
  {
    "kind": "about",
    "slug": "about",
    "title": "About",
    "nav_label": "About",
    "nav_order": 1,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000001-0002-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Our story",
          "body": "What began as a dream to share the beauty of the Western Cape has grown into a guesthouse that feels like home. We fell in love with this valley fifteen years ago, and we have spent every year since making it a place where others can experience the same magic.\n\nFrom restoring the original Cape Dutch farmhouse to planting the kitchen garden that supplies our breakfast table, every corner has a story. The old oak tree by the dam has seen generations of family picnics. The fireplace in the lounge was salvaged from a Stellenbosch estate. We believe these details matter."
        }
      },
      {
        "id": "b0000001-0002-4000-8000-000000000002",
        "type": "host_bio",
        "enabled": true,
        "props": {
          "heading": "Meet your hosts",
          "name": "Sarah and David",
          "body": "We are Sarah and David — wine enthusiasts, avid hikers, and your hosts. Sarah oversees the kitchen (you will taste her famous bobotie if you stay long enough), while David tends the garden and knows every walking trail in the area.\n\nWe live on the property with our two ridgebacks, and nothing makes us happier than helping guests discover our favourite local spots — from hidden vineyards to the best sundowner views.",
          "photo_path": "https://picsum.photos/seed/vilo-warm-host/400/400"
        }
      },
      {
        "id": "b0000001-0002-4000-8000-000000000003",
        "type": "highlights",
        "enabled": true,
        "props": {
          "heading": "Why guests come back",
          "items": [
            {
              "icon": "star",
              "title": "Direct rates",
              "body": "Book with us directly and skip the booking site fees. Best price guaranteed."
            },
            {
              "icon": "heart",
              "title": "Pet friendly",
              "body": "Well-behaved dogs are welcome in two of our cottages. We know they are family."
            },
            {
              "icon": "key",
              "title": "Self check-in",
              "body": "Arrive on your own schedule with our secure keypad entry — no waiting around."
            }
          ]
        }
      }
    ]
  },
  {
    "kind": "contact",
    "slug": "contact",
    "title": "Contact",
    "nav_label": "Contact",
    "nav_order": 2,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000001-0003-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Get in touch",
          "body": "Have a question about your stay or need help planning your visit? We would love to hear from you. Drop us a message and we will get back to you as soon as possible — usually within a few hours."
        }
      },
      {
        "id": "b0000001-0003-4000-8000-000000000002",
        "type": "contact_form",
        "enabled": true,
        "props": {
          "heading": "Send us a message",
          "body": "Fill in the form below and we will be in touch shortly.",
          "submit_label": "Send message",
          "success_message": "Thanks for reaching out! We will reply within 24 hours.",
          "show_phone": true
        }
      },
      {
        "id": "b0000001-0003-4000-8000-000000000003",
        "type": "location",
        "enabled": true,
        "props": {
          "heading": "Find us",
          "show_map": true
        }
      }
    ]
  },
  {
    "kind": "rooms",
    "slug": "rooms",
    "title": "Rooms",
    "nav_label": "Rooms",
    "nav_order": 3,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000001-0004-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Our rooms",
          "body": "Each of our rooms has its own character — from restored farmhouse suites to garden cottages tucked among the oaks. All come with quality linens, coffee stations, and views that make it hard to leave."
        }
      },
      {
        "id": "b0000001-0004-4000-8000-000000000002",
        "type": "rooms_preview",
        "enabled": true,
        "props": {
          "heading": "",
          "max": 20,
          "layout": "list"
        }
      },
      {
        "id": "b0000001-0004-4000-8000-000000000003",
        "type": "cta",
        "enabled": true,
        "props": {
          "heading": "Need help choosing?",
          "body": "Not sure which room suits you best? Get in touch and we will help you find the perfect fit.",
          "button_label": "Contact us",
          "button_href": "/contact"
        }
      }
    ]
  },
  {
    "kind": "blog",
    "slug": "blog",
    "title": "Blog",
    "nav_label": "Blog",
    "nav_order": 4,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000001-0005-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "From the journal",
          "body": "Stories, tips, and local discoveries from our corner of the Winelands. Whether you are planning a visit or just dreaming of one, we hope these posts bring a little of the Cape to you."
        }
      },
      {
        "id": "b0000001-0005-4000-8000-000000000002",
        "type": "blog_preview",
        "enabled": true,
        "props": {
          "heading": "",
          "max": 12
        }
      }
    ]
  },
  {
    "kind": "checkout",
    "slug": "checkout",
    "title": "Book your stay",
    "nav_label": "Book",
    "nav_order": 99,
    "show_in_nav": false,
    "sections": [
      {
        "id": "b0000001-0006-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Complete your booking",
          "body": "You are almost there. Review your details below and confirm your reservation. We cannot wait to welcome you."
        }
      }
    ]
  },
  {
    "kind": "thank-you",
    "slug": "thank-you",
    "title": "Booking confirmed",
    "nav_label": "Thank you",
    "nav_order": 99,
    "show_in_nav": false,
    "sections": [
      {
        "id": "b0000001-0007-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Thank you!",
          "body": "Your booking is confirmed. We have sent a confirmation email with all the details — check your inbox (and spam folder, just in case).\n\nWe are looking forward to welcoming you. In the meantime, feel free to reach out if you have any questions about your stay."
        }
      },
      {
        "id": "b0000001-0007-4000-8000-000000000002",
        "type": "cta",
        "enabled": true,
        "props": {
          "heading": "Questions before your stay?",
          "body": "We are here to help with anything you need.",
          "button_label": "Contact us",
          "button_href": "/contact"
        }
      }
    ]
  }
]'::jsonb
WHERE slug = 'warm' AND deleted_at IS NULL;


-- ============================================================================
-- COASTAL THEME: Contemporary Beachside Retreat
-- Tone: Modern, relaxed, salt-air, whale-watching, paddleboarding
-- ============================================================================

UPDATE public.site_themes
SET
  description = 'Modern beachside living with ocean blues and clean lines',
  preview_image_path = 'https://picsum.photos/seed/vilo-theme-coastal/800/500',
  page_templates = '[
  {
    "kind": "home",
    "slug": "home",
    "title": "Home",
    "nav_label": "Home",
    "nav_order": 0,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000002-0001-4000-8000-000000000001",
        "type": "hero",
        "enabled": true,
        "props": {
          "headline": "Steps from the sand, miles from ordinary",
          "subheadline": "Contemporary beachside living where the sound of waves is your alarm clock and sunsets come standard.",
          "image_path": "https://picsum.photos/seed/vilo-coastal-hero/1920/1080",
          "cta_label": "View rooms",
          "cta_href": "/rooms",
          "align": "center"
        }
      },
      {
        "id": "b0000002-0001-4000-8000-000000000002",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Welcome",
          "body": "Our boutique beach house sits just a two-minute walk from the tidal pool. Designed for those who crave salt air and simplicity, every suite opens to sea views, and our rooftop deck is the best spot in town for watching whales in season.\n\nWhether you are here to surf, explore the coastal trails, or simply read a book with the ocean as your backdrop, you have found your place."
        }
      },
      {
        "id": "b0000002-0001-4000-8000-000000000003",
        "type": "rooms_preview",
        "enabled": true,
        "props": {
          "heading": "Suites & rooms",
          "max": 6
        }
      },
      {
        "id": "b0000002-0001-4000-8000-000000000004",
        "type": "reviews",
        "enabled": true,
        "props": {
          "heading": "Guest reviews",
          "max": 6
        }
      },
      {
        "id": "b0000002-0001-4000-8000-000000000005",
        "type": "location",
        "enabled": true,
        "props": {
          "heading": "Location",
          "show_map": true
        }
      },
      {
        "id": "b0000002-0001-4000-8000-000000000006",
        "type": "cta",
        "enabled": true,
        "props": {
          "heading": "Book direct, skip the fees",
          "body": "When you book through us directly, you save the booking site markup and get our best rate guaranteed.",
          "button_label": "Check availability",
          "button_href": "/rooms"
        }
      }
    ]
  },
  {
    "kind": "about",
    "slug": "about",
    "title": "About",
    "nav_label": "About",
    "nav_order": 1,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000002-0002-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Our story",
          "body": "We bought this property as a rundown 1960s beach cottage and spent two years transforming it into the light-filled retreat you see today. The design blends mid-century lines with coastal textures — think whitewashed walls, driftwood accents, and floor-to-ceiling glass that brings the ocean inside.\n\nWe live for that moment when guests step through the door, see the view, and their shoulders drop. That is what this place is for."
        }
      },
      {
        "id": "b0000002-0002-4000-8000-000000000002",
        "type": "host_bio",
        "enabled": true,
        "props": {
          "heading": "Your hosts",
          "name": "James and Thandi",
          "body": "We are James and Thandi — an architect and a marine biologist who swapped city life for sea air. James designed the renovation; Thandi leads snorkelling excursions and can tell you exactly where to spot dolphins.\n\nWhen we are not welcoming guests, you will find us paddleboarding at dawn or braaiing on the deck at sunset. We built this place to share the coastline we love.",
          "photo_path": "https://picsum.photos/seed/vilo-coastal-host/400/400"
        }
      },
      {
        "id": "b0000002-0002-4000-8000-000000000003",
        "type": "highlights",
        "enabled": true,
        "props": {
          "heading": "What makes us different",
          "items": [
            {
              "icon": "sun",
              "title": "Ocean views",
              "body": "Every room faces the sea. Wake up to waves and fall asleep to the sound of the surf."
            },
            {
              "icon": "anchor",
              "title": "Beach access",
              "body": "A private path takes you straight to the tidal pool — grab a towel and go."
            },
            {
              "icon": "leaf",
              "title": "Sustainable stays",
              "body": "Solar power, rainwater harvesting, and reef-safe amenities. Low footprint, high comfort."
            }
          ]
        }
      }
    ]
  },
  {
    "kind": "contact",
    "slug": "contact",
    "title": "Contact",
    "nav_label": "Contact",
    "nav_order": 2,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000002-0003-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Get in touch",
          "body": "Got a question about bookings, local activities, or anything else? Drop us a line — we usually reply within a few hours."
        }
      },
      {
        "id": "b0000002-0003-4000-8000-000000000002",
        "type": "contact_form",
        "enabled": true,
        "props": {
          "heading": "Send a message",
          "body": "Fill in the form and we will get back to you shortly.",
          "submit_label": "Send",
          "success_message": "Message sent! We will be in touch soon.",
          "show_phone": true
        }
      },
      {
        "id": "b0000002-0003-4000-8000-000000000003",
        "type": "location",
        "enabled": true,
        "props": {
          "heading": "Where to find us",
          "show_map": true
        }
      }
    ]
  },
  {
    "kind": "rooms",
    "slug": "rooms",
    "title": "Rooms",
    "nav_label": "Rooms",
    "nav_order": 3,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000002-0004-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Our suites",
          "body": "Each suite is designed for calm — natural materials, uncluttered spaces, and that view. All include premium linens, Nespresso machines, and private balconies facing the ocean."
        }
      },
      {
        "id": "b0000002-0004-4000-8000-000000000002",
        "type": "rooms_preview",
        "enabled": true,
        "props": {
          "heading": "",
          "max": 20,
          "layout": "list"
        }
      },
      {
        "id": "b0000002-0004-4000-8000-000000000003",
        "type": "cta",
        "enabled": true,
        "props": {
          "heading": "Not sure which suite?",
          "body": "Get in touch and we will help you pick the perfect one for your trip.",
          "button_label": "Contact us",
          "button_href": "/contact"
        }
      }
    ]
  },
  {
    "kind": "blog",
    "slug": "blog",
    "title": "Blog",
    "nav_label": "Blog",
    "nav_order": 4,
    "show_in_nav": true,
    "sections": [
      {
        "id": "b0000002-0005-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Coastal notes",
          "body": "Local tips, ocean stories, and updates from the shoreline. Whether you are planning a trip or just daydreaming, dive in."
        }
      },
      {
        "id": "b0000002-0005-4000-8000-000000000002",
        "type": "blog_preview",
        "enabled": true,
        "props": {
          "heading": "",
          "max": 12
        }
      }
    ]
  },
  {
    "kind": "checkout",
    "slug": "checkout",
    "title": "Book your stay",
    "nav_label": "Book",
    "nav_order": 99,
    "show_in_nav": false,
    "sections": [
      {
        "id": "b0000002-0006-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Almost there",
          "body": "Review your booking details below and confirm your reservation. The ocean is waiting."
        }
      }
    ]
  },
  {
    "kind": "thank-you",
    "slug": "thank-you",
    "title": "Booking confirmed",
    "nav_label": "Thank you",
    "nav_order": 99,
    "show_in_nav": false,
    "sections": [
      {
        "id": "b0000002-0007-4000-8000-000000000001",
        "type": "intro",
        "enabled": true,
        "props": {
          "heading": "Booking confirmed!",
          "body": "We have sent a confirmation email with everything you need. Start packing your beach gear — we cannot wait to have you.\n\nIf you have any questions before your stay, do not hesitate to reach out."
        }
      },
      {
        "id": "b0000002-0007-4000-8000-000000000002",
        "type": "cta",
        "enabled": true,
        "props": {
          "heading": "Need anything?",
          "body": "We are always happy to help.",
          "button_label": "Get in touch",
          "button_href": "/contact"
        }
      }
    ]
  }
]'::jsonb
WHERE slug = 'coastal' AND deleted_at IS NULL;
