// Harness for confirmSubscriptionByReference — the native-subscription-rail
// return-page activation FALLBACK (Phase 2 of the subscription→product onboarding
// plan). The dashboard plan-picker rail used to rely on the Paystack webhook
// (processSubscriptionEvent) as its SOLE activator; that webhook has a history of
// not firing, leaving a host charged but not upgraded. This proves the fallback:
//
//  1. unknown reference        → no-op (not a native checkout we own)
//  2. already-completed row    → idempotent no-op, payment NOT re-verified
//  3. unpaid (verify=false)    → never activates; ledger stays pending
//  4. lost compare-and-set     → the OTHER writer (webhook) activated; we don't
//  5. paid + won the flip      → ledger completed + subscription upgraded to the
//                                product (product_id/plan/status), credits + welcome
//
// It drives the REAL confirmSubscriptionByReference with an in-memory DB and the
// injectable verifyPaid seam, so the flip+activate path is exercised without a
// live Paystack call. The founder smoke-test (a real test-mode payment with the
// webhook suppressed) is the end-to-end complement to this.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const dbHolder = {
    tables: {} as Record<string, Record<string, unknown>[]>,
    // A test may install a hook that runs right before any UPDATE (used to
    // simulate a concurrent writer winning the compare-and-set flip).
    onBeforeUpdate: undefined as
      | ((table: string, filters: [string, unknown, string][]) => void)
      | undefined,
  };
  return {
    dbHolder,
    accrueAffiliateAndNotify: vi.fn(async () => {}),
    grantSubscriptionCredits: vi.fn(async () => {}),
    grantCreditsForOrder: vi.fn(async () => {}),
    dispatchEvent: vi.fn(async () => {}),
    isFoundingOffersOpen: vi.fn(async () => false),
  };
});

// React 18.2 (Next 14) has no `cache()`, so lib/brand.ts (and its importers,
// pulled in transitively by product-checkout) throw "cache is not a function" at
// load. Give react an identity `cache` so the whole graph loads in the node env.
vi.mock("react", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  cache: <T>(fn: T) => fn,
}));

// Plain factory mocks (NOT importActual) — spreading the real modules would load
// their graph (dispatch → brand.ts → React cache) which explodes in the node test
// env. We only need the exports product-checkout actually imports from each.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () =>
    makeClient(mocks.dbHolder.tables, mocks.dbHolder.onBeforeUpdate),
}));
vi.mock("@/lib/affiliate/notify", () => ({
  accrueAffiliateAndNotify: mocks.accrueAffiliateAndNotify,
}));
vi.mock("@/lib/credits/wallet", () => ({
  grantSubscriptionCredits: mocks.grantSubscriptionCredits,
  grantCreditsForOrder: mocks.grantCreditsForOrder,
}));
vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchEvent: mocks.dispatchEvent,
}));
vi.mock("@/lib/billing/recurring", () => ({
  isFoundingOffersOpen: mocks.isFoundingOffersOpen,
  isPayPalRecurringEnabled: vi.fn(async () => false),
}));

import { confirmSubscriptionByReference } from "./product-checkout";

// ── Minimal in-memory supabase-js client ────────────────────────────────────
// Supports the query shapes confirmSubscriptionByReference + activateMappedPlan
// use: select/.eq/.in/.maybeSingle, awaited select, update+.eq/.in (+.select),
// insert+.select/.maybeSingle. `onBeforeUpdate` lets a test simulate a concurrent
// writer flipping a row right before our compare-and-set update runs.
type Row = Record<string, unknown>;
function makeClient(
  tables: Record<string, Row[]>,
  onBeforeUpdate?: (
    table: string,
    filters: [string, unknown, string][],
  ) => void,
) {
  return {
    from(table: string) {
      const rows = (tables[table] ||= []);
      let op: "select" | "update" | "insert" | "delete" = "select";
      let payload: Row | Row[] | null = null;
      const filters: [string, unknown, string][] = [];
      const match = (r: Row) =>
        filters.every(([k, v, kind]) =>
          kind === "in" ? (v as unknown[]).includes(r[k]) : r[k] === v,
        );
      const run = (): Row[] => {
        if (op === "update") {
          onBeforeUpdate?.(table, filters);
          const hit = rows.filter(match);
          for (const r of hit) Object.assign(r, payload as Row);
          return hit;
        }
        if (op === "insert") {
          const list = Array.isArray(payload) ? payload : [payload as Row];
          const made = list.map((r) => ({
            id: (r.id as string) ?? `id_${Math.random().toString(36).slice(2)}`,
            ...r,
          }));
          rows.push(...made);
          return made;
        }
        if (op === "delete") {
          const hit = rows.filter(match);
          for (const r of hit) rows.splice(rows.indexOf(r), 1);
          return hit;
        }
        return rows.filter(match);
      };
      const q = {
        select: (cols?: string) => {
          void cols;
          return q;
        },
        update: (p: Row) => ((op = "update"), (payload = p), q),
        insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), q),
        delete: () => ((op = "delete"), q),
        eq: (k: string, v: unknown) => (filters.push([k, v, "eq"]), q),
        in: (k: string, v: unknown[]) => (filters.push([k, v, "in"]), q),
        not: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        single: async () => ({ data: run()[0] ?? null, error: null }),
        then: (res: (v: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve({ data: run(), error: null }).then(res),
      };
      return q;
    },
  };
}

