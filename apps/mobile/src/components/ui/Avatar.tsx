import { Image } from "expo-image";
import { Text, View } from "react-native";

type Props = {
  /** Full name or label; initials are derived when no image is given. */
  name?: string | null;
  uri?: string | null;
  size?: number;
};

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

// Mirrors the .av initials avatar from the design source.
export function Avatar({ name, uri, size = 40 }: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      className="items-center justify-center rounded-full bg-brand-secondary"
      style={{ width: size, height: size }}
    >
      <Text
        className="font-display text-white"
        style={{ fontSize: size * 0.32 }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}
