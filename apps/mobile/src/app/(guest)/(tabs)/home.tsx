import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowRight,
  Bell,
  MapPin,
  Percent,
  Search,
  SlidersHorizontal,
} from "lucide-react-native";

import { Avatar, Icon, Skeleton, EmptyState } from "@/components/ui";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useDirectoryProperties } from "@/lib/queries/properties";
import { useAuth } from "@/lib/auth/auth-provider";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function GuestHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const { data: properties, isLoading, isError } = useDirectoryProperties();

  const firstName = (
    profile?.full_name ??
    session?.user.email ??
    "there"
  ).split(/[\s@]/)[0];

  const featured = useMemo(() => {
    if (!properties) return [];
    const f = properties.filter((p) => p.is_featured);
    return f.length ? f : properties;
  }, [properties]);

  const destinations = useMemo(() => {
    const cities = new Set<string>();
    (properties ?? []).forEach((p) => p.city && cities.add(p.city));
    return [...cities].slice(0, 8);
  }, [properties]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Header */}
        <View
          className="bg-white px-5 pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-[12px] text-brand-mute">
                {greeting()}, {firstName}
              </Text>
              <Text className="font-display-extrabold text-[21px] leading-tight text-brand-ink">
                {t("guest.findYourNextStay")}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => router.push("/(guest)/notifications")}
                className="h-10 w-10 items-center justify-center rounded-full border border-brand-line active:bg-brand-light"
              >
                <Icon icon={Bell} size={19} color={brand.ink} />
              </Pressable>
              <Avatar
                name={profile?.full_name ?? firstName}
                uri={profile?.avatar_url}
                size={40}
              />
            </View>
          </View>

          {/* Search trigger */}
          <Pressable
            onPress={() => router.push("/(guest)/(tabs)/search")}
            className="mt-3.5 flex-row items-center gap-3 rounded-pill border border-brand-line bg-white px-4 py-3 active:bg-brand-light"
          >
            <Icon icon={Search} size={18} color={brand.primary} />
            <View className="min-w-0 flex-1">
              <Text className="font-sans-semibold text-[14px] text-brand-ink">
                {t("guest.whereTo")}
              </Text>
              <Text className="font-sans text-[11.5px] text-brand-mute">
                Anywhere · Any week · Add guests
              </Text>
            </View>
            <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-primary">
              <Icon icon={SlidersHorizontal} size={16} color={brand.white} />
            </View>
          </Pressable>
        </View>

        {isError ? (
          <EmptyState
            icon={MapPin}
            title="Couldn't load stays"
            message="Pull to retry in a moment."
          />
        ) : null}

        {/* Trending destinations */}
        {destinations.length > 0 ? (
          <View className="pl-5 pt-2">
            <Text className="mb-3 font-display text-[17px] text-brand-ink">
              {t("guest.trendingDestinations")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3 pr-5">
                {destinations.map((city) => (
                  <Pressable
                    key={city}
                    onPress={() => router.push("/(guest)/(tabs)/search")}
                    className="flex-row items-center gap-2 rounded-pill border border-brand-line px-4 py-2.5 active:bg-brand-light"
                  >
                    <Icon icon={MapPin} size={15} color={brand.primary} />
                    <Text className="font-sans-semibold text-[13px] text-brand-ink">
                      {city}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Featured stays */}
        <View className="px-5 pt-6">
          <Text className="mb-3 font-display text-[17px] text-brand-ink">
            {t("guest.featuredStays")}
          </Text>

          {isLoading ? (
            <View className="gap-5">
              {[0, 1].map((i) => (
                <View key={i}>
                  <Skeleton height={200} rounded={16} />
                  <Skeleton height={14} width="60%" className="mt-3" />
                  <Skeleton height={12} width="40%" className="mt-2" />
                </View>
              ))}
            </View>
          ) : featured.length === 0 && !isError ? (
            <EmptyState
              icon={MapPin}
              title="No stays yet"
              message="Published stays will appear here."
            />
          ) : (
            <View className="gap-5">
              {featured.map((p) => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  onPress={() =>
                    p.slug && router.push(`/(guest)/property/${p.slug}`)
                  }
                />
              ))}
            </View>
          )}
        </View>

        {/* Zero-fee strip */}
        <View className="px-5 pt-6">
          <Pressable
            onPress={() => router.push("/(auth)/for-hosts")}
            className="flex-row items-center gap-3 overflow-hidden rounded-card p-4"
            style={{ backgroundColor: brand.primary }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <Icon icon={Percent} size={20} color={brand.white} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-display text-[15px] text-white">
                List your place, keep every rand
              </Text>
              <Text className="mt-0.5 font-sans text-[12px] text-emerald-50">
                Zero commission — just a flat monthly fee.
              </Text>
            </View>
            <Icon icon={ArrowRight} size={20} color={brand.white} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
