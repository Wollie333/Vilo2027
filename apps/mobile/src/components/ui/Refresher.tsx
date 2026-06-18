import { RefreshControl } from "react-native";
import { brand } from "@/theme/tokens";

/**
 * Brand-tinted RefreshControl for a ScrollView's `refreshControl` prop. Pass a
 * react-query result's `isRefetching` + `refetch` (refetch returns a promise,
 * which RefreshControl is happy to ignore).
 *
 *   <ScrollView refreshControl={pullRefresh({ refreshing: q.isRefetching, onRefresh: q.refetch })} />
 */
export function pullRefresh(opts: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <RefreshControl
      refreshing={opts.refreshing}
      onRefresh={opts.onRefresh}
      tintColor={brand.primary}
      colors={[brand.primary]}
    />
  );
}
