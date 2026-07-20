# Vilo Platform — MVP Product Specification

**Version:** 1.2  
**Status:** Draft  
**Last Updated:** May 2026  
**Changelog v1.2:** Added Module 6.9 Refund Manager and Module 6.10 Policy Manager.
**Changelog v1.1:** Added Wielo Directory (Section 6.8), Free Account Tier, and Granular Feature Permissions system (Section 3 expanded, Section 6.7 expanded).

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [User Roles & Access Control](#3-user-roles--access-control)
4. [Tech Stack](#4-tech-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Core Modules](#6-core-modules)
   - 6.1 Authentication & Onboarding
   - 6.2 Host Profile & Listing Management
   - 6.3 Booking Management
   - 6.4 Inbox & Messaging
   - 6.5 Reviews & Reputation
   - 6.6 Payments & Subscriptions
   - 6.7 Super-Admin Panel
   - 6.8 Wielo Directory (Public Discovery Layer)
   - 6.9 Refund Manager
   - 6.10 Policy Manager
7. [Database Schema (Supabase)](#7-database-schema-supabase)
8. [API Design](#8-api-design)
9. [Payment Integration](#9-payment-integration)
10. [Mobile App (React Native)](#10-mobile-app-react-native)
11. [Notifications](#11-notifications)
12. [Security & Compliance](#12-security--compliance)
13. [MVP Scope — In / Out](#13-mvp-scope--in--out)
14. [Milestones & Delivery Plan](#14-milestones--delivery-plan)

---

## 1. Product Overview

**Wielo** is a direct-booking management platform for accommodation hosts and experience operators. It gives hosts a professional, branded profile page and a private dashboard to manage listings, bookings, guest inquiries, reviews, and payments — all from one place, on web and mobile.

### Core Value Proposition

| Pain Point | Wielo Solution |
|---|---|
| OTAs charge 15–25% commission per booking | Zero booking fees, ever. Flat subscription only. |
| No central place to manage reviews | Unified review dashboard across all channels |
| Fragmented inbox across email, WhatsApp, OTA portals | Single built-in inbox for all inquiries & bookings |
| Payment collection is manual or expensive | Direct Paystack, PayPal & EFT in one workflow |
| No branded direct-booking page | Every host gets their own shareable booking profile URL |

### Platform Type

Hybrid — **React web app** (Next.js) + **React Native mobile app** sharing the same Supabase backend and REST/RPC API layer.

---

## 2. Goals & Success Metrics

### MVP Goals

- Launch a working booking management platform for hosts of accommodations and experiences.
- Enable guests to browse a host's profile and submit booking requests or direct bookings.
- Process payments via Paystack, PayPal, and manual EFT with full audit trail.
- Provide a clean inbox so hosts never miss an inquiry.

### Key Metrics (Post-Launch Targets)

| Metric | Target (Month 3) |
|---|---|
| Active host accounts | 50 |
| Bookings processed | 500 |
| Average time to confirm booking | < 2 hours |
| Payment success rate | > 95% |
| App store rating | ≥ 4.2 |

---

## 3. User Roles & Access Control

### 3.1 Role Definitions

| Role | Description |
|---|---|
| **Guest** | A member of the public viewing a host's profile and making/managing bookings. No subscription required. |
| **Host** | A paying subscriber who manages one or more listings (accommodations or experiences). Has a dashboard, inbox, booking calendar, and public profile. |
| **Staff** | Added by a Host. Can manage bookings and inbox but cannot change billing or delete listings. |
| **Super Admin** | Wielo internal team. Full platform access — user management, billing oversight, content moderation, analytics. |

### 3.2 Permission Matrix

| Action | Guest | Staff | Host | Super Admin |
|---|---|---|---|---|
| View host public profile | ✅ | ✅ | ✅ | ✅ |
| Submit booking request | ✅ | — | — | ✅ |
| Manage own bookings | ✅ | — | — | ✅ |
| View dashboard | — | ✅ | ✅ | ✅ |
| Create/edit listings | — | — | ✅ | ✅ |
| Manage inbox | — | ✅ | ✅ | ✅ |
| Confirm/reject bookings | — | ✅ | ✅ | ✅ |
| Manage reviews | — | — | ✅ | ✅ |
| Add staff members | — | — | ✅ | ✅ |
| Manage subscription/billing | — | — | ✅ | ✅ |
| Access all accounts | — | — | — | ✅ |
| Suspend/delete accounts | — | — | — | ✅ |
| View platform analytics | — | — | — | ✅ |

### 3.3 Supabase Row Level Security (RLS)

All data access is enforced at the database layer via Supabase RLS policies. Auth is JWT-based using Supabase Auth. Role claims are stored in the `user_profiles.role` column and read from the JWT via a custom claim hook.

```sql
-- Example: Hosts can only see their own listings
CREATE POLICY "host_own_listings" ON listings
  FOR ALL USING (host_id = auth.uid());

-- Example: Staff can view bookings for their host's listings
CREATE POLICY "staff_bookings_read" ON bookings
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM listings WHERE host_id IN (
        SELECT host_id FROM staff_members WHERE user_id = auth.uid()
      )
    )
  );
```

---

## 4. Tech Stack

### 4.1 Frontend — Web

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State Management | Zustand |
| Forms | React Hook Form + Zod |
| Date/Calendar | react-big-calendar + date-fns |
| File Uploads | Supabase Storage via @supabase/storage-js |
| Hosting | Vercel |

### 4.2 Mobile — React Native

| Layer | Technology |
|---|---|
| Framework | React Native (Expo SDK 51+) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind (Tailwind for RN) |
| State | Zustand (shared with web where possible) |
| Push Notifications | Expo Notifications + FCM/APNs |
| Distribution | Expo EAS Build → App Store + Play Store |

### 4.3 Backend

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (email, Google OAuth, magic link) |
| Storage | Supabase Storage (listing images, documents) |
| Realtime | Supabase Realtime (inbox, booking status updates) |
| Edge Functions | Supabase Edge Functions (Deno) — payment webhooks, email triggers |
| Email | Resend (transactional email) |
| Background Jobs | Supabase pg_cron (reminders, subscription checks) |

### 4.4 Payments

| Provider | Use Case |
|---|---|
| Paystack | Card payments, instant EFT (Africa-first) |
| PayPal | International guests |
| Manual EFT | Bank transfer with proof-of-payment upload workflow |

### 4.5 Infrastructure & DevOps

| Tool | Purpose |
|---|---|
| GitHub | Source control |
| GitHub Actions | CI/CD (lint, test, deploy to Vercel) |
| Sentry | Error monitoring (web + mobile) |
| PostHog | Product analytics |
| Vercel Env | Secrets management |

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTS                             │
│   Next.js Web App          React Native Mobile App      │
│   (Vercel)                 (Expo / App Stores)          │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / WebSocket
┌────────────────────▼────────────────────────────────────┐
│                  SUPABASE PLATFORM                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │PostgREST │  │ Auth     │  │ Realtime │  │Storage │  │
│  │ (REST    │  │ (JWT,    │  │(WS inbox,│  │(images,│  │
│  │  API)    │  │  OAuth)  │  │ updates) │  │ docs)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│  ┌────────────────────────────────────────────────────┐ │
│  │          PostgreSQL 15 + RLS Policies              │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐   │
│  │       Edge Functions (Deno)                      │   │
│  │  - Paystack webhook handler                      │   │
│  │  - PayPal webhook handler                        │   │
│  │  - EFT proof-of-payment processor                │   │
│  │  - Subscription status checker (pg_cron)         │   │
│  │  - Email trigger dispatcher (Resend)             │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              EXTERNAL SERVICES                          │
│   Paystack API   │   PayPal API   │   Resend API        │
│   PostHog        │   Sentry       │   Google OAuth      │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Core Modules

---

### 6.1 Authentication & Onboarding

#### Flows

**Guest Sign-Up**
- Email + password or Google OAuth.
- Minimal — name, email, phone (optional).
- Guest does not need an account to view profiles; account required to complete a booking.

**Host Sign-Up**
- Email + password or Google OAuth.
- Onboarding wizard (5 steps):
  1. Personal details (name, email, phone)
  2. Property/experience type selection
  3. Create first listing (basic info only at this step)
  4. Subscription plan selection + payment
  5. Dashboard welcome + profile URL assigned

**Staff Invitation**
- Host sends email invite from dashboard.
- Invite link creates account and binds to host's organisation.

**Super Admin**
- Created manually via Supabase dashboard.
- Role: `super_admin` in `user_profiles`.

#### Session Management

- JWT tokens via Supabase Auth.
- Refresh token rotation enabled.
- Session persisted in secure storage (mobile: Expo SecureStore; web: httpOnly cookie).

---

### 6.2 Host Profile & Listing Management

#### Public Profile Page

Every host gets a unique URL: `wieloplatform.com/[handle]`

The public profile displays:
- Host/property name, cover photo, avatar, bio
- All active listings (accommodations + experiences)
- Aggregate review score
- "Book Now" / "Enquire" CTAs per listing

#### Listings

A listing can be one of two types:

**Accommodation**

| Field | Type | Notes |
|---|---|---|
| name | text | |
| description | rich text | |
| listing_type | enum | hotel, guesthouse, B&B, self-catering, lodge, other |
| photos | array | Up to 20 images, Supabase Storage |
| address | jsonb | street, city, province, country, coordinates |
| amenities | array | From predefined list + custom |
| rooms | jsonb | Number of bedrooms, bathrooms, max guests |
| pricing | jsonb | Base nightly rate, weekend rate, cleaning fee, seasonal overrides |
| check_in_time | time | |
| check_out_time | time | |
| min_nights | integer | |
| max_nights | integer | |
| cancellation_policy | enum | flexible, moderate, strict |
| instant_booking | boolean | Auto-confirm vs. host approval required |
| availability_calendar | — | Managed via `blocked_dates` table |

**Experience**

| Field | Type | Notes |
|---|---|---|
| name | text | |
| description | rich text | |
| experience_type | enum | tour, activity, workshop, transfer, other |
| photos | array | |
| location | jsonb | |
| duration_minutes | integer | |
| max_participants | integer | |
| pricing | jsonb | Per person, group rate, private rate |
| schedule | jsonb | Recurring slots or specific dates |
| what_to_bring | text | |
| cancellation_policy | enum | |
| instant_booking | boolean | |

#### Calendar & Availability

- Visual drag-to-block calendar (monthly view).
- Hosts can manually block dates (own use, maintenance).
- Confirmed bookings auto-block dates.
- iCal export/import endpoint prepared for future OTA channel sync.

---

### 6.3 Booking Management

#### Booking States

```
ENQUIRY → PENDING → CONFIRMED → CHECKED_IN → COMPLETED
                 ↘ CANCELLED_BY_HOST
                 ↘ CANCELLED_BY_GUEST
                 ↘ NO_SHOW
```

#### Guest Booking Flow

1. Guest views listing → selects dates / session / participants.
2. Booking summary shown (price breakdown, cancellation policy).
3. Guest submits booking request (creates record in `bookings` with status `PENDING`).
4. Payment collected at this step (Paystack / PayPal) or guest selects EFT (manual).
5. If `instant_booking = true`: status → `CONFIRMED`, confirmation email sent.
6. If `instant_booking = false`: host receives inbox notification, has 24h to confirm or decline.
7. On confirmation: guest receives confirmation email + booking reference.

#### Host Booking Dashboard

- List view + calendar view of all bookings.
- Filter by status, listing, date range.
- Booking detail panel: guest info, dates, payment status, notes.
- Actions: Confirm, Decline, Mark Check-In, Mark Check-Out, Cancel, Add Note.
- Bulk actions: Export CSV.

#### Booking Record (key fields)

| Field | Type |
|---|---|
| id | uuid |
| listing_id | uuid |
| host_id | uuid |
| guest_id | uuid |
| status | enum |
| check_in | date |
| check_out | date (null for experiences) |
| session_date | timestamptz (experiences) |
| guests_count | integer |
| total_amount | numeric |
| currency | text |
| payment_method | enum: paystack, paypal, eft |
| payment_status | enum: pending, paid, partial, refunded, failed |
| eft_proof_url | text (nullable) |
| notes | text |
| cancellation_reason | text |
| created_at | timestamptz |

---

### 6.4 Inbox & Messaging

The inbox is the communication hub for all guest-host interactions. It is **real-time**, powered by Supabase Realtime subscriptions.

#### Inbox Structure

- Every booking or enquiry creates a **conversation thread**.
- Threads are linked to a booking (or pre-booking enquiry).
- Each thread shows: guest name, listing name, dates, booking status, unread badge.
- Messages support: plain text, emoji, file attachment (PDF, image).

#### Features

- Unread message count badge (web nav + mobile tab bar + app icon badge).
- Typing indicators via Realtime presence.
- System messages auto-inserted on booking status changes (e.g. "Booking confirmed by host").
- Host can send message templates (canned replies) — e.g., check-in instructions.
- Message search within a thread.
- Mark thread as resolved / archive.

#### Pre-Booking Enquiry

A guest can send an enquiry without committing to a booking. This creates a conversation thread with status `ENQUIRY`. Host can respond and convert the enquiry to a booking from within the thread.

#### Database Tables

```sql
conversations (id, listing_id, booking_id, host_id, guest_id, status, created_at)
messages (id, conversation_id, sender_id, body, attachment_url, is_system_message, read_at, created_at)
```

---

### 6.5 Reviews & Reputation

#### Review Flow

- After `COMPLETED` status: automated email triggers review request to guest (24h after check-out).
- Guest submits review: overall rating (1–5 stars) + optional written review.
- Host is notified via inbox + email.
- Host can submit a public response to any review.
- Review is published after a 48-hour moderation window (auto-published unless flagged).

#### Host Review Dashboard

- All reviews listed (sortable by date, rating).
- Aggregate score shown (average, breakdown by star).
- Response field inline per review.
- Flag review for admin moderation.
- Import reviews from external sources (manual entry, for migration — MVP nice-to-have).

#### Review Fields

| Field | Type |
|---|---|
| id | uuid |
| booking_id | uuid |
| listing_id | uuid |
| guest_id | uuid |
| rating | integer (1–5) |
| body | text |
| host_response | text |
| is_published | boolean |
| flagged | boolean |
| created_at | timestamptz |

---

### 6.6 Payments & Subscriptions

#### A. Guest Booking Payments

**Paystack**
- Standard Paystack Popup / redirect flow.
- Webhook endpoint: `POST /api/webhooks/paystack` (Supabase Edge Function).
- Events handled: `charge.success`, `charge.failed`, `refund.processed`.
- Refunds initiated from host dashboard → Paystack refund API.

**PayPal**
- PayPal JS SDK (Orders API v2).
- Webhook endpoint: `POST /api/webhooks/paypal`.
- Events handled: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`.

**Manual EFT**
- Guest selects EFT → shown host's banking details.
- Guest uploads proof of payment (PDF or image).
- Booking status: `PENDING_EFT` until host manually confirms payment received.
- Host gets inbox notification to verify and confirm.
- Host marks payment confirmed → booking status → `CONFIRMED`.

**Payment Record**

```sql
payments (
  id uuid,
  booking_id uuid,
  amount numeric,
  currency text,
  method enum (paystack, paypal, eft),
  status enum (pending, completed, failed, refunded),
  provider_reference text,
  eft_proof_url text,
  created_at timestamptz
)
```

#### B. Host Subscription (Access Fee)

Hosts pay a subscription to use the platform. Zero commission on bookings.

**Plans**

| Plan | Billing | Price (suggested) | Listings | Staff Seats |
|---|---|---|---|---|
| Basic | Monthly | R299/mo | 1 | 1 |
| Pro | Monthly | R599/mo | 5 | 3 |
| Business | Monthly | R1,199/mo | Unlimited | 10 |
| Annual | Annual | 2 months free | Matches chosen tier | Same |

> Prices are placeholders — configure in admin panel.

**Subscription Flow**
- Paystack Subscriptions API used for recurring billing (card).
- PayPal Subscriptions API for international hosts.
- Trial period: 14 days free on any plan (card required upfront).
- Grace period: 5 days after failed payment before account is restricted (listings hidden, bookings paused).
- Super Admin can manually override subscription status.

**Subscription Record**

```sql
subscriptions (
  id uuid,
  host_id uuid,
  plan enum (basic, pro, business),
  billing_cycle enum (monthly, annual),
  status enum (trialing, active, past_due, cancelled, restricted),
  current_period_start timestamptz,
  current_period_end timestamptz,
  paystack_subscription_code text,
  paypal_subscription_id text,
  created_at timestamptz
)
```

---

### 6.7 Super-Admin Panel

Accessible at `admin.wieloplatform.com` (separate Next.js route group with role guard).

#### Features

| Section | Capabilities |
|---|---|
| **Dashboard** | Platform KPIs: active hosts, bookings this month, MRR, churn rate |
| **Hosts** | List all hosts, view profile, subscription status, listings count. Suspend / unsuspend. Override subscription. |
| **Guests** | List all guests, booking history, flag/ban. |
| **Bookings** | View all bookings across platform. Filter by status, date, host. Export CSV. |
| **Payments** | All payment records. Filter by method, status. Manual EFT approvals. Refund initiation. |
| **Reviews** | Moderation queue. Approve, reject, or remove reviews. |
| **Subscriptions** | All subscription records. Manual adjustments. Cancel on behalf of host. |
| **Content / CMS** | Manage amenities list, listing categories, experience types, canned message templates, email templates. |
| **Settings** | Platform config: subscription prices, trial period length, grace period, supported currencies. |

---

## 7. Database Schema (Supabase)

### Core Tables

```sql
-- Users & roles
user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'guest', -- guest | host | staff | super_admin
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz DEFAULT now()
)

-- Host organisations
hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id),
  handle text UNIQUE NOT NULL, -- used in public URL
  display_name text,
  bio text,
  cover_photo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)

-- Staff members linked to a host
staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES hosts(id),
  user_id uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now()
)

-- Listings (accommodation + experience)
listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES hosts(id),
  listing_type text NOT NULL, -- accommodation | experience
  name text NOT NULL,
  description text,
  photos jsonb DEFAULT '[]',
  address jsonb,
  pricing jsonb NOT NULL,
  settings jsonb, -- type-specific fields
  cancellation_policy text DEFAULT 'moderate',
  instant_booking boolean DEFAULT false,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)

-- Blocked/unavailable dates
blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  date date NOT NULL,
  reason text,
  UNIQUE(listing_id, date)
)

-- Bookings
bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  host_id uuid REFERENCES hosts(id),
  guest_id uuid REFERENCES user_profiles(id),
  status text NOT NULL DEFAULT 'pending',
  check_in date,
  check_out date,
  session_date timestamptz,
  guests_count integer NOT NULL DEFAULT 1,
  total_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  payment_method text,
  payment_status text DEFAULT 'pending',
  eft_proof_url text,
  notes text,
  cancellation_reason text,
  created_at timestamptz DEFAULT now()
)

-- Payments
payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  amount numeric NOT NULL,
  currency text NOT NULL,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_reference text,
  eft_proof_url text,
  created_at timestamptz DEFAULT now()
)

-- Subscriptions
subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES hosts(id),
  plan text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  paystack_subscription_code text,
  paypal_subscription_id text,
  created_at timestamptz DEFAULT now()
)

-- Inbox
conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  booking_id uuid REFERENCES bookings(id),
  host_id uuid REFERENCES hosts(id),
  guest_id uuid REFERENCES user_profiles(id),
  status text DEFAULT 'open', -- open | resolved | archived
  created_at timestamptz DEFAULT now()
)

messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  sender_id uuid REFERENCES user_profiles(id),
  body text,
  attachment_url text,
  is_system_message boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
)

-- Reviews
reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  listing_id uuid REFERENCES listings(id),
  guest_id uuid REFERENCES user_profiles(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  host_response text,
  is_published boolean DEFAULT false,
  flagged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)
```

---

## 8. API Design

The primary API is Supabase's auto-generated PostgREST REST API. Custom business logic lives in Supabase Edge Functions.

### REST Conventions

```
Base URL: https://<project>.supabase.co/rest/v1/
Auth:     Authorization: Bearer <access_token>
          apikey: <anon_key>
```

### Custom Edge Function Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/functions/v1/booking-create` | Validate, price-check, create booking + initiate payment |
| POST | `/functions/v1/booking-confirm` | Host confirms a pending booking |
| POST | `/functions/v1/booking-cancel` | Cancel booking, trigger refund logic |
| POST | `/functions/v1/eft-proof-upload` | Upload EFT proof, notify host |
| POST | `/functions/v1/review-submit` | Guest submits review post-stay |
| POST | `/functions/v1/invite-staff` | Host invites staff member |
| POST | `/functions/v1/webhooks/paystack` | Paystack webhook receiver |
| POST | `/functions/v1/webhooks/paypal` | PayPal webhook receiver |
| GET  | `/functions/v1/availability` | Returns available dates for a listing |
| GET  | `/functions/v1/pricing-preview` | Returns price breakdown for date range |

