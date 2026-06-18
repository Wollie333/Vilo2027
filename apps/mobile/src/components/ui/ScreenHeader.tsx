import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { Icon } from "./Icon";
import { brand } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Hairline bottom border (used on scrolling list screens). */
  bordered?: boolean;
};

// Sticky screen header matching the design's px-5 pt-[~60px] header band.
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  bordered = false,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={`bg-white px-5 pb-3 ${bordered ? "border-b border-brand-line" : ""}`}
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center gap-[10px]">
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityLabel="Back"
              className="h-10 w-10 items-center justify-center rounded-full border border-brand-line active:bg-brand-light"
            >
              <Icon icon={ArrowLeft} size={20} color={brand.ink} />
            </Pressable>
          ) : null}
          <View className="min-w-0 flex-1">
            {subtitle ? (
              <Text className="font-sans text-[12px] text-brand-mute">
                {subtitle}
              </Text>
            ) : null}
            <Text className="font-display-extrabold text-[21px] leading-tight text-brand-ink">
              {title}
            </Text>
          </View>
        </View>
        {right ? (
          <View className="flex-row items-center gap-2">{right}</View>
        ) : null}
      </View>
    </View>
  );
}
