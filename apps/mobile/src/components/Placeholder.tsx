import { View } from "react-native";
import { Hammer } from "lucide-react-native";
import { EmptyState, ScreenHeader } from "@/components/ui";

// Temporary screen body used while a route is scaffolded but not yet wired to
// real data. Replaced phase-by-phase.
export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={title} bordered />
      <EmptyState
        icon={Hammer}
        title="Coming together"
        message={
          note ??
          "This screen is scaffolded — real data and actions are wired in an upcoming phase."
        }
      />
    </View>
  );
}