### API Versioning

All Edge Functions accept an `X-API-Version: 1` header. Future versions increment this. Breaking changes always bump the version.

### Mobile API Notes

The React Native app consumes the exact same API. The Supabase JS client (`@supabase/supabase-js`) is used on both web and mobile. For mobile-specific needs (push token registration, deep link handling), dedicated Edge Functions are provided:

| Method | Path | Description |
|---|---|---|
| POST | `/functions/v1/register-push-token` | Save Expo push token per device |
| DELETE | `/functions/v1/register-push-token` | Remove token on logout |

---

## 9. Payment Integration

### 9.1 Paystack

**Setup**
- Create Paystack account → get Test and Live API keys.
- Store in environment variables: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`.
- Whitelist webhook URL in Paystack dashboard.

**Guest Payment Flow (Web)**
```
1. Frontend calls /booking-create Edge Function
2. Edge Function calls Paystack Initialize Transaction API
3. Returns authorization_url to frontend
4. Frontend redirects guest to Paystack hosted page
5. Guest pays → Paystack redirects to /booking/[id]/success
6. Paystack fires webhook → /webhooks/paystack Edge Function
7. Edge Function verifies signature, updates payment + booking status
8. Supabase Realtime notifies host inbox
```

**Refunds**
- Initiated via Paystack Refunds API from host dashboard or admin panel.
- Partial refunds supported (e.g., cancellation with partial refund per policy).

**Subscriptions (Host Billing)**
- Use Paystack Plans + Subscriptions API.
- On plan creation, store `paystack_subscription_code` in `subscriptions` table.
- `invoice.payment_failed` webhook triggers grace period logic.

### 9.2 PayPal

**Setup**
- PayPal Developer account → create App → get Client ID + Secret.
- Store: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`.
- Environment: Sandbox for dev, Live for production.

**Guest Payment Flow**
```
1. Frontend loads PayPal JS SDK
2. On Pay click → calls /booking-create Edge Function
3. Edge Function creates PayPal Order (Orders API v2)
4. Returns order_id to frontend
5. PayPal JS SDK captures the order
6. Webhook fires → /webhooks/paypal Edge Function
7. Edge Function verifies, updates payment + booking status
```

**Subscriptions**
- PayPal Subscriptions API for international hosts.
- Billing plans created in PayPal and referenced in `subscriptions` table.

### 9.3 Manual EFT

**Flow**
```
1. Guest selects EFT at checkout
2. Booking created with status PENDING_EFT
3. Guest shown host banking details (stored in hosts.banking_details jsonb)
4. Guest uploads proof of payment via /eft-proof-upload
5. Host receives inbox notification + email
6. Host reviews proof → clicks "Confirm Payment Received"
7. Booking status → CONFIRMED, guest notified
```

**Banking Details Storage**
```sql
-- Added to hosts table
banking_details jsonb -- { bank_name, account_holder, account_number, branch_code, reference_format }
```

Note: Banking details are only displayed to guests with a confirmed EFT booking (RLS enforced).

### 9.4 Environment Variables Reference

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Paystack
PAYSTACK_SECRET_KEY=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_WEBHOOK_ID=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=Wielo
```

---

## 10. Mobile App (React Native)

### 10.1 Stack

- **Expo SDK 51+** with Expo Router (file-based navigation).
- **NativeWind** for styling consistency with web.
- **@supabase/supabase-js** — same client used on web.
- **Expo SecureStore** for token persistence.
- **Expo Notifications** + FCM (Android) + APNs (iOS) for push.

### 10.2 App Structure

```
app/
  (auth)/
    login.tsx
    register.tsx
    forgot-password.tsx
  (guest)/
    index.tsx              # Browse / search
    profile/[handle].tsx   # Host public profile
    listing/[id].tsx       # Listing detail + booking flow
    bookings/
      index.tsx
      [id].tsx
    inbox/
      index.tsx
      [id].tsx
    account.tsx
  (host)/
    dashboard.tsx
    listings/
      index.tsx
      [id].tsx
      new.tsx
    bookings/
      index.tsx
      [id].tsx
    inbox/
      index.tsx
      [id].tsx
    reviews/index.tsx
    calendar/index.tsx
    profile.tsx
    subscription.tsx
  (admin)/
    index.tsx              # Admin panel (super admin only)
```

### 10.3 Deep Linking

Configure `app.json` with scheme `vilo://` for deep links:

| Deep Link | Destination |
|---|---|
| `vilo://booking/[id]` | Booking detail |
| `vilo://inbox/[id]` | Conversation thread |
| `vilo://listing/[id]` | Listing page |
| `vilo://confirm-booking/[token]` | Booking confirmation |

### 10.4 Offline Handling

MVP: graceful offline messaging ("You appear to be offline") using `@react-native-community/netinfo`. No offline data persistence in MVP — future iteration.

### 10.5 Push Notifications

Triggered by Edge Functions via Expo Push API for:
- New booking request (host)
- Booking confirmed (guest)
- New message (both)
- EFT proof uploaded (host)
- Booking reminder 24h before check-in (both)
- Review request after check-out (guest)
- Payment failed / subscription warning (host)

---

## 11. Notifications

### 11.1 Notification Channels

| Event | In-App | Push | Email |
|---|---|---|---|
| New booking request | ✅ | ✅ | ✅ |
| Booking confirmed | ✅ | ✅ | ✅ |
| Booking declined | ✅ | ✅ | ✅ |
| Booking cancelled | ✅ | ✅ | ✅ |
| New message | ✅ | ✅ | — |
| EFT proof uploaded | ✅ | ✅ | ✅ |
| Payment received | ✅ | ✅ | ✅ |
| Review request | — | ✅ | ✅ |
| New review | ✅ | ✅ | ✅ |
| Check-in reminder (24h) | — | ✅ | ✅ |
| Subscription expiring (7d) | ✅ | ✅ | ✅ |
| Subscription payment failed | ✅ | ✅ | ✅ |

### 11.2 Email Templates (via Resend)

All emails are sent from `noreply@wieloplatform.com` and use branded HTML templates managed in the Supabase Edge Function email dispatcher:

- `booking-confirmation-host`
- `booking-confirmation-guest`
- `booking-declined`
- `booking-cancelled`
- `eft-proof-received`
- `review-request`
- `new-review-response`
- `staff-invite`
- `subscription-welcome`
- `subscription-expiring`
- `subscription-payment-failed`

---

## 12. Security & Compliance

### 12.1 Authentication

- Supabase Auth with JWT, refresh token rotation.
- Email verification required before host onboarding.
- Google OAuth as alternative.
- Password requirements: min 8 chars, 1 uppercase, 1 number.
- Rate limiting on login attempts (Supabase Auth built-in).

### 12.2 Data Security

- All RLS policies enforced at database level — never trust client.
- `service_role` key only used server-side (Edge Functions), never exposed to client.
- File uploads restricted to authenticated users; paths scoped by user ID.
- EFT banking details only accessible via server-side query with RLS.
- Payment provider secrets stored in environment variables, never in database.

### 12.3 Webhook Security

- Paystack: verify `x-paystack-signature` header (HMAC SHA-512).
- PayPal: verify webhook via PayPal Webhook Verification API.
- All webhook endpoints return `200` immediately and process async to prevent timeouts.

### 12.4 POPIA / GDPR Readiness (MVP Baseline)

- Privacy policy and terms of service pages (legal team to draft content).
- Cookie consent banner (web).
- Data deletion request flow: guest/host can request account deletion from settings → triggers admin review.
- No selling of user data to third parties.
- Supabase data hosted in appropriate region (configure to `af-south-1` / EU as needed).

---

## 13. MVP Scope — In / Out

### ✅ In Scope (MVP)

