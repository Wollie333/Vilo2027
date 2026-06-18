import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { MapPin, Star } from "lucide-react-native";

import { Icon } from "@/components/ui";
import { brand } from "@/theme/tokens";
import { formatMoney } from "@/lib/format";
import { coverPhoto, type DirectoryProperty } from "@/lib/queries/properties";

// Featured/search stay card mirroring the design's stay card.
export function PropertyCard({
  property,
  onPress,
}: {
  property: DirectoryProperty;
  onPress?: () => void;
}) {
  const photo = coverPhoto(property);
  const location = [property.city, property.province]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable onPress={onPress} className="active:opacity-90">
      <View
        className="overflow-hidden rounded-card bg-brand-light"
        style={{ aspectRatio: 4 / 3 }}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ flex: 1 }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon icon={MapPin} size={28} color={brand.mute} />
          </View>
        )}
      </View>

      <View className="mt-2.5 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            className="font-display text-[15px] text-brand-ink"
          >
            {property.name}
          </Text>
          {location ? (
            <Text
              numberOfLines={1}
              className="mt-0.5 font-sans text-[12.5px] text-brand-mute"
            >
              {location}
            </Text>
          ) : null}
        </View>
        {property.avg_rating ? (
          <View className="flex-row items-center gap-1">
            <Icon icon={Star} size={13} color={brand.ink} />
            <Text className="font-sans-semibold text-[12.5px] text-brand-ink">
              {property.avg_rating.toFixed(1)}
            </Text>
          </View>
        ) : null}
      </View>

      {property.base_price != null ? (
        <Text className="mt-1 font-sans text-[13px] text-brand-ink">
          <Text className="font-sans-bold">
            {formatMoney(property.base_price, property.currency)}
          </Text>
          <Text className="text-brand-mute"> night</Text>
        </Text>
      ) : null}
    </Pressable>
  );
}
