"use server";

import { revalidatePath } from "next/cache";

import { withAdminAudit } from "@/lib/admin";

// Purge every TEST transactional record — the platform's own Wielo revenue
// tables tagged environment='test' (Paystack test-key purchases). LIVE rows are
// never touched. Use at launch (or any time) to clear test noise once the flow
// is verified. Deletes in FK order: invoices → ledger → orders.
export const clearTestDataAction = withAdminAudit<
  { reason?: string },
  { ok: true; deleted: { invoices: number; ledger: number; orders: number } }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.clear_test_data",
    targetType: "platform_ledger",
    getTargetId: () => "00000000-0000-0000-0000-0000000e5700",
  },
  async (_args, service) => {
    const del = async (table: string): Promise<number> => {
      const { data, error } = await service
        .from(table)
        .delete()
        .eq("environment", "test")
        .select("id");
      if (error) throw new Error(`${table}: ${error.message}`);
      return data?.length ?? 0;
    };
    // Order matters: wielo_invoices references platform_ledger + product_orders.
    const invoices = await del("wielo_invoices");
    const ledger = await del("platform_ledger");
    const orders = await del("product_orders");

    revalidatePath("/admin/platform/settings/payments");
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return {
      result: { ok: true, deleted: { invoices, ledger, orders } },
      after: { invoices, ledger, orders },
    };
  },
);

export async function clearTestData(): Promise<
  | { ok: true; deleted: { invoices: number; ledger: number; orders: number } }
  | { ok: false; error: string }
> {
  try {
    const r = await clearTestDataAction({});
    return { ok: true, deleted: r.deleted };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