- Host sign-up, onboarding, and subscription
- Host public profile page with shareable URL
- Accommodation and experience listing creation and management
- Availability calendar (manual blocking)
- Guest booking flow (instant + request-to-book)
- Paystack, PayPal, and manual EFT payment processing
- Host subscription billing (all 4 plans) via Paystack + PayPal
- Real-time inbox with conversation threads
- Pre-booking enquiry flow
- Review collection and management
- Host dashboard (bookings, calendar, inbox, reviews, listings)
- Super-admin panel (users, bookings, payments, reviews, subscriptions)
- React Native mobile app (iOS + Android)
- Push notifications
- Transactional email (Resend)
- Row-level security and role-based access control
- Staff member invitations (single level)

### ❌ Out of Scope (Post-MVP)

- OTA channel sync (Airbnb, Booking.com iCal integration)
- Dynamic pricing / revenue management tools
- Multi-currency conversion (MVP supports ZAR + USD)
- Guest loyalty / points program
- Gift vouchers
- Promotions / discount codes
- Host analytics dashboard (beyond basic stats)
- AI-powered reply suggestions in inbox
- Native iOS/Android background location
- Offline mode with local data sync
- White-label / multi-tenant version
- Host payout automation (MVP: hosts receive payments directly)

---

## 14. Milestones & Delivery Plan

### Phase 1 — Foundation (Weeks 1–3)

- [ ] Supabase project setup: schema, RLS policies, auth config
- [ ] Next.js project setup: Tailwind, shadcn/ui, Supabase client
- [ ] Auth flows: sign-up, login, OAuth, email verification
- [ ] User profiles and role system
- [ ] Host onboarding wizard (steps 1–3)
- [ ] Basic listing creation (accommodation)

### Phase 2 — Core Booking (Weeks 4–6)

- [ ] Listing creation: experience type
- [ ] Availability calendar and blocked dates
- [ ] Public host profile page
- [ ] Guest booking flow (request + instant)
- [ ] Paystack integration (guest payments)
- [ ] PayPal integration (guest payments)
- [ ] Manual EFT flow + proof upload
- [ ] Booking dashboard (host)

### Phase 3 — Inbox, Reviews & Subscriptions (Weeks 7–9)

- [ ] Real-time inbox (Supabase Realtime)
- [ ] Pre-booking enquiry flow
- [ ] Review submission and management
- [ ] Host subscription billing (Paystack + PayPal subscriptions)
- [ ] All 4 subscription plans + trial + grace period
- [ ] Transactional emails (Resend)

### Phase 4 — Admin, Mobile & Polish (Weeks 10–13)

- [ ] Super-admin panel (all sections)
- [ ] React Native app setup (Expo, routing, auth)
- [ ] Mobile: host dashboard, bookings, inbox, listings
- [ ] Mobile: guest booking flow
- [ ] Push notifications (Expo + FCM + APNs)
- [ ] Deep linking
- [ ] End-to-end testing
- [ ] Sentry error monitoring setup
- [ ] PostHog analytics setup
- [ ] App Store + Play Store submission

### Phase 5 — Launch Readiness (Week 14)

- [ ] Security review (RLS audit, webhook verification check)
- [ ] Payment provider go-live keys activated
- [ ] Privacy policy + terms of service pages
- [ ] Staging → production environment promotion
- [ ] Soft launch with beta hosts


---

## 3.4 Account Tiers & Feature Permissions (Updated)

### Account Tiers

Wielo now supports a **Free Tier** in addition to paid plans. Every host can sign up for free and appear in the Wielo Directory. Features are unlocked progressively based on their subscription plan. Super Admin controls which features are available per tier from the admin panel.

| Tier | Cost | Directory Listing | Bookings | Inbox | Reviews | Payments | Listings Limit | Staff Seats |
|---|---|---|---|---|---|---|---|---|
| **Free** | R0 | ✅ Public profile | Enquiries only | ✅ (limited) | ✅ Read only | ❌ | 1 | 0 |
| **Basic** | R299/mo | ✅ Featured badge | ✅ Full booking | ✅ Full | ✅ Full | ✅ | 1 | 1 |
| **Pro** | R599/mo | ✅ Priority ranking | ✅ Full booking | ✅ Full | ✅ Full | ✅ | 5 | 3 |
| **Business** | R1,199/mo | ✅ Top placement | ✅ Full booking | ✅ Full | ✅ Full | ✅ | Unlimited | 10 |
| **Annual** | 2 months free | Same as chosen tier | Same | Same | Same | Same | Same | Same |

### Feature Permission Flags

Every feature in the platform is controlled by a **feature flag** stored per subscription plan in the `plan_features` table. Super Admin can toggle any feature on/off per plan from the admin panel without a code deploy.

```sql
plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan text NOT NULL,              -- free | basic | pro | business
  feature_key text NOT NULL,       -- see Feature Keys below
  is_enabled boolean DEFAULT false,
  limit_value integer,             -- null = unlimited, integer = cap
  updated_by uuid,                 -- super admin user id
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan, feature_key)
)
```

### Feature Keys Reference

| Feature Key | Description | Free | Basic | Pro | Business |
|---|---|---|---|---|---|
| `directory_listing` | Appear in Wielo Directory | ✅ | ✅ | ✅ | ✅ |
| `directory_priority` | Boosted placement in directory search | ❌ | ❌ | ✅ | ✅ |
| `direct_booking` | Guests can complete a full booking | ❌ | ✅ | ✅ | ✅ |
| `enquiry_only` | Guests can send enquiries only | ✅ | ✅ | ✅ | ✅ |
| `inbox_messages` | Access to inbox | ✅ | ✅ | ✅ | ✅ |
| `inbox_limit` | Max active conversations (null=unlimited) | 10 | null | null | null |
| `payment_paystack` | Accept Paystack payments | ❌ | ✅ | ✅ | ✅ |
| `payment_paypal` | Accept PayPal payments | ❌ | ✅ | ✅ | ✅ |
| `payment_eft` | Accept manual EFT | ❌ | ✅ | ✅ | ✅ |
| `listings_limit` | Max number of listings | 1 | 1 | 5 | null |
| `staff_seats` | Max staff members | 0 | 1 | 3 | 10 |
| `reviews_respond` | Respond to guest reviews | ❌ | ✅ | ✅ | ✅ |
| `calendar_management` | Block dates, manage availability | ❌ | ✅ | ✅ | ✅ |
| `instant_booking` | Enable instant booking | ❌ | ✅ | ✅ | ✅ |
| `reporting` | Reporting (dashboard stats + exports) | ❌ | ✅ | ✅ | ✅ |
| `custom_profile_url` | Custom handle / vanity URL | ❌ | ✅ | ✅ | ✅ |
| `export_bookings` | Export bookings as CSV | ❌ | ❌ | ✅ | ✅ |
| `canned_replies` | Message templates in inbox | ❌ | ❌ | ✅ | ✅ |

### Runtime Feature Checking

Feature permissions are checked at both the API layer (Edge Functions) and the frontend (component-level guards). A shared utility function handles this:

```typescript
// Shared utility (web + mobile)
async function canUse(hostId: string, featureKey: string): Promise<boolean> {
  const { data } = await supabase.rpc('check_feature_permission', {
    p_host_id: hostId,
    p_feature_key: featureKey
  });
  return data?.is_enabled ?? false;
}
```

```sql
-- Supabase RPC function
CREATE OR REPLACE FUNCTION check_feature_permission(p_host_id uuid, p_feature_key text)
RETURNS jsonb AS $$
  SELECT row_to_json(pf.*)
  FROM plan_features pf
  JOIN subscriptions s ON s.plan = pf.plan
  WHERE s.host_id = p_host_id
    AND s.status IN ('trialing', 'active')
    AND pf.feature_key = p_feature_key
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
```

### Free Account Upgrade Prompts

When a free-tier host tries to access a locked feature, the UI shows an inline upgrade prompt (not a blocking modal) with the cheapest plan that unlocks that feature. This is managed as a UI component driven by the feature flag system — no hardcoding.

---

## 6.8 Wielo Directory (Public Discovery Layer)

### Overview

The **Wielo Directory** is a public-facing search and discovery layer — the Booking.com-style front door of the platform. Every host with an active account (including Free tier) gets a listing in the directory automatically. Guests can search, filter, and book directly from the directory without needing to know a host's profile URL in advance.

The directory is accessible at `wieloplatform.com/explore` (web) and the **Explore** tab on mobile.

---

### 6.8.1 Directory Listing Card

Each establishment appears as a card showing:

- Cover photo (first listing image)
- Establishment name
- Location (city, province/region)
- Listing type badge (Accommodation / Experience)
- Star rating + review count
- Price from (lowest nightly rate or experience price)
- Verified badge (if host has completed profile verification)
- Featured badge (Pro+ plans)

---

### 6.8.2 Search & Filtering

**Search Bar**
- Full-text search across: establishment name, location, listing name, description, amenities.
- Powered by Supabase `pg_trgm` full-text search (GIN index on searchable columns).
- Autocomplete suggestions as user types (Edge Function: `/functions/v1/directory-search`).

**Filters**

| Filter | Type | Options |
|---|---|---|
| Listing Type | Multi-select | Accommodation, Experience |
| Location | Text / map | City, region, or "near me" (geolocation) |
| Check-in / Check-out | Date range picker | Any dates |
| Guests | Number input | 1–20+ |
| Price range | Slider | Min–Max per night / per person |
| Star rating | Multi-select | 3★, 4★, 5★ |
| Amenities | Multi-select | Pool, Wi-Fi, Parking, Pet-friendly, etc. |
| Instant Book | Toggle | Only show instant booking listings |
| Accommodation type | Multi-select | Hotel, Guesthouse, B&B, Self-catering, Lodge |
| Experience type | Multi-select | Tour, Activity, Workshop, Transfer |