const REF = "sub_host-1_1700000000";

// A fresh clean-slate world for each test: super-admin-only DB analogue — one host
// with the baseline free subscription (product_id null), the Starter membership
// product (slug 'pro'), and its plan key.
function seedWorld(ledgerStatus: "pending" | "completed" = "pending") {
  mocks.dbHolder.tables = {
    platform_ledger: [
      {
        id: "led-1",
        provider_reference: REF,
        type: "charge",
        status: ledgerStatus,
        user_id: "user-1",
        host_id: "host-1",
        plan: "pro",
        billing_cycle: "monthly",
        environment: "test",
        amount: 999,
        currency: "ZAR",
      },
    ],
    products: [
      {
        id: "prod-pro",
        slug: "pro",
        plan_key: "pro",
        product_type: "membership",
        billing_cycle: "monthly",
        founding_price: null,
      },
    ],
    hosts: [{ id: "host-1", user_id: "user-1" }],
    subscriptions: [
      {
        id: "sub-base",
        host_id: "host-1",
        product_id: null,
        plan: "free",
        status: "active",
      },
    ],
    plans: [{ key: "pro" }],
  };
}

const paid = { verifyPaid: async () => true };
const unpaid = { verifyPaid: async () => false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dbHolder.onBeforeUpdate = undefined;
});

describe("confirmSubscriptionByReference — native-rail activation fallback", () => {
  it("no-ops for an unknown reference (not a native checkout we own)", async () => {
    mocks.dbHolder.tables = { platform_ledger: [] };
    const r = await confirmSubscriptionByReference("sub_nope", paid);
    expect(r).toEqual({ ok: true, activated: false });
    expect(mocks.accrueAffiliateAndNotify).not.toHaveBeenCalled();
  });

  it("is idempotent when the row is already completed — never re-verifies", async () => {
    seedWorld("completed");
    const verifyPaid = vi.fn(async () => true);
    const r = await confirmSubscriptionByReference(REF, { verifyPaid });
    expect(r).toEqual({ ok: true, activated: true });
    // Short-circuits before verify + before any activation.
    expect(verifyPaid).not.toHaveBeenCalled();
    expect(mocks.grantSubscriptionCredits).not.toHaveBeenCalled();
  });

  it("never activates an unverified payment; the ledger stays pending", async () => {
    seedWorld("pending");
    const r = await confirmSubscriptionByReference(REF, unpaid);
    expect(r).toEqual({ ok: true, activated: false });
    expect(mocks.dbHolder.tables.platform_ledger[0].status).toBe("pending");
    expect(mocks.dbHolder.tables.subscriptions[0].product_id).toBeNull();
    expect(mocks.grantSubscriptionCredits).not.toHaveBeenCalled();
  });

  it("yields to the webhook when it loses the compare-and-set flip", async () => {
    seedWorld("pending");
    // Simulate the webhook winning the flip a beat before us: the row is already
    // completed by the time our guarded update (status='pending') runs, so it
    // matches nothing and we must NOT activate a second time.
    mocks.dbHolder.onBeforeUpdate = (table, filters) => {
      if (
        table === "platform_ledger" &&
        filters.some(([k, v]) => k === "status" && v === "pending")
      ) {
        const led = mocks.dbHolder.tables.platform_ledger[0];
        if (led) led.status = "completed";
      }
    };

    const r = await confirmSubscriptionByReference(REF, paid);
    expect(r).toEqual({ ok: true, activated: true });
    // We bailed after the lost flip — no activation side effects.
    expect(mocks.accrueAffiliateAndNotify).not.toHaveBeenCalled();
    expect(mocks.grantSubscriptionCredits).not.toHaveBeenCalled();
    const activeProd = mocks.dbHolder.tables.subscriptions.find(
      (s) => s.product_id === "prod-pro",
    );
    expect(activeProd).toBeUndefined();
  });

  it("upgrades the account when payment is verified and the flip wins", async () => {
    seedWorld("pending");
    const r = await confirmSubscriptionByReference(REF, paid);
    expect(r).toEqual({ ok: true, activated: true });

    // Ledger flipped to completed (invoice mints off this in the real DB trigger).
    expect(mocks.dbHolder.tables.platform_ledger[0].status).toBe("completed");
    expect(mocks.dbHolder.tables.platform_ledger[0].paid_at).toBeTruthy();

    // The host now holds an ACTIVE subscription on the purchased product, so
    // check_feature_permission resolves features from product_features.
    const active = mocks.dbHolder.tables.subscriptions.find(
      (s) => s.product_id === "prod-pro" && s.status === "active",
    );
    expect(active).toBeDefined();
    expect(active?.plan).toBe("pro");

    // The product-less baseline membership was retired (one active membership rule).
    const baseline = mocks.dbHolder.tables.subscriptions.find(
      (s) => s.id === "sub-base",
    );
    expect(baseline?.status).toBe("cancelled");

    // Commission accrual + credit grant + welcome all fired exactly once.
    expect(mocks.accrueAffiliateAndNotify).toHaveBeenCalledWith(
      expect.anything(),
      "led-1",
    );
    expect(mocks.grantSubscriptionCredits).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
