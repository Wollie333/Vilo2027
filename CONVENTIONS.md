# Vilo Platform — Code Conventions

**Version:** 1.0
**Last Updated:** May 2026
**Companion Docs:** `DEVSTACK.md`, `ARCHITECTURE.md`, `AGENT_RULES.md`

---

## 1. TypeScript

### 1.1 Strict mode — always on
`tsconfig.json` has `"strict": true`. This is non-negotiable.

### 1.2 No `any`
Use `unknown` and narrow the type. Use the generated database types. Use Zod inference.

```typescript
// ❌
function process(data: any) {}

// ✅
function process(data: unknown) {
  const parsed = bookingSchema.parse(data);
}

// ✅ Use inferred types from Zod schemas
type CreateBookingInput = z.infer<typeof createBookingSchema>;
```

### 1.3 Use database-generated types for all Supabase queries
```typescript
import type { Database } from '@vilo/types/database.types';
type Booking = Database['public']['Tables']['bookings']['Row'];
```

### 1.4 Explicit return types on all Edge Function handlers and Server Actions
```typescript
// ✅
async function confirmBooking(bookingId: string): Promise<BookingConfirmResponse> {}

// ❌
async function confirmBooking(bookingId: string) {}
```

---

## 2. File & Folder Naming

### 2.1 Web app (`apps/web`)

| Type | Convention | Example |
|---|---|---|
| Pages / routes | `kebab-case` directories | `app/booking-detail/[id]/page.tsx` |
| Components | `PascalCase.tsx` | `BookingCard.tsx` |
| Hooks | `camelCase` with `use` prefix | `useBookingStatus.ts` |
| Server Actions | `camelCase` with verb | `confirmBooking.ts` |
| Stores (Zustand) | `camelCase` with `Store` suffix | `bookingStore.ts` |
| Zod Schemas | `camelCase` with `Schema` suffix | `createBookingSchema.ts` |
| Utils | `camelCase` | `formatCurrency.ts` |
| Types (non-DB) | `PascalCase` in `.types.ts` file | `BookingTypes.types.ts` |

### 2.2 Mobile app (`apps/mobile`)

Same conventions as web. Route files follow Expo Router conventions:
- `(tabs)/` for tab navigator
- `(auth)/` for auth stack
- `[id].tsx` for dynamic routes

### 2.3 Edge Functions (`supabase/functions`)

| Type | Convention | Example |
|---|---|---|
| Function folder | `kebab-case` | `booking-create/` |
| Entry point | `index.ts` | `booking-create/index.ts` |
| Shared helpers | `_shared/` at functions root | `supabase/functions/_shared/auth.ts` |

### 2.4 Database migrations

```
YYYYMMDDHHMMSS_description_in_snake_case.sql
20260501120000_add_refund_status_index.sql
```

---

## 3. Component Conventions (Web)

### 3.1 Server Components are the default
In Next.js App Router, all components are Server Components by default. Only add `'use client'` when you need:
- `useState` / `useEffect` / other React hooks
- Browser APIs
- Event listeners
- Supabase Realtime subscriptions

```typescript
// ✅ Server Component — no directive needed
export default async function BookingList({ hostId }: { hostId: string }) {
  const bookings = await getBookings(hostId); // server-side fetch
  return <ul>...</ul>;
}

// ✅ Client Component — only when necessary
'use client';
export function BookingStatusBadge({ status }: { status: string }) {
  const [isAnimating, setIsAnimating] = useState(false);
  ...
}
```

### 3.2 Component file structure
```typescript
// 1. Imports
import { ... } from '...';

// 2. Types / interfaces
type Props = { ... };

// 3. Component
export function ComponentName({ prop }: Props) {
  // 4. Hooks first
  const [state, setState] = useState();

  // 5. Derived values
  const computed = useMemo(() => ..., []);

  // 6. Handlers
  function handleClick() { ... }

  // 7. Render
  return ( ... );
}
```

### 3.3 shadcn/ui components
- Never modify files inside `components/ui/` directly
- Extend via wrapper components in `components/` (e.g. `components/BookingButton.tsx` wraps `components/ui/button.tsx`)

### 3.4 Loading states
Every data-fetching component must handle loading and error states. Use Suspense + loading.tsx for page-level loading. Use skeleton components for inline loading.

---

## 4. State Management (Zustand)

### 4.1 One store per domain
```
lib/stores/
  bookingStore.ts
  inboxStore.ts
  authStore.ts
  subscriptionStore.ts
```

### 4.2 Store shape convention
```typescript
interface BookingStore {
  // State
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;

  // Actions — always verbs
  fetchBookings: (hostId: string) => Promise<void>;
  confirmBooking: (bookingId: string) => Promise<void>;
  clearError: () => void;
}
```

