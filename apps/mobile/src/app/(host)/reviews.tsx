import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Star } from "lucide-react-native";

import {
  Button,
  EmptyState,
  Icon,
  pullRefresh,
  ScreenHeader,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  useHostReviews,
  useRespondToReview,
  type HostReview,
} from "@/lib/queries/host-catalogue";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function HostReviews() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { host } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useHostReviews(
    host?.id,
  );

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.reviews.title")}
        subtitle={t("host.reviews.subtitle")}
        onBack={() => router.back()}
        bordered
      />
      <ScrollView
        className="flex-1"
        refreshControl={pullRefresh({
          refreshing: isRefetching,
          onRefresh: refetch,
        })}
        contentContainerStyle={{
          padding: 20,
          gap: 12,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={120} rounded={16} />)
        ) : isError ? (
          <EmptyState
            icon={Star}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Star}
            title={t("host.reviews.emptyTitle")}
            message={t("host.reviews.emptyMessage")}
          />
        ) : (
          data.map((review) => (
            <ReviewCard key={review.id} review={review} hostId={host?.id} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <View className="flex-row items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          icon={Star}
          size={14}
          color={n <= Math.round(rating) ? "#F59E0B" : brand.line}
        />
      ))}
    </View>
  );
}

function ReviewCard({
  review,
  hostId,
}: {
  review: HostReview;
  hostId: string | undefined;
}) {
  const respond = useRespondToReview(hostId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.host_response ?? "");

  const date = new Date(review.created_at).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  function onSave() {
    respond.mutate(
      { reviewId: review.id, response: draft },
      {
        onSuccess: () => setEditing(false),
        onError: () =>
          Alert.alert(t("common.errorTitle"), t("common.errorMessage")),
      },
    );
  }

  return (
    <View className="rounded-card border border-brand-line p-4">
      <View className="flex-row items-center justify-between">
        <Stars rating={review.rating} />
        <Text className="font-sans text-[12px] text-brand-mute">{date}</Text>
      </View>
      {review.body ? (
        <Text className="mt-2 font-sans text-[13.5px] leading-relaxed text-brand-ink">
          {review.body}
        </Text>
      ) : null}

      {/* Host response */}
      <View className="mt-3 border-t border-brand-line pt-3">
        {editing ? (
          <View className="gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              numberOfLines={3}
              placeholder={t("host.reviews.responsePlaceholder")}
              placeholderTextColor="#A6BFB1"
              textAlignVertical="top"
              className="w-full rounded-[12px] border-[1.5px] border-brand-line bg-white px-[14px] py-[11px] font-sans text-[14px] text-brand-ink"
              style={{ minHeight: 72 }}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label={t("common.save")}
                  onPress={onSave}
                  loading={respond.isPending}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={t("common.cancel")}
                  variant="secondary"
                  onPress={() => {
                    setDraft(review.host_response ?? "");
                    setEditing(false);
                  }}
                />
              </View>
            </View>
          </View>
        ) : review.host_response ? (
          <View>
            <Text className="font-sans-semibold text-[12px] text-brand-mute">
              {t("host.reviews.yourResponse")}
            </Text>
            <Text className="mt-1 font-sans text-[13.5px] leading-relaxed text-brand-ink">
              {review.host_response}
            </Text>
            <Text
              onPress={() => setEditing(true)}
              className="mt-2 font-sans-semibold text-[13px] text-brand-primary"
            >
              {t("host.reviews.editResponse")}
            </Text>
          </View>
        ) : (
          <Text
            onPress={() => setEditing(true)}
            className="font-sans-semibold text-[13px] text-brand-primary"
          >
            {t("host.reviews.respond")}
          </Text>
        )}
      </View>
    </View>
  );
}