**Sort Options**
- Recommended (default — blended score: rating + recency + plan tier)
- Price: Low to High
- Price: High to Low
- Highest Rated
- Newest

---

### 6.8.3 Directory Ranking Algorithm

Listing placement in the directory is determined by a server-side ranking score calculated per search:

```
ranking_score =
  (avg_rating × 0.30)
  + (review_count_normalized × 0.20)
  + (profile_completeness × 0.15)
  + (response_rate × 0.15)
  + (plan_boost × 0.20)
```

**Plan Boost Values:**

| Plan | Boost |
|---|---|
| Free | 0.0 |
| Basic | 0.3 |
| Pro | 0.6 |
| Business | 1.0 |

Super Admin can adjust weighting coefficients from the admin panel without a code deploy (stored in `platform_settings` table).

---

### 6.8.4 Listing Detail Page (from Directory)

When a guest clicks a card in the directory, they land on the listing detail page at:
`wieloplatform.com/listing/[listing-id]`

This page shows:
- Full photo gallery (lightbox)
- Description, amenities, house rules
- Availability calendar (read-only for guests)
- Price breakdown calculator (select dates → see total)
- Host profile snippet with link to full host profile
- All reviews for this listing
- "Book Now" / "Send Enquiry" / "Request to Book" CTA (based on feature permissions)
- Map with approximate location (exact address shown post-booking only)
- Share button (copy link, WhatsApp share)

---

### 6.8.5 Host Profile Page (from Directory)

`wieloplatform.com/[handle]` — the host's full public profile showing:
- All active listings (both accommodation + experiences)
- About the host
- Aggregate reviews
- Direct contact / enquiry option

---

### 6.8.6 Database: Directory-Specific Fields

```sql
-- Add to listings table
ALTER TABLE listings ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(address->>'city', '') || ' ' ||
      coalesce(address->>'province', '')
    )
  ) STORED;

CREATE INDEX listings_search_idx ON listings USING GIN(search_vector);
CREATE INDEX listings_location_idx ON listings USING GIST(
  ST_SetSRID(ST_MakePoint(
    (address->>'longitude')::float,
    (address->>'latitude')::float
  ), 4326)
);

-- Directory ranking cache (refreshed every 15 min via pg_cron)
listing_rankings (
  listing_id uuid PRIMARY KEY REFERENCES listings(id),
  ranking_score numeric,
  plan_boost numeric,
  profile_completeness numeric,
  response_rate numeric,
  last_calculated timestamptz DEFAULT now()
)

-- Platform-wide settings (admin-editable)
platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
)
-- Example rows:
-- { key: 'ranking_weights', value: { rating: 0.30, reviews: 0.20, profile: 0.15, response: 0.15, plan: 0.20 } }
-- { key: 'directory_results_per_page', value: 24 }
-- { key: 'free_trial_days', value: 14 }
```

---

### 6.8.7 Directory API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/functions/v1/directory-search` | Full-text + filter search with ranking |
| GET | `/functions/v1/directory-featured` | Featured listings for homepage |
| GET | `/functions/v1/directory-nearby` | Listings near coordinates |
| GET | `/functions/v1/listing-detail/[id]` | Full listing detail for public page |
| GET | `/functions/v1/host-profile/[handle]` | Full host public profile |

All directory endpoints are **publicly accessible** (no auth required). Rate-limited at 60 req/min per IP.

---

### 6.8.8 Directory on Mobile (React Native)

**Explore Tab** — the main discovery screen:

- Search bar at top with filter sheet (bottom drawer).
- Results as scrollable card list (default) with toggle to map view.
- Map view: pins clustered by location; tap pin → listing card bottom sheet.
- "Near Me" button uses device GPS (with permission request).
- Skeleton loading states for perceived performance.
- Pull-to-refresh on results.

**App Structure additions:**

```
app/
  (guest)/
    explore/
      index.tsx          # Directory search + results
      map.tsx            # Map view
      listing/[id].tsx   # Listing detail (already exists)
      filters.tsx        # Filter sheet
```

---

### 6.8.9 Super Admin: Directory Controls

In the Super Admin panel, a new **Directory** section allows:

| Control | Description |
|---|---|
| Feature any listing | Pin a listing to the top of results (editorial pick) |
| Remove from directory | Hide a listing from public search (without deleting it) |
| Verified badge | Manually award verified status to a host |
| Adjust ranking weights | Change scoring coefficients for ranking algorithm |
| View search analytics | Top search terms, zero-result queries, click-through rates |
| Manage amenities list | Add/remove/rename amenity options |
| Manage listing categories | Add/remove listing type options |

---

### 6.8.10 Super Admin: Granular User & Feature Control

The Super Admin **User Management** section is expanded to provide full granular control over any account:

**Per-Account Controls:**

| Action | Description |
|---|---|
| View full account | All listings, bookings, payments, inbox, subscription history |
| Change plan | Manually upgrade or downgrade any host's plan |
| Override feature flags | Enable or disable specific features for a single host (overrides plan defaults) |
| Extend trial | Add days to a host's trial period |
| Suspend account | Hides all listings, blocks login, sends automated email |
| Unsuspend account | Restores access |
| Ban guest | Blocks guest from making bookings on the platform |
| Reset password | Send password reset email on behalf of any user |
| Impersonate user | Log in as any host/guest for support purposes (audit logged) |
| Delete account | GDPR/POPIA-compliant full deletion with audit record |
| Add internal note | Private admin notes on any account (not visible to user) |

**Per-Host Feature Override:**

```sql
-- Overrides plan_features for a specific host
host_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES hosts(id),
  feature_key text NOT NULL,
  is_enabled boolean NOT NULL,
  limit_value integer,
  reason text,                  -- admin note explaining why
  overridden_by uuid,           -- super admin user id
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,       -- null = permanent override
  UNIQUE(host_id, feature_key)
)
```

The `check_feature_permission` RPC is updated to check `host_feature_overrides` first, falling back to `plan_features`:

```sql
CREATE OR REPLACE FUNCTION check_feature_permission(p_host_id uuid, p_feature_key text)
RETURNS jsonb AS $$
  -- Check per-host override first
  SELECT row_to_json(hfo.*)
  FROM host_feature_overrides hfo
  WHERE hfo.host_id = p_host_id
    AND hfo.feature_key = p_feature_key
    AND (hfo.expires_at IS NULL OR hfo.expires_at > now())
  UNION ALL
  -- Fall back to plan-level feature
  SELECT row_to_json(pf.*)
  FROM plan_features pf
  JOIN subscriptions s ON s.plan = pf.plan
  WHERE s.host_id = p_host_id
    AND s.status IN ('trialing', 'active')
    AND pf.feature_key = p_feature_key
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
```

**Admin Audit Log:**

All super admin actions are recorded:

```sql
admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES user_profiles(id),
  action text NOT NULL,            -- e.g. 'suspend_account', 'override_feature', 'impersonate'
  target_type text NOT NULL,       -- 'host' | 'guest' | 'booking' | 'listing'
  target_id uuid NOT NULL,
  payload jsonb,                   -- before/after state
  ip_address text,
  created_at timestamptz DEFAULT now()
)
```

---

## Updated MVP Scope (v1.1)

### ✅ Added to MVP Scope

- Wielo Directory public search page (`/explore`)
- Full-text + geo search with filters and sorting
- Directory listing cards and listing detail pages
- Map view (web + mobile)
- Free account tier with limited features
- Feature flag system (`plan_features` table) — admin-configurable
- Per-host feature overrides (`host_feature_overrides`)
- Upgrade prompts for locked features
- Directory ranking algorithm with admin-adjustable weights
- Super Admin: granular per-account feature control
- Super Admin: impersonate user (audit logged)
- Super Admin: per-account internal notes
- Super Admin: directory editorial controls (feature/hide/verify)
- Admin audit log for all admin actions
- `platform_settings` table for runtime config

### Phase Additions (Updated Delivery Plan)

**Phase 2 (Weeks 4–6) — add:**
- [ ] Directory search page with filters
- [ ] Listing detail public page
- [ ] Host public profile page
- [ ] Free account tier + plan_features seeding

**Phase 3 (Weeks 7–9) — add:**
- [ ] Feature flag runtime checking (RPC + frontend guards)
- [ ] Upgrade prompts UI component
- [ ] host_feature_overrides table + admin UI

**Phase 4 (Weeks 10–13) — add:**
- [ ] Mobile Explore tab (list + map view)
- [ ] Directory ranking algorithm + pg_cron refresh job
- [ ] Admin audit log + impersonate feature
- [ ] Admin: directory editorial controls
- [ ] Admin: search analytics view

---

---

## 6.9 Refund Manager

The Refund Manager gives hosts full visibility and control over refund requests. Rather than refunds being processed silently in the background, every refund — whether triggered by a cancellation, a dispute, or a manual request — passes through a structured workflow that the host owns. Super Admins have oversight and intervention rights across the whole platform.

---

### 6.9.1 Overview & Design Philosophy

Refunds on Wielo work differently from OTAs. Because Wielo charges no booking commission and hosts receive payments directly, refund authority sits with the host — not the platform. The platform provides the tooling, the audit trail, and the guardrails. The host makes the call.

**Three refund pathways:**

| Pathway | Trigger | Who Initiates | Host Action Required |
|---|---|---|---|
| **Policy-Automatic** | Guest cancels within policy window | Guest cancellation | None — system calculates and processes |
| **Host-Initiated** | Host cancels a confirmed booking | Host cancellation | None — full refund always issued automatically |
| **Manual / Discretionary** | Guest disputes, special circumstances | Guest request or host goodwill | Host must review and approve or decline |

