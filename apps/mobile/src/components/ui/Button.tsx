import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon, type IconComponent } from "./Icon";
import { brand } from "@/theme/tokens";

type Variant = "primary" | "secondary" | "social";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconComponent;
  iconRight?: IconComponent;
  loading?: boolean;
  disabled?: boolean;
};

// Mirrors .btn-primary / .btn-social from the design source.
const containerByVariant: Record<Variant, string> = {
  primary: "bg-brand-primary active:bg-brand-secondary",
  secondary: "bg-brand-light active:bg-brand-accent border border-brand-line",
  social: "bg-white border border-brand-line active:bg-brand-light",
};

const textByVariant: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-brand-ink",
  social: "text-brand-ink",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  iconRight,
  loading = false,
  disabled = false,
}: Props) {
  const isDisabled = disabled || loading;
  const tint = variant === "primary" ? brand.white : brand.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`w-full flex-row items-center justify-center gap-2 rounded-[13px] px-4 py-[15px] ${
        containerByVariant[variant]
      } ${isDisabled ? "opacity-60" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <>
          {icon ? <Icon icon={icon} size={18} color={tint} /> : null}
          <Text
            className={`font-sans-semibold text-[15.5px] ${textByVariant[variant]}`}
          >
            {label}
          </Text>
          {iconRight ? (
            <View>
              <Icon icon={iconRight} size={18} color={tint} />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
