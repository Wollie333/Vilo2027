# Vilo Platform — Notifications

**Version:** 1.0
**Last Updated:** May 2026
**Companion Docs:** `EMAIL_TEMPLATES.md`, `ARCHITECTURE.md`, `supabase_database.md` Domain 1

---

## 1. Notification Channels

Every event can trigger one or more of three channels:

| Channel | Delivery | Built with |
|---|---|---|
| **Push** | Device notification (iOS + Android) | Expo Push API + FCM + APNs |
| **In-app** | Badge count + alert banner in the app | Supabase Realtime + Zustand |
| **Email** | Transactional email | Resend — see `EMAIL_TEMPLATES.md` |

---

## 2. Full Event Matrix

| Event | Push | In-app | Email | Recipient |
|---|---|---|---|---|
| New booking request | ✅ | ✅ | ✅ | Host |
| Booking confirmed (instant) | ✅ | ✅ | ✅ | Guest |
| Booking confirmed (by host) | ✅ | ✅ | ✅ | Guest |
| Booking declined | ✅ | ✅ | ✅ | Guest |
| Booking cancelled by guest | ✅ | ✅ | ✅ | Host |
| Booking cancelled by host | ✅ | ✅ | ✅ | Guest |
| Check-in reminder (24h before) | ✅ | — | ✅ | Guest + Host |
| New inbox message | ✅ | ✅ | — | Recipient |
| EFT proof of payment uploaded | ✅ | ✅ | ✅ | Host |
| EFT booking confirmed by host | ✅ | ✅ | ✅ | Guest |
| Review request (24h after checkout) | ✅ | — | ✅ | Guest |
| New review published | ✅ | ✅ | ✅ | Host |
| Refund request received | ✅ | ✅ | ✅ | Host |
| Refund approved | ✅ | ✅ | ✅ | Guest |
| Refund declined | ✅ | ✅ | ✅ | Guest |
| Refund escalated to admin | — | — | ✅ | Admin (internal) |
| EFT refund sent | ✅ | ✅ | ✅ | Guest |
| iCal feed sync error (1h persistent) | ✅ | ✅ | — | Host |
| Subscription expiring (7 days) | ✅ | ✅ | ✅ | Host |
| Subscription payment failed | ✅ | ✅ | ✅ | Host |
| Subscription restricted | ✅ | ✅ | ✅ | Host |
| Staff invitation sent | — | — | ✅ | Invitee |
| Account suspended | — | — | ✅ | Host |

---

## 3. Push Notification Payloads

All push notifications are dispatched from Supabase Edge Functions via the Expo Push API. The shared helper is `supabase/functions/_shared/push.ts`.

### Payload structure

```typescript
type PushPayload = {
  to: string | string[];        // Expo push token(s)
  title: string;                // Bold heading on device
  body: string;                 // Message text
  data: {                       // Deep link data (not shown to user)
    screen: string;             // Expo Router path to open on tap
    params?: Record<string, string>;
  };
  badge?: number;               // iOS badge count — unread count
  sound?: 'default' | null;     // 'default' = system sound, null = silent
  priority?: 'default' | 'high'; // 'high' for time-sensitive events
};
```

### Shared helper

```typescript
// supabase/functions/_shared/push.ts
import { Expo } from 'https://esm.sh/expo-server-sdk@3.10.0';

const expo = new Expo();

export async function sendPushNotification(payload: PushPayload): Promise<void> {
  if (!Expo.isExpoPushToken(Array.isArray(payload.to) ? payload.to[0] : payload.to)) {
    console.warn('Invalid Expo push token — skipping');
    return;
  }

  const messages = Array.isArray(payload.to)
    ? payload.to.map(token => ({ ...payload, to: token }))
    : [payload];

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('Push send error:', err);
      // Don't throw — push failure must never break the main booking flow
    }
  }
}
```

---

### 3.1 Booking Push Payloads