---

### 6.9.2 Refund Dashboard (Host)

Located at: `Dashboard → Payments → Refunds`

**Dashboard layout:**

The refund dashboard is a tabbed view:

- **Pending** — refund requests awaiting host decision
- **Approved** — refunds approved and processing or completed
- **Declined** — refund requests the host declined
- **All** — full history with filters

Each row in the list shows:

| Column | Value |
|---|---|
| Guest name | First name + last initial |
| Booking reference | e.g. VILO-2026-AB1234 |
| Listing | Property or experience name |
| Booking dates | Check-in → Check-out |
| Paid amount | Original total charged |
| Requested refund | Amount the guest is requesting |
| Calculated entitlement | What the cancellation policy entitles them to |
| Payment method | Paystack / PayPal / EFT |
| Status badge | Pending / Approved / Declined / Processing / Completed |
| Date requested | Timestamp |

Clicking a row opens the **Refund Detail Panel** (side panel on desktop, full screen on mobile).

---

### 6.9.3 Refund Detail Panel

The refund detail panel shows the host everything they need to make a decision:

**Booking Summary section:**
- Guest details (name, email, booking reference)
- Listing name, dates booked, total paid, payment method
- Link to original booking record

**Refund Request section:**
- Reason provided by guest (dropdown selection + optional free text)
- Amount guest is requesting
- Date of request

**Policy Entitlement section:**
- The host's active cancellation policy for this listing at the time of booking (snapshot — see Section 6.10)
- Calculated entitlement based on days until check-in:
  - Policy rule applied: e.g. "Moderate — cancelled 6 days before check-in → **Full refund entitled**"
  - Or: "Strict — cancelled 3 days before check-in → **No refund entitled per policy**"
- Visual timeline showing where the cancellation falls relative to the policy windows

**Refund Amount section:**
- Pre-filled with the policy-calculated entitlement amount
- Host can **adjust the amount** up or down (partial refund, goodwill refund)
- Minimum: R0 (decline)
- Maximum: original amount paid
- If adjusted below entitlement: a warning shown — "This is less than the guest's policy entitlement. Make sure you have a valid reason."
- Currency shown clearly

**Host Decision Actions:**
- `Approve Refund` — green button, proceeds with the entered amount
- `Decline Refund` — red button, requires a decline reason
- `Request More Info` — sends a message to the guest via inbox before deciding

---

### 6.9.4 Refund Approval Flow

**Step 1 — Host clicks "Approve Refund"**

A confirmation modal appears:
> "You are about to refund **R[amount]** to [Guest Name] for booking VILO-2026-AB1234. This action cannot be undone."
> [Cancel] [Confirm Refund]

**Step 2 — Edge Function: `refund-process`**

`POST /functions/v1/refund-process`

```json
{
  "refund_id": "uuid",
  "approved_amount": 1800.00,
  "host_note": "Approved goodwill refund"
}
```

The Edge Function:
1. Validates the host owns this booking.
2. Validates the refund amount does not exceed the original payment.
3. Checks the payment method and calls the appropriate provider:

**Paystack refund:**
```typescript
await fetch('https://api.paystack.co/refund', {
  method: 'POST',
  headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  body: JSON.stringify({
    transaction:  providerReference,
    amount:       approvedAmount * 100,  // kobo
    merchant_note: hostNote,
  })
});
```

**PayPal refund:**
```typescript
await fetch(`https://api.paypal.com/v2/payments/captures/${captureId}/refund`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${paypalAccessToken}` },
  body: JSON.stringify({
    amount: { value: approvedAmount.toFixed(2), currency_code: currency }
  })
});
```

**EFT refund:**
- No API call — EFT refunds are manual (bank transfer from host to guest).
- `refunds.is_manual = true`.
- Host is shown guest's banking details (provided during the refund request flow).
- Host marks "Refund Sent" after completing the bank transfer.
- Guest notified to expect the funds.

4. Updates database:
   - `refunds.status` → `processing` (Paystack/PayPal) or `pending_manual` (EFT)
   - `payments.status` → `refunded` (full) or `partially_refunded`
   - `bookings.payment_status` → updated accordingly
   - Inbox system message inserted: "Refund of R[amount] approved and processing."

5. Sends notifications:
   - Guest: email (`refund-approved` template) + push notification
   - Host: confirmation toast in dashboard

**Step 3 — Provider Webhook confirms completion**

- Paystack `refund.processed` webhook → `refunds.status` → `completed`
- PayPal `PAYMENT.CAPTURE.REFUNDED` webhook → `refunds.status` → `completed`
- Guest notified: "Your refund of R[amount] has been processed. Allow 3–5 business days."

---

### 6.9.5 Refund Decline Flow

**Step 1 — Host clicks "Decline Refund"**

A modal with a required decline reason:

| Decline Reason | Description |
|---|---|
| `outside_policy` | Cancellation is outside the policy window |
| `no_show` | Guest did not show up |
| `terms_violated` | Guest violated house rules or terms |
| `services_rendered` | Services were provided as described |
| `other` | Free text required |

**Step 2 — Edge Function: `refund-decline`**

`POST /functions/v1/refund-decline`

```json
{
  "refund_id": "uuid",
  "reason": "outside_policy",
  "host_note": "Cancellation was made 1 day before check-in under a Strict policy."
}
```

The Edge Function:
1. Updates `refunds.status` → `declined`, `refunds.decline_reason` saved.
2. Sends guest email: `refund-declined` template — includes the host's stated reason and the applicable cancellation policy terms.
3. Inbox system message: "Refund request declined. Reason: [reason]."
4. Guest is shown a "Dispute this decision" option in their booking detail (routes to admin escalation — see 6.9.8).

---

### 6.9.6 Guest-Initiated Refund Request

Guests can submit a refund request from their booking detail page under two conditions:

1. **Post-cancellation** — they have cancelled and the system has not automatically calculated a full refund (i.e. partial or no entitlement under policy).
2. **Dispute** — they believe they are owed a refund the system did not issue.

**Guest refund request form (in `/bookings/[id]`):**
- Reason (dropdown): Property not as described / Health/emergency / Other
- Description: free text (required)
- Requested amount: pre-filled with policy entitlement, editable
- Supporting document upload (optional): Supabase Storage → `refund-requests/[booking_id]/`

On submission:
- `refund_requests` record created with `status = 'pending'`
- Host notified via inbox + push: "Guest has submitted a refund request for booking [ref]."
- Request appears in host's Refund Manager → Pending tab.

---

### 6.9.7 Automatic Policy-Based Refunds

When a guest cancels a booking, the system automatically calculates the refund based on the **policy snapshot** stored at booking time (see Section 6.10.4). No host action required.

**Refund calculation logic (executed in `booking-cancel` Edge Function):**

```typescript
function calculateRefundAmount(
  totalPaid: number,
  checkIn: Date,
  cancelledAt: Date,
  policySnapshot: PolicySnapshot
): number {
  const daysUntilCheckIn = differenceInDays(checkIn, cancelledAt);
  const rule = policySnapshot.rules
    .sort((a, b) => b.days_before - a.days_before)
    .find(r => daysUntilCheckIn >= r.days_before);
  if (!rule) return 0;
  return (totalPaid * rule.refund_percent) / 100;
}
```

**Built-in policy presets (from Policy Manager — Section 6.10):**

| Policy | Window | Refund |
|---|---|---|
| Flexible | 24h+ before check-in | 100% |
| Flexible | < 24h before check-in | 0% |
| Moderate | 5+ days before | 100% |
| Moderate | 1–4 days before | 50% |
| Moderate | < 24h before | 0% |
| Strict | 7+ days before | 50% |
| Strict | < 7 days before | 0% |
| Custom | Host-defined windows | Host-defined % |

If refund amount > 0, the `booking-cancel` Edge Function automatically:
1. Calls the appropriate payment provider refund API.
2. Creates a `refunds` record with `status = 'processing'`, `auto_refund = true`.
3. Notifies both parties.

If refund amount = 0 per policy, no refund is issued automatically. Guest can still submit a discretionary refund request (Section 6.9.6).

---

### 6.9.8 Admin Refund Escalation

If a guest disputes a host's refund decline, they can escalate to Wielo admin. This creates an admin escalation case.

**Escalation trigger:** Guest clicks "Dispute this decision" on a declined refund.

**Admin Refund Queue** (Super Admin Panel → Payments → Refund Disputes):

Each dispute shows:
- Booking summary + original payment
- Host's decline reason
- Guest's dispute reason and supporting documents
- Full conversation thread from inbox
- Policy snapshot at time of booking

**Admin actions:**
- `Override — Force Refund` — bypasses host, processes refund directly via provider API
- `Uphold Host Decision` — confirms the decline, notifies guest
- `Request More Info` — opens a 3-way admin message thread with host and guest
- `Flag Host Account` — marks host account for review if pattern of unjustified declines

All admin refund decisions are logged in `admin_audit_log`.

---

### 6.9.9 Refund Manager Database Tables

```sql
-- Refund requests (guest-initiated or system-generated)
refund_requests (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid        NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  payment_id        uuid        NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  host_id           uuid        NOT NULL REFERENCES hosts(id) ON DELETE RESTRICT,
  guest_id          uuid        NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  requested_amount  numeric     NOT NULL,
  approved_amount   numeric,
  currency          text        NOT NULL DEFAULT 'ZAR',

  reason            text        NOT NULL,
  reason_detail     text,
  supporting_doc_url text,

  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending', 'approved', 'declined',
                                  'processing', 'completed', 'disputed', 'escalated'
                                )),

  is_auto_refund    boolean     NOT NULL DEFAULT false,
  auto_refund_rule  text,       -- which policy rule triggered this

  decline_reason    text,
  host_note         text,

  -- Provider tracking
  provider_refund_id text,
  provider_response  jsonb,

  -- EFT manual
  is_manual         boolean     NOT NULL DEFAULT false,
  manual_sent_at    timestamptz,

  -- Admin escalation
  escalated_at      timestamptz,
  escalation_note   text,
  admin_decision    text        CHECK (admin_decision IN ('force_refund','uphold_decline')),
  admin_actioned_by uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  admin_note        text,

  actioned_by       uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  actioned_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
)
```

**Indexes:**
```sql
CREATE INDEX idx_refund_requests_booking  ON refund_requests(booking_id);
CREATE INDEX idx_refund_requests_host     ON refund_requests(host_id);
CREATE INDEX idx_refund_requests_guest    ON refund_requests(guest_id);
CREATE INDEX idx_refund_requests_status   ON refund_requests(status);
CREATE INDEX idx_refund_requests_pending  ON refund_requests(host_id, status)
  WHERE status = 'pending';