### 4.3 Server-fetched data lives in Server Components — not Zustand
Zustand is for **client-side interaction state** (UI state, optimistic updates, realtime). Don't use it to cache data that Next.js can fetch server-side.

---

## 4b. Server State — TanStack Query

TanStack Query (`@tanstack/react-query` v5) handles all server-fetched data. It is the layer between the UI and Supabase for reads — not Zustand, not raw `useEffect`.

### Rule: Zustand vs TanStack Query

| Use Zustand for | Use TanStack Query for |
|---|---|
| UI state (open/closed modals, active tab) | Supabase data reads (listings, bookings, reviews) |
| Booking flow step tracking | Anything that needs background refetch |
| Auth session metadata | Anything that needs optimistic updates |
| Realtime state updates | Anything that should be cached across pages |
| Filter/sort preferences | Paginated lists |

**Never put remote data in a Zustand store.** If it came from Supabase, it lives in TanStack Query.

### Query key conventions

```typescript
// Always use descriptive arrays — never strings
['listings', hostId]
['bookings', { hostId, status: 'pending' }]
['booking', bookingId]
['reviews', listingId]
['conversation', conversationId]
```

### Standard query pattern

```typescript
import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';

function useBookings(hostId: string) {
  const supabase = createBrowserClient();

  return useQuery({
    queryKey: ['bookings', hostId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, status, check_in, check_out, guest_id')
        .eq('host_id', hostId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000, // 30 seconds — bookings don't change every second
  });
}
```

### Mutation pattern (with optimistic update)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useConfirmBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) =>
      fetch(`/functions/v1/booking-confirm`, {
        method: 'POST',
        body: JSON.stringify({ booking_id: bookingId }),
      }),
    onSuccess: () => {
      // Invalidate and refetch all booking queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err) => {
      Sentry.captureException(err);
      toast.error('Could not confirm booking. Please try again.');
    },
  });
}
```

### QueryClient setup (web)

```typescript
// app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,       // 1 minute default
      retry: 1,                // one retry on failure
      refetchOnWindowFocus: false, // don't refetch on tab switch
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

---

## 5. API & Edge Functions

### 5.1 All Edge Functions return a consistent shape
```typescript
// Success
return new Response(JSON.stringify({
  success: true,
  data: { ... }
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

// Error
return new Response(JSON.stringify({
  success: false,
  error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' }
}), { status: 404, headers: { 'Content-Type': 'application/json' } });
```

### 5.2 Error codes are SCREAMING_SNAKE_CASE strings
```typescript
// ✅
error: { code: 'DATES_UNAVAILABLE', message: '...' }

// ❌
error: { code: 404, message: '...' }
```

### 5.3 Edge Functions always validate input with Zod
```typescript
const bodySchema = z.object({
  listing_id: z.string().uuid(),
  check_in: z.string().date(),
  check_out: z.string().date(),
});

const input = bodySchema.safeParse(await req.json());
if (!input.success) {
  return errorResponse('INVALID_INPUT', input.error.message, 400);
}
```

### 5.4 Shared Edge Function helpers live in `_shared/`
```
supabase/functions/_shared/
  auth.ts          # JWT verification helpers
  response.ts      # successResponse() / errorResponse() helpers
  supabase.ts      # createServiceClient() / createUserClient()
  email.ts         # sendEmail() wrapper for Resend
  push.ts          # sendPushNotification() wrapper for Expo
  ical.ts          # parseIcalFeed() / generateIcalFeed() helpers (RFC 5545)
```

---

## 6. Forms

### 6.1 All forms use React Hook Form + Zod
No exceptions. No manual `useState` form handling.

```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
});
```

### 6.2 Schemas are colocated or in `packages/schemas`
- If a schema is used only in one component: colocate it in the same file
- If a schema is shared (web + mobile, or form + Edge Function): put it in `packages/schemas/`

### 6.3 Submit handlers call Server Actions — not Supabase directly
```typescript
// ✅
async function onSubmit(data: FormData) {
  await createBookingAction(data); // Server Action
}

// ❌
async function onSubmit(data: FormData) {
  await supabase.from('bookings').insert(data); // direct client mutation
}
```

### 6.4 Saved-data card pattern
Every settings section and wizard step that persists structured data
follows the same two-state shape:

- **Empty** → render the form expanded.
- **Populated** → render a read-only summary **card** with a small
  Edit button (and a Delete button when the underlying record
  supports deletion). Editing swaps the card body for the form
  prefilled with current values; saving collapses back to the card.

For **collections** (multiple rows allowed — bank accounts, payout
methods, staff invites, listings…) repeat the card per row, plus an
`+ Add another …` outline button below the list. Exactly one row is
marked **Default** with an emerald badge; other rows surface a
`Set as default` action.

