import { Pressable, Text, View } from "react-native";
import { Icon, type IconComponent } from "./Icon";
import { brand } from "@/theme/tokens";

type Props = {
  label: string;
  active?: boolean;
  count?: number;
  icon?: IconComponent;
  onPress?: () => void;
};

// Mirrors .hchip (host filter chip) from the design source.
export function Chip({ label, active = false, count, icon, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-[7px] rounded-pill px-[13px] py-2 ${
        active ? "bg-brand-ink" : "bg-brand-light"
      }`}
    >
      {icon ? (
        <Icon icon={icon} size={14} color={active ? brand.white : brand.mute} />
      ) : null}
      <Text
        className={`font-sans-semibold text-[12.5px] ${active ? "text-white" : "text-brand-mute"}`}
      >
        {label}
      </Text>
      {typeof count === "number" ? (
        <View
          className={`rounded-pill px-[6px] ${active ? "bg-white/20" : "bg-white"}`}
        >
          <Text
            className={`font-sans-bold text-[11px] ${active ? "text-white" : "text-brand-mute"}`}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