CREATE INDEX idx_refund_requests_escalated ON refund_requests(escalated_at)
  WHERE status = 'escalated';
```

---

### 6.9.10 Refund Manager — Edge Functions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/functions/v1/refund-request` | Guest submits a refund request |
| POST | `/functions/v1/refund-process` | Host approves refund (triggers provider API) |
| POST | `/functions/v1/refund-decline` | Host declines refund with reason |
| POST | `/functions/v1/refund-manual-sent` | Host marks EFT refund as sent |
| POST | `/functions/v1/refund-escalate` | Guest escalates a declined refund to admin |
| POST | `/functions/v1/refund-admin-decision` | Admin forces or upholds a refund decision |

---

### 6.9.11 Notifications — Refund Events

| Event | Host | Guest | Admin |
|---|---|---|---|
| Refund request submitted | ✅ Push + Email | — | — |
| Refund approved | — | ✅ Push + Email | — |
| Refund declined | — | ✅ Push + Email | — |
| Refund processing (provider confirmed) | — | ✅ Email | — |
| Refund completed | ✅ Email | ✅ Push + Email | — |
| Refund escalated to admin | ✅ Email | ✅ Email | ✅ Dashboard alert |
| Admin overrides host decision | ✅ Email | ✅ Push + Email | — |
| EFT refund marked sent | — | ✅ Push + Email | — |

---

### 6.9.12 Refund Manager — Permission Matrix

| Action | Guest | Staff | Host | Super Admin |
|---|---|---|---|---|
| Submit refund request | ✅ | — | — | ✅ |
| View own refund requests | ✅ | — | — | ✅ |
| View all refund requests (host) | — | ✅ | ✅ | ✅ |
| Approve refund | — | — | ✅ | ✅ |
| Decline refund | — | — | ✅ | ✅ |
| Adjust refund amount | — | — | ✅ | ✅ |
| Mark EFT refund sent | — | ✅ | ✅ | ✅ |
| Escalate to admin | ✅ | — | — | — |
| Admin force refund | — | — | — | ✅ |
| Admin uphold decline | — | — | — | ✅ |
| View refund disputes queue | — | — | — | ✅ |

---

## 6.10 Policy Manager

The Policy Manager gives every host complete control over the legal and operational terms that govern their bookings. Policies are not just text — they are **structured data** that the system reads at booking time to determine refund entitlements, display cancellation warnings, and protect both host and guest. Every policy is versioned and snapshotted so that a booking is always governed by the policy that was active when it was made.

---

### 6.10.1 Overview

Every host has a **Policy Library** — a set of named, reusable policies they create and manage. Each listing is assigned one policy from the library. When a guest books, the current policy is **snapshotted** and permanently attached to that booking. Future policy edits never retroactively affect existing bookings.

**Policy types:**

| Type | Purpose |
|---|---|
| **Cancellation Policy** | Defines refund entitlements at different time windows before check-in |
| **Booking Terms** | Guest-facing terms of stay (house rules, responsibilities, check-in/out conditions) |
| **Privacy & Data Policy** | How the host handles guest data (POPIA compliance at listing level) |

All three types live in the Policy Library. A listing can have one of each type assigned.

---

### 6.10.2 Policy Library (Host Dashboard)

Located at: `Dashboard → Settings → Policy Library`

The library shows all policies the host has created, with columns:

| Column | Description |
|---|---|
| Policy name | Human-readable name (e.g. "Standard 7-Night Cancellation") |
| Type | Cancellation / Booking Terms / Privacy |
| Listings using it | Count of active listings assigned this policy |
| Last updated | Date of last edit |
| Status | Active / Draft / Archived |

**Actions per policy:**
- Edit (creates a new version — existing assignments are not affected)
- Duplicate (copy as starting point for a new policy)
- Archive (cannot be assigned to new listings; existing assignments remain)
- Delete (only if no listings or bookings are currently using it)
- Preview (see the guest-facing view)

---

### 6.10.3 Cancellation Policy Builder

This is the most technically important policy type — its rules are read by the Refund Manager.

**Builder interface:**

The builder is a visual rule editor. Each rule is a row:

| Days Before Check-In | Refund % | Label |
|---|---|---|
| 7 or more days | 100% | Full refund |
| 3 – 6 days | 50% | Partial refund |
| Less than 3 days | 0% | No refund |

