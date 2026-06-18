import { Pressable, View, type ViewProps } from "react-native";

type Props = ViewProps & {
  onPress?: () => void;
  /** Adds default inner padding (p-4). */
  padded?: boolean;
};

// Mirrors .hcard from the design source: white, hairline border, card radius.
export function Card({
  onPress,
  padded = false,
  className = "",
  children,
  ...rest
}: Props) {
  const classes = `rounded-card border border-brand-line bg-white ${padded ? "p-4" : ""} ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${classes} active:bg-brand-light`}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={classes} {...rest}>
      {children}
    </View>
  );
}
