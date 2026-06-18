import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  BedDouble,
  MapPin,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react-native";

import { Avatar, Button, Icon, Skeleton, EmptyState } from "@/components/ui";
import { brand } from "@/theme/tokens";
import { formatMoney } from "@/lib/format";
import {
  coverPhoto,
  usePropertyDetail,
  usePropertyReviews,
} from "@/lib/queries/properties";

export default function PropertyDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: property, isLoading, isError } = usePropertyDetail(slug);
  const { data: reviews } = usePropertyReviews(property?.id);

  if (isLoading) {
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
        <Skeleton height={300} rounded={0} />
        <View className="gap-3 p-5">
          <Skeleton height={22} width="70%" />
          <Skeleton height={14} width="45%" />
          <Skeleton height={80} />
        </View>
      </View>
    );
  }

  if (isError || !property) {
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 8 }}>
        <Pressable
          onPress={() => router.back()}
          className="ml-3 h-10 w-10 items-center justify-center rounded-full border border-brand-line"
        >
          <Icon icon={ArrowLeft} size={20} color={brand.ink} />
        </Pressable>
        <EmptyState
          icon={MapPin}
          title="Stay not found"
          message="This listing may no longer be available."
        />
      </View>
    );
  }

  const photo = coverPhoto(property);
  const location = [property.city, property.province, property.country]
    .filter(Boolean)
    .join(", ");
  const activeRooms = (property.property_rooms ?? []).filter(
    (r) => r.is_active,
  );
  const fromPrice = property.base_price ?? activeRooms[0]?.base_price ?? null;

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Hero photo */}
        <View className="bg-brand-light" style={{ height: 320 }}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={{ flex: 1 }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Icon icon={MapPin} size={32} color={brand.mute} />
            </View>
          )}
          <Pressable
            onPress={() => router.back()}
            className="absolute left-4 h-10 w-10 items-center justify-center rounded-full bg-white"
            style={{ top: insets.top + 4 }}
          >
            <Icon icon={ArrowLeft} size={20} color={brand.ink} />
          </Pressable>
        </View>

        <View className="px-5 pt-4">
          <Text className="font-display-extrabold text-[22px] leading-tight text-brand-ink">
            {property.name}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-3">
            {property.avg_rating ? (
              <View className="flex-row items-center gap-1">
                <Icon icon={Star} size={14} color={brand.ink} />
                <Text className="font-sans-semibold text-[13px] text-brand-ink">
                  {property.avg_rating.toFixed(1)}
                </Text>
                <Text className="font-sans text-[13px] text-brand-mute">
                  ({property.total_reviews})
                </Text>
              </View>
            ) : null}
            {location ? (
              <Text
                numberOfLines={1}
                className="flex-1 font-sans text-[13px] text-brand-mute"
              >
                {location}
              </Text>
            ) : null}
          </View>

          {/* Quick facts */}
          <View className="mt-4 flex-row flex-wrap gap-x-5 gap-y-2">
            {property.max_guests ? (
              <Fact icon={Users} label={`${property.max_guests} guests`} />
            ) : null}
            {property.bedrooms ? (
              <Fact icon={BedDouble} label={`${property.bedrooms} bedrooms`} />
            ) : null}
            {property.cancellation_policy_label ? (
              <Fact
                icon={ShieldCheck}
                label={property.cancellation_policy_label}
              />
            ) : null}
          </View>

          {/* Host */}
          {property.hosts ? (
            <View className="mt-5 flex-row items-center gap-3 rounded-card border border-brand-line p-3.5">
              <Avatar
                name={property.hosts.display_name}
                uri={property.hosts.avatar_url}
                size={44}
              />
              <View className="flex-1">
                <Text className="font-display text-[14px] text-brand-ink">
                  Hosted by {property.hosts.display_name}
                </Text>
                {property.hosts.is_superhost ? (
                  <Text className="font-sans text-[12px] text-brand-primary">
                    Superhost
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Description */}
          {property.description ? (
            <Text className="mt-5 font-sans text-[14px] leading-relaxed text-brand-ink">
              {property.description}
            </Text>
          ) : null}

          {/* Rooms */}
          {activeRooms.length > 0 ? (
            <View className="mt-6">
              <Text className="mb-3 font-display text-[17px] text-brand-ink">
                Rooms
              </Text>
              <View className="gap-3">
                {activeRooms.map((room) => (
                  <View
                    key={room.id}
                    className="flex-row items-center justify-between rounded-card border border-brand-line p-3.5"
                  >
                    <View className="min-w-0 flex-1 pr-3">
                      <Text className="font-display text-[14px] text-brand-ink">
                        {room.name}
                      </Text>
                      <Text className="font-sans text-[12px] text-brand-mute">
                        Sleeps {room.max_guests}
                        {room.bed_type ? ` · ${room.bed_type}` : ""}
                      </Text>
                    </View>
                    <Text className="font-sans-bold text-[14px] text-brand-ink">
                      {formatMoney(room.base_price, room.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Reviews */}
          {reviews && reviews.length > 0 ? (
            <View className="mt-6">
              <Text className="mb-3 font-display text-[17px] text-brand-ink">
                Reviews
              </Text>
              <View className="gap-3">
                {reviews.slice(0, 5).map((rev) => (
                  <View
                    key={rev.id}
                    className="rounded-card border border-brand-line p-3.5"
                  >
                    <View className="flex-row items-center gap-1">
                      <Icon icon={Star} size={13} color={brand.ink} />
                      <Text className="font-sans-semibold text-[13px] text-brand-ink">
                        {rev.rating}
                      </Text>
                    </View>
                    {rev.body ? (
                      <Text className="mt-1.5 font-sans text-[13px] leading-relaxed text-brand-ink">
                        {rev.body}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky reserve bar */}
      <View
        className="flex-row items-center gap-4 border-t border-brand-line bg-white px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-1">
          {fromPrice != null ? (
            <Text className="font-sans text-[13px] text-brand-ink">
              <Text className="font-display text-[18px]">
                {formatMoney(fromPrice, property.currency)}
              </Text>
              <Text className="text-brand-mute"> /night</Text>
            </Text>
          ) : null}
        </View>
        <View className="flex-1">
          <Button
            label={property.instant_booking ? "Book now" : "Request to book"}
            onPress={() =>
              router.push({
                pathname: "/(guest)/checkout",
                params: { slug: property.slug ?? "" },
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

function Fact({ icon, label }: { icon: typeof Users; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon icon={icon} size={16} color={brand.mute} />
      <Text className="font-sans text-[13px] text-brand-ink">{label}</Text>
    </View>
  );
}
