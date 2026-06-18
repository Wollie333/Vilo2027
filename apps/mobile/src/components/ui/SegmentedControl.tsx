import { Pressable, Text, View } from "react-native";
import { Icon, type IconComponent } from "./Icon";
import { brand } from "@/theme/tokens";

export type Segment<T extends string> = {
  value: T;
  label: string;
  icon?: IconComponent;
};

type Props<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

// Mirrors .seg (pill segmented control) from the design source.
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: Props<T>) {
  return (
    <View className="flex-row gap-1 rounded-pill bg-[#EEF4F0] p-1">
      {segments.map((seg) => {
        const selected = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            onPress={() => onChange(seg.value)}
            className={`flex-1 flex-row items-center justify-center gap-[6px] rounded-pill py-[9px] ${
              selected ? "bg-white" : ""
            }`}
          >
            {seg.icon ? (
              <Icon
                icon={seg.icon}
                size={16}
                color={selected ? brand.ink : brand.mute}
              />
            ) : null}
            <Text
              className={`font-sans-semibold text-[13px] ${selected ? "text-brand-ink" : "text-brand-mute"}`}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
