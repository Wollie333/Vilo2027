import { Text, View } from "react-native";
import { Icon, type IconComponent } from "./Icon";
import { brand } from "@/theme/tokens";

type Props = {
  icon: IconComponent;
  title: string;
  message?: string;
};

export function EmptyState({ icon, title, message }: Props) {
  return (
    <View className="items-center justify-center px-8 py-16">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-light">
        <Icon icon={icon} size={28} color={brand.primary} />
      </View>
      <Text className="mt-4 font-display text-[16px] text-brand-ink">
        {title}
      </Text>
      {message ? (
        <Text className="mt-1 text-center font-sans text-[13px] leading-relaxed text-brand-mute">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