Rules are:
- Sorted automatically by `days_before` descending.
- Must collectively cover all possible timeframes (the last rule's minimum is implicitly "0 days").
- Refund % can be any integer from 0 to 100.
- Host can add up to 10 rules.
- The "No Refund" (0%) final rule is always required.

**Preset options:**

Rather than building from scratch, hosts can start from a preset:

| Preset | Rules |
|---|---|
| Flexible | 24h+ = 100%, <24h = 0% |
| Moderate | 5d+ = 100%, 1–4d = 50%, <1d = 0% |
| Strict | 7d+ = 50%, <7d = 0% |
| Non-refundable | Always 0% |

Selecting a preset pre-fills the rules table. Host can customise from there.

**Non-refundable override:**

A toggle "This listing is non-refundable" sets all rules to 0% and overrides any other rules. Displayed prominently to guests at booking: "⚠️ This listing is non-refundable."

**Cancellation Policy Database Structure:**

```sql
-- Policy document (parent record)
policies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         uuid        NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  type            text        NOT NULL
                              CHECK (type IN ('cancellation','booking_terms','privacy')),
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','draft','archived')),
  is_non_refundable boolean   NOT NULL DEFAULT false,
  version         integer     NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
)

-- Cancellation rules (child records for cancellation-type policies)
policy_cancellation_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       uuid        NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  days_before     integer     NOT NULL,   -- minimum days before check-in for this rule to apply
  refund_percent  integer     NOT NULL CHECK (refund_percent BETWEEN 0 AND 100),
  label           text,
  sort_order      integer     NOT NULL DEFAULT 0,
  CONSTRAINT unique_days_per_policy UNIQUE (policy_id, days_before)
)

-- Full text content (for booking_terms and privacy policies)
policy_content (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       uuid        NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  body_html       text        NOT NULL,   -- rich text HTML from Tiptap editor
  body_plain      text,                   -- plain text version for emails
  locale          text        NOT NULL DEFAULT 'en',
  created_at      timestamptz NOT NULL DEFAULT now()
)

-- Snapshots — immutable copy of policy at booking time
policy_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid        NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  policy_id       uuid        NOT NULL REFERENCES policies(id) ON DELETE RESTRICT,
  policy_type     text        NOT NULL,
  snapshot_data   jsonb       NOT NULL,   -- full copy of policy at time of booking
  snapshotted_at  timestamptz NOT NULL DEFAULT now()
)
```

**Indexes:**
```sql
CREATE INDEX idx_policies_host_id  ON policies(host_id);
CREATE INDEX idx_policies_type     ON policies(host_id, type);
CREATE INDEX idx_policies_status   ON policies(status) WHERE status = 'active';
CREATE INDEX idx_policy_rules      ON policy_cancellation_rules(policy_id, days_before DESC);
CREATE INDEX idx_policy_snapshots  ON policy_snapshots(booking_id);
CREATE INDEX idx_policy_snapshots_type ON policy_snapshots(booking_id, policy_type);
```

---

### 6.10.4 Policy Snapshotting

**Why snapshotting matters:**

A host can edit their cancellation policy at any time. Without snapshotting, a guest who booked under a "Moderate" policy could find their rights changed retroactively if the host switches to "Strict" after their booking. Snapshotting prevents this completely.

**When a snapshot is taken:**

The `booking-create` Edge Function, immediately before confirming the booking record, reads all active policies assigned to the listing and creates an immutable snapshot:

```typescript
// booking-create Edge Function (excerpt)
const policies = await supabase
  .from('listing_policies')      // join table: listing ↔ policy
  .select(`
    policy_type,
    policies (
      id, name, type, is_non_refundable, version,
      policy_cancellation_rules (*),
      policy_content (body_html, body_plain, locale)
    )
  `)
  .eq('listing_id', listingId);

for (const { policy_type, policies: policy } of policies) {
  await supabase.from('policy_snapshots').insert({
    booking_id:    bookingId,
    policy_id:     policy.id,
    policy_type:   policy_type,
    snapshot_data: policy,        // full JSON copy — frozen forever
    snapshotted_at: new Date().toISOString(),
  });
}
```

**Where snapshots are used:**

| Where | How |
|---|---|
| Booking confirmation email | Attached as "Your cancellation policy" section |
| Guest booking detail page | "View the policy that applies to your booking" link |
| Refund Manager | Policy Entitlement section reads the snapshot, not the current policy |
| Admin refund disputes | Admin sees the exact policy in force at time of booking |
| Legal disputes | Immutable record of agreed terms |

---

### 6.10.5 Booking Terms Policy

The Booking Terms policy is a rich-text document that defines the rules of the stay.

**What it covers (host fills in):**
- Check-in / check-out procedures
- House rules (no smoking, no parties, pet rules, quiet hours)
- Guest responsibilities (breakage, key collection, parking)
- What is included / excluded in the rate
- Access instructions
- Emergency contacts

**Editor:** Tiptap rich text editor (same as listing description). Output stored as HTML in `policy_content.body_html`.

**Where it appears:**
- Booking summary page (before guest pays): "By completing this booking you agree to the host's Booking Terms." — expandable accordion showing the full terms.
- Booking confirmation email: attached as a collapsible section.
- Guest's booking detail page: "View Booking Terms" link.
- Snapshot stored at booking time.

**Guest must explicitly acknowledge:**

A checkbox is required on the booking summary page:
> ☐ "I have read and agree to the host's Booking Terms and Cancellation Policy."

This acknowledgement is recorded:
```sql
-- Added to bookings table
policy_acknowledged     boolean     NOT NULL DEFAULT false,
policy_acknowledged_at  timestamptz
```

---

### 6.10.6 Privacy Policy

A simple text policy (POPIA/GDPR compliant) that explains how the host handles guest data. For MVP, a default template is provided:

**Default template (editable):**

> "By making a booking through Wielo, you consent to [Property Name] storing your contact details (name, email, phone) for the purpose of managing your booking and communicating with you about your stay. Your details will not be shared with third parties and will be deleted within 12 months of your last stay. You may request deletion of your data at any time by emailing [host_email]."

Hosts can customise this text using the Tiptap editor.

---

### 6.10.7 Assigning Policies to Listings

Each listing can have one policy of each type assigned to it.

**Join table:**

```sql
listing_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  policy_id       uuid NOT NULL REFERENCES policies(id) ON DELETE RESTRICT,
  policy_type     text NOT NULL
                  CHECK (policy_type IN ('cancellation','booking_terms','privacy')),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  assigned_by     uuid REFERENCES user_profiles(id) ON DELETE SET NULL,

  CONSTRAINT unique_policy_type_per_listing UNIQUE (listing_id, policy_type)
)
```

**UI — Listing Editor, Policies Tab:**

In the listing editor (Section 6.2), a dedicated "Policies" tab shows:

| Policy Type | Current Assignment | Action |
|---|---|---|
| Cancellation Policy | Standard Moderate (v2) | Change |
| Booking Terms | Garden Cottage House Rules (v1) | Change / Edit |
| Privacy Policy | Default Wielo Template (v1) | Change / Edit |

Clicking "Change" opens a picker showing all policies of that type from the host's library.

**Warning on policy change:**

If a listing has future confirmed bookings when a policy is reassigned:

> "⚠️ Changing the cancellation policy will only apply to new bookings. The [N] existing confirmed bookings will continue to be governed by their original policy."

---

### 6.10.8 Guest-Facing Policy Display

**On the Listing Detail Page:**

A "Policies" section below the booking widget shows:

- **Cancellation Policy:** Visual timeline showing the refund windows (e.g., "Cancel 5+ days before: full refund | Cancel 1–4 days before: 50% refund | Cancel less than 1 day: no refund").
- **Booking Terms:** Expandable accordion with the full house rules.
- **Non-refundable badge:** If the policy is non-refundable, a red badge is shown prominently on the listing card in the directory and on the listing detail page.

**On the Booking Summary Page (before payment):**

A policy summary is shown inline before the pay button:
- Cancellation policy rules displayed as a simple list.
- "View full Booking Terms" expandable section.
- Acknowledgement checkbox (required — booking cannot proceed without it).

**On the Booking Confirmation Email:**

The full cancellation policy rules and booking terms are included as a section titled "Your Booking Terms."

**On the Guest Booking Detail Page (`/bookings/[id]`):**

A "Policies" card shows:
- The exact policy that was in force at time of booking (read from snapshot).
- "Download as PDF" option (generated from the snapshot).
- A clear statement: "These terms were agreed to at the time of booking and cannot be changed."

---

### 6.10.9 Policy Manager — Edge Functions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/functions/v1/policies` | List host's policy library |
| POST | `/functions/v1/policy-create` | Create new policy |
| PUT | `/functions/v1/policy-update` | Update policy (creates new version) |
| DELETE | `/functions/v1/policy-delete` | Archive or delete a policy |
| POST | `/functions/v1/policy-assign` | Assign policy to a listing |
| GET | `/functions/v1/policy-snapshot/[booking_id]` | Get snapshot for a booking |
| GET | `/functions/v1/policy-preview/[policy_id]` | Guest-facing preview of a policy |

---

### 6.10.10 Policy Manager — Permission Matrix

| Action | Guest | Staff | Host | Super Admin |
|---|---|---|---|---|
| Create / edit policies | — | — | ✅ | ✅ |
| View policy library | — | ✅ (read-only) | ✅ | ✅ |
| Assign policy to listing | — | — | ✅ | ✅ |
| Archive / delete policy | — | — | ✅ | ✅ |
| View policy on booking | ✅ (own) | ✅ | ✅ | ✅ |
| View policy snapshot | ✅ (own) | ✅ | ✅ | ✅ |
| Override policy for a booking | — | — | — | ✅ |
| View all policies (platform) | — | — | — | ✅ |

---

### 6.10.11 Policy Manager — Notifications

| Event | Recipient | Channel |
|---|---|---|
| Policy assigned to listing with future bookings | Host | Dashboard warning banner |
| Guest acknowledges policy at checkout | Host | — (recorded silently) |
| Policy snapshot attached to confirmation | Guest | Email (included in booking confirmation) |
| Host edits an active policy | Host | In-app warning: "Your [N] active bookings will not be affected" |

---

### 6.10.12 Super Admin — Policy Oversight

The Super Admin panel includes a **Policies** section:

| Feature | Description |
|---|---|
| View any host's policy library | Full read access |
| Override policy on a booking | Can change which snapshot governs a booking in dispute resolution |
| Flag a policy | Mark a policy as under review (e.g. unfair terms) |
| Default templates | Manage the platform-wide policy templates provided to new hosts |
| Compliance review | List all hosts without a privacy policy assigned |

**Default policy templates** are stored in `platform_settings`:
```json
{
  "key": "default_policy_templates",
  "value": {
    "cancellation_moderate": { "rules": [...] },
    "booking_terms_template": { "body_html": "..." },
    "privacy_template": { "body_html": "..." }
  }
}
```

New hosts have these templates pre-loaded into their Policy Library during onboarding (Step 3 of the onboarding wizard).

---

## Updated MVP Scope (v1.2)

### ✅ Added to MVP Scope (v1.2)

**Refund Manager:**
- Refund dashboard for hosts (Pending / Approved / Declined / All tabs)
- Refund detail panel with policy entitlement calculation and amount adjustment
- Host approve / decline refund workflow
- Automatic policy-based refund calculation on guest cancellation
- Manual EFT refund workflow (mark-as-sent)
- Guest-initiated discretionary refund request with supporting document upload
- Admin escalation and dispute resolution for declined refunds
- `refund_requests` table with full status machine
- Edge Functions: `refund-request`, `refund-process`, `refund-decline`, `refund-manual-sent`, `refund-escalate`, `refund-admin-decision`
- Refund notifications (push + email) for all state transitions
- Admin refund dispute queue in Super Admin panel

**Policy Manager:**
- Policy Library per host (create, edit, version, archive, delete)
- Cancellation Policy Builder with visual rule editor and presets (Flexible, Moderate, Strict, Non-refundable, Custom)
- Booking Terms policy with Tiptap rich text editor
- Privacy Policy with editable default template (POPIA compliant)
- Policy assignment to listings with change-warning for active bookings
- Policy snapshotting at booking time (immutable, stored in `policy_snapshots`)
- Guest-facing policy display on listing page, booking summary, confirmation email, booking detail
- Guest acknowledgement checkbox (required before payment)
- `policies`, `policy_cancellation_rules`, `policy_content`, `policy_snapshots`, `listing_policies` tables
- Edge Functions: `policy-create`, `policy-update`, `policy-delete`, `policy-assign`, `policy-snapshot`, `policy-preview`
- Super Admin policy oversight and default template management

### Phase Additions (v1.2 — Updated Delivery Plan)

**Phase 2 (Weeks 4–6) — add:**
- [ ] Policy Manager: Policy Library UI + Cancellation Policy Builder
- [ ] Policy assignment to listings (Policies tab in listing editor)
- [ ] Booking Terms + Privacy policy editors
- [ ] Policy display on listing detail page

**Phase 3 (Weeks 7–9) — add:**
- [ ] Policy snapshotting in `booking-create` Edge Function
- [ ] Guest acknowledgement checkbox + `policy_acknowledged` field
- [ ] Policy included in booking confirmation email
- [ ] Policy snapshot viewer on guest booking detail page
- [ ] Automatic policy-based refund calculation in `booking-cancel`

**Phase 4 (Weeks 10–13) — add:**
- [ ] Refund Manager dashboard (host)
- [ ] Refund request flow (guest)
- [ ] Refund approve / decline Edge Functions + provider API calls
- [ ] EFT manual refund workflow
- [ ] Admin refund escalation and dispute queue
- [ ] Refund notifications (push + email)
- [ ] Policy snapshot PDF download
- [ ] Admin: policy oversight section + default template management
- [ ] Mobile: Refund Manager and Policy views

---

*This document is a living specification. Update version number and date on each revision.*
