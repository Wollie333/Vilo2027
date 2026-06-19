import { useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { Icon, type IconComponent } from "./Icon";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

type Props = TextInputProps & {
  icon?: IconComponent;
  /** Render a password field with a show/hide toggle. */
  password?: boolean;
};

// Mirrors .field (left icon, rounded border, focus ring) from the design source.
export function Field({ icon, password = false, ...inputProps }: Props) {
  const [hidden, setHidden] = useState(password);
  const [focused, setFocused] = useState(false);

  return (
    <View className="relative w-full justify-center">
      {icon ? (
        <View className="absolute left-[15px] z-10">
          <Icon icon={icon} size={18} color={brand.mute} />
        </View>
      ) : null}

      <TextInput
        {...inputProps}
        secureTextEntry={hidden}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        placeholderTextColor="#A6BFB1"
        className={`w-full rounded-[12px] border-[1.5px] bg-white py-[13px] font-sans text-[15px] text-brand-ink ${
          icon ? "pl-[44px]" : "pl-[14px]"
        } ${password ? "pr-[44px]" : "pr-[14px]"} ${
          focused ? "border-brand-primary" : "border-brand-line"
        }`}
      />

      {password ? (
        <Pressable
          onPress={() => setHidden((h) => !h)}
          className="absolute right-3 h-8 w-8 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={
            hidden ? t("a11y.showPassword") : t("a11y.hidePassword")
          }
        >
          <Icon icon={hidden ? Eye : EyeOff} size={18} color={brand.mute} />
        </Pressable>
      ) : null}
    </View>
  );
}