#### New booking request → Host
```typescript
{
  title: 'New booking request',
  body: `${guestFirstName} wants to book ${listingName} · ${formatDateRange(checkIn, checkOut)}`,
  data: { screen: '/dashboard/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'high',
}
```

#### Booking confirmed → Guest
```typescript
{
  title: 'Booking confirmed! 🎉',
  body: `Your stay at ${listingName} is confirmed. Check-in ${formatDate(checkIn)}.`,
  data: { screen: '/account/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'high',
}
```

#### Booking declined → Guest
```typescript
{
  title: 'Booking not available',
  body: `${listingName} couldn't take your booking for ${formatDateRange(checkIn, checkOut)}.`,
  data: { screen: '/explore' },
  sound: 'default',
  priority: 'default',
}
```

#### Booking cancelled by guest → Host
```typescript
{
  title: 'Booking cancelled',
  body: `${guestFirstName} cancelled their booking at ${listingName} · ${formatDate(checkIn)}.`,
  data: { screen: '/dashboard/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'default',
}
```

#### Booking cancelled by host → Guest
```typescript
{
  title: 'Your booking was cancelled',
  body: `Your booking at ${listingName} on ${formatDate(checkIn)} has been cancelled. A full refund is on its way.`,
  data: { screen: '/account/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'high',
}
```

#### Check-in reminder (24h before) → Guest + Host
```typescript
// Guest
{
  title: 'Check-in tomorrow!',
  body: `${listingName} · Check in at ${checkInTime}. Have a great stay!`,
  data: { screen: '/account/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'default',
}

// Host
{
  title: 'Guest arriving tomorrow',
  body: `${guestFirstName} checks in at ${listingName} at ${checkInTime} tomorrow.`,
  data: { screen: '/dashboard/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'default',
}
```

---

### 3.2 Inbox Push Payloads

#### New message → Recipient
```typescript
{
  title: senderFirstName,        // sender name as title — matches iMessage style
  body: messageBody.slice(0, 100),   // truncate long messages
  data: { screen: '/inbox/[id]', params: { id: conversationId } },
  sound: 'default',
  priority: 'high',
  badge: unreadCount,
}
```

---

### 3.3 EFT Push Payloads

#### EFT proof uploaded → Host
```typescript
{
  title: 'Payment proof received',
  body: `${guestFirstName} uploaded proof of payment for ${listingName}. Please verify and confirm.`,
  data: { screen: '/dashboard/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'high',
}
```

---

### 3.4 Review Push Payloads

#### Review request → Guest
```typescript
{
  title: 'How was your stay?',
  body: `Tell ${hostFirstName} how it went at ${listingName}. Takes 2 minutes.`,
  data: { screen: '/account/bookings/[id]/review', params: { id: bookingId } },
  sound: null,    // no sound — this is low priority
  priority: 'default',
}
```

#### New review → Host
```typescript
{
  title: `${guestFirstName} left you a ${rating}-star review`,
  body: reviewExcerpt.slice(0, 100),
  data: { screen: '/dashboard/reviews' },
  sound: 'default',
  priority: 'default',
}
```

---

### 3.5 Refund Push Payloads

#### Refund request received → Host
```typescript
{
  title: 'Refund request',
  body: `${guestFirstName} has requested a refund of ${formattedAmount} for ${listingName}.`,
  data: { screen: '/dashboard/payments/refunds/[id]', params: { id: refundId } },
  sound: 'default',
  priority: 'high',
}
```

#### Refund approved → Guest
```typescript
{
  title: 'Refund approved',
  body: `Your refund of ${formattedAmount} for ${listingName} is on its way.`,
  data: { screen: '/account/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'default',
}
```

#### Refund declined → Guest
```typescript
{
  title: 'Refund request update',
  body: `Your refund request for ${listingName} was not approved. Tap to see details and dispute if needed.`,
  data: { screen: '/account/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'default',
}
```

---

### 3.6 Subscription Push Payloads

#### Subscription expiring → Host
```typescript
{
  title: 'Subscription renews in 7 days',
  body: `Your Vilo ${planName} plan renews on ${formatDate(renewalDate)} for ${formattedPrice}.`,
  data: { screen: '/dashboard/settings/subscription' },
  sound: null,
  priority: 'default',
}
```

#### Payment failed → Host
```typescript
{
  title: 'Payment failed',
  body: `We couldn't charge your Vilo ${planName} subscription. Please update your payment method.`,
  data: { screen: '/dashboard/settings/subscription' },
  sound: 'default',
  priority: 'high',
}
```

#### Subscription restricted → Host
```typescript
{
  title: 'Account restricted',
  body: 'Your Vilo subscription has lapsed. Reactivate to restore full access.',
  data: { screen: '/dashboard/settings/subscription' },
  sound: 'default',
  priority: 'high',
}
```

---

### 3.7 iCal Sync Push Payloads

#### Feed error (persists 1+ hour) → Host
```typescript
{
  title: 'Calendar sync issue',
  body: `We can't reach your ${feedLabel} calendar. Check the feed URL is still valid.`,
  data: { screen: '/dashboard/listings/[id]/calendar', params: { id: listingId } },
  sound: null,
  priority: 'default',
}
```

---

## 4. In-App Notifications

In-app notifications use two mechanisms:

### 4.1 Unread badge counts (Realtime)

The inbox unread count is driven by Supabase Realtime — a client subscription to the `messages` table counts unread rows. This updates the badge on the inbox nav item and mobile tab bar in real-time without polling.

```typescript
// hooks/useUnreadCount.ts
'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

export function useUnreadCount(userId: string) {
  const supabase = createBrowserClient();
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial count
    supabase.from('messages')
      .select('id', { count: 'exact' })
      .is('read_at', null)
      .neq('sender_id', userId)
      .then(({ count }) => setCount(count ?? 0));

    // Realtime updates
    const channel = supabase
      .channel('unread-count')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages',
        filter: `sender_id=neq.${userId}`,
      }, () => {
        // Re-query count on any message change
        supabase.from('messages')
          .select('id', { count: 'exact' })
          .is('read_at', null)
          .neq('sender_id', userId)
          .then(({ count }) => setCount(count ?? 0));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return count;
}
```

### 4.2 Dashboard alert banners

Persistent in-app alerts that require host action. Shown at the top of the relevant dashboard page until dismissed or resolved.

| Alert type | Shown on | Dismissed when |
|---|---|---|
| Pending booking requests | `/dashboard/bookings` | All pending bookings actioned |
| iCal feed error | `/dashboard/listings/[id]/calendar` | Feed syncs successfully |
| Subscription payment failed | `/dashboard/settings/subscription` | Payment updated |
| Account restricted | All dashboard pages (sticky) | Subscription reactivated |
| Refund pending > 48h | `/dashboard/payments/refunds` | All pending refunds actioned |

Alert banner component lives at `components/shared/AlertBanner.tsx`. It reads from a `useAlerts()` hook that queries relevant counts from Supabase.

### 4.3 Toast notifications (action feedback)

Short-lived toasts for immediate feedback on user actions. Always use the `sonner` toast library.

```typescript
import { toast } from 'sonner';

// Success
toast.success('Booking confirmed — guest has been notified.');

// Error (user-facing — never raw error messages)
toast.error('Could not confirm booking. Please try again.');

// Info
toast.info('Calendar syncing...');
```

---

## 5. Push Token Management

### Registration

Push tokens are registered when a user logs in on a mobile device and permission is granted.

```typescript
// apps/mobile/lib/notifications.ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  return token.data;
}
```

After getting the token, call the Edge Function to store it:

```typescript
await supabase.functions.invoke('register-push-token', {
  body: { token: pushToken, platform: Platform.OS }
});
```

### Deregistration

On logout, remove the token:

```typescript
await supabase.functions.invoke('register-push-token', { method: 'DELETE' });
```

### `push_tokens` table

```sql
-- Already in supabase_database.md Domain 1
push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
)
```

---

## 6. Push Dispatch from Edge Functions

Every Edge Function that needs to send push notifications follows this pattern:

```typescript
import { sendPushNotification } from '../_shared/push.ts';

// 1. Get the recipient's push tokens
const { data: tokens } = await supabase
  .from('push_tokens')
  .select('token')
  .eq('user_id', recipientUserId);

if (!tokens?.length) return; // user has no registered device — skip silently

// 2. Send
await sendPushNotification({
  to: tokens.map(t => t.token),
  title: 'New booking request',
  body: `${guestName} wants to book ${listingName}`,
  data: { screen: '/dashboard/bookings/[id]', params: { id: bookingId } },
  sound: 'default',
  priority: 'high',
});
```

**Rules:**
- Push failure must NEVER throw or break the main Edge Function flow — always wrap in try/catch
- Never send push to the sender of a message (don't notify yourself)
- Always fetch fresh tokens from DB — never cache tokens in memory
- Tokens are device-scoped: a host on two phones gets two tokens and receives the push on both

---

## 7. pg_cron Notification Jobs

These scheduled jobs fire notification events that can't be triggered by user actions:

| Job | Schedule | What it does |
|---|---|---|
| `send-check-in-reminders` | Daily at 08:00 SAST | Find bookings with check_in = tomorrow. Push + email to guest and host. |
| `send-review-requests` | Daily at 10:00 SAST | Find bookings with check_out = yesterday and status = completed. Push + email to guest. |
| `send-subscription-expiry-warnings` | Daily at 09:00 SAST | Find subscriptions with current_period_end = 7 days from now. Push + email to host. |
| `ical-sync-all` | Every 15 minutes | Re-sync all active iCal import feeds. Push on persistent errors. |

All jobs call their respective Edge Functions via `net.http_post`.

---

## 8. Notification Rules

- **Push must never block the main flow.** Always fire-and-forget. Wrap every push call in try/catch. A failed push notification is logged to Sentry but never causes the booking/payment/refund action to fail.
- **No sensitive data in push body.** Push notification bodies are stored on device and visible in notification history. Never include payment amounts, banking details, or full email addresses in push body text.
- **Batch multi-device sends.** Use the Expo chunking helper — don't send 100 individual requests.
- **In-app badges must match reality.** Unread count must update in real-time via Realtime — never show a stale badge count.
- **Mobile Realtime subscriptions must be cleaned up** on component unmount (see `AGENT_RULES.md` Section 5).

---

## 9. Enterprise dispatcher (v2 — 2026-05-25 onward)

Every notification now flows through a single entry point:

```ts
import { dispatchEvent } from "@/lib/notifications/dispatch";

await dispatchEvent({
  kind: "booking_confirmed_guest",      // typed event kind from the registry
  recipientUserId: guest.user_id,
  guestId: guest.id,                    // for email recipient resolution
  refs: { booking_id: booking.id },     // thin refs — email resolver hydrates
});
```

The dispatcher handles:

1. Locked categories (account_security) — channels forced on regardless of prefs.
2. User preferences (`user_notification_preferences`) — per category × per channel.
3. Quiet hours — defers non-critical push to `pending_push_queue`.
4. Digest mode — routes info / default events in `reviews` / `marketing_tips` to `pending_digest_items` for daily / weekly bundling.
5. Cross-channel dedupe — skips email when a recent push for the same `dedupe_key` was already read.
6. Email enqueue → `notification_queue` (thin payload; `apps/web/lib/email/resolvers/*` hydrates at drain time, caller-supplied keys still win).
7. Push enqueue → `pending_push_queue` (Expo HTTP API, drained by `/api/push-worker`).
8. In-app enqueue → `in_app_notifications` (Realtime → bell).
9. Audit row in `notification_delivery_log` per dispatched channel.

The dispatcher **MUST NOT throw** — a failed delivery never blocks the caller's main flow.

### 9.1 Categories + events (taxonomy)

`notification_categories` (9 rows seeded in `20260525000012`) drives the settings UI and the bell category-filter tabs. Each row carries a `lucide-react` icon name + per-role channel defaults + `is_locked` flag + `supports_digest` flag.

`notification_events` (~30 rows) mirrors `apps/web/lib/notifications/registry.ts`. Two-axis tagging:

- `category_id` → user-facing grouping (settings UI, bell tabs).
- `feature` → admin-facing grouping (audit log filter, send history breakdown).

Both tables are seed-driven — adding a category / event is INSERT only, no UI code change.

### 9.2 Admin broadcasts (audience-based, severity-tiered)

Composer at `/admin/broadcasts/new`. Severity drives presentation:

- `info` → bell entry only (with 📢 Announcement pill).
- `warning` → yellow dismissable banner via `BroadcastBanner`.
- `critical` → red sticky banner with `Acknowledge` CTA + email blast (per-recipient via `broadcast-fanout-worker`).

Audience picker: `all` / `hosts` / `guests` / `staff` / `super_admins`. RLS on `broadcast_announcements` filters to the recipient's role + active window.

### 9.3 Admin individual sends (NEW)

Composer at `/admin/notifications/send`. Multi-select user picker (cmdk `Command` + chip strip + role filter), title + body + optional deep link + severity (`info` / `default` / `high`, NOT `critical` — that's reserved for broadcasts). Channels picker: in-app always on, email + push opt-in per send.

Each send creates one `admin_message_batches` row (visible at `/admin/notifications/sent`) and loops `dispatchEvent('admin_individual_message')` per recipient. `overrideChannels` makes the admin's per-batch channel picks take priority over per-user prefs (locked categories are still respected).

---

## 10. How to add a new notification type (3-step checklist)

Adding a new event kind is fully additive — no schema migration is required unless the email body needs DB hydration via a new resolver.

**Step 1 — Add a registry entry** in `apps/web/lib/notifications/registry.ts`:

```ts
my_new_event: {
  category: "bookings",            // existing category id
  feature: "booking",              // 'booking'|'refund'|'subscription'|'message'|'review'|'calendar'|'account'|'admin'
  severity: "default",
  emailTemplate: "my_new_event",   // OR omit — push/in-app-only events skip email
  refKeys: ["booking_id"],         // docs only — the resolver expects these
  push: (r) => ({ title: "…", body: "…", data: { screen: "/…" } }),
  inApp: (r) => ({ title: "…", body: "…", link: "/…" }),
  dedupeKey: (r) => `my_new_event:${r.booking_id}`,
} satisfies EventBuilder<MyNewEventRefs>,
```

**Step 2 — Seed the event in the DB** (new migration under `supabase/migrations/`):

```sql
INSERT INTO public.notification_events
  (kind, category_id, feature, severity, email_template_key,
   push_supported, in_app_supported, human_label, human_description)
VALUES
  ('my_new_event', 'bookings', 'booking', 'default', 'my_new_event',
   true, true, 'My new event', 'Human-readable description.');
```

The settings UI, bell filter tabs, and admin send-history view pick the new event up automatically because they read `notification_events` + `notification_categories` rather than hardcoded lists.

**Step 3 — (Optional) Add an email resolver** if the email body needs DB lookup (`apps/web/lib/email/resolvers/`). If the caller passes the full payload OR there's no email channel, skip.

Adding a new **category** is a pure seed INSERT into `notification_categories` (with an `icon_name` from `lucide-react`). The settings UI auto-groups by `display_order` (`<70` Activity, `=70` Account & security, `>70` Other).

