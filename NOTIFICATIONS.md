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