Visual baseline:
```tsx
<section className="rounded-card border border-brand-line bg-white shadow-card">
  <header className="border-b border-brand-line bg-brand-light/50 px-5 py-3">…</header>
  <div className="p-5">…</div>
</section>
```
Default badge: `bg-emerald-500/10 text-emerald-700`. Edit icon:
`Pencil`. Delete icon: `Trash2`. Use ghost-style icon buttons flush
right.

Reference implementation:
[`apps/web/app/dashboard/setup/steps/StepBanking.tsx`](apps/web/app/dashboard/setup/steps/StepBanking.tsx).

---

## 7. Styling

### 7.1 Tailwind utility classes only
No inline styles. No CSS modules. No styled-components.

### 7.2 Custom design tokens in `tailwind.config.ts`
Brand colours, font sizes, spacing overrides all live in the Tailwind config — not hardcoded in class names.

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: {
        DEFAULT: '#your-brand-color',
        dark: '#...',
        light: '#...',
      }
    }
  }
}
```

### 7.3 Responsive design: mobile-first
All Tailwind breakpoints are mobile-first (`sm:`, `md:`, `lg:`). Design for mobile, add desktop overrides.

### 7.4 Dark mode
Use Tailwind's `dark:` variant. The theme toggle is controlled by the `class` strategy in `tailwind.config.ts`.

### 7.5 Logged-in layout shell vs. full-bleed (Inbox)
Every logged-in page renders inside the **standard content shell** — padded (`px-5 py-6` / `lg:px-8 lg:py-8`) and capped at `max-w-[1280px]`, on a page that grows and scrolls naturally (`min-h-screen`).

The **Inbox is the one exception** and is **full-bleed** on *both* dashboards — host (`/dashboard/inbox`) and guest (`/portal/inbox`): full content width (no horizontal padding, no max-width cap) and full viewport height (`h-[100dvh] overflow-hidden` on the shell so internal scroll regions and the pinned composer resolve). It must **never** revert to the padded shell.

This is enforced by a single rule, not by per-layout copies:

```typescript
// apps/web/lib/layout/fullBleed.ts — the only place the rule lives
export const FULL_BLEED_ROUTES = new Set(['/dashboard/inbox', '/portal/inbox']);
```

Both `app/dashboard/layout.tsx` and `app/portal/layout.tsx` import `isFullBleedRoute()` and branch on it (pathname comes from the `x-pathname` request header set in middleware). **Do not** hardcode the route list in a layout, and **do not** wrap the inbox page in the padded shell. Matching is exact, so child routes (e.g. `/dashboard/inbox/templates`) intentionally keep the standard shell. A full-bleed page owns its own internal padding/scroll.

---

## 8. Notifications & Toasts

### 8.1 User-facing errors use toast — not alert() or console.error()
```typescript
// ✅
toast.error('Booking could not be confirmed. Please try again.');

// ❌
alert('Error');
console.error(err);
```

### 8.2 Toast messages are plain English for users
No error codes, no stack traces, no technical jargon in toast messages. Log the full error to Sentry.

### 8.3 Success toasts are short and specific
```typescript
// ✅
toast.success('Booking confirmed! Check your inbox for details.');

// ❌
toast.success('Success');
```

---

## 9. Currency & Dates

### 9.1 All amounts stored in the database as full units (not cents)
Paystack API uses kobo (cents × 100). Convert only when calling Paystack — store and display in Rands.

```typescript
// Storing in DB
amount: 1800.00  // ZAR, not 180000

// Calling Paystack
amount: Math.round(totalAmount * 100)  // kobo
```

### 9.2 Format currency using the shared utility
```typescript
import { formatCurrency } from '@vilo/utils/formatCurrency';
formatCurrency(1800, 'ZAR')  // → "R 1 800,00"
```

### 9.3 All dates stored as ISO 8601 strings or PostgreSQL `date`/`timestamptz`
No Unix timestamps. No local date strings. Use `date-fns` for all date manipulation.

---

## 10. Git Conventions

### 10.1 Branch naming
```
feature/    feature/booking-calendar-view
fix/        fix/paystack-webhook-signature
chore/      chore/upgrade-supabase-client
migration/  migration/add-refund-requests-table
```

### 10.2 Commit messages (Conventional Commits)
```
feat: add instant booking toggle to listing editor
fix: correct proration calculation on plan upgrade
chore: update @supabase/supabase-js to 2.43.2
migration: add policy_snapshots table
docs: update CONVENTIONS.md with toast rules
```

### 10.3 PRs require a passing build
CI runs `pnpm build` and `pnpm lint` on every PR. No merging on red CI.

---

*When in doubt about a convention not listed here — ask, then add the answer here.*
