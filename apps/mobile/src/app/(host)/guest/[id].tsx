import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Mail, Phone, Users } from "lucide-react-native";

import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  ScreenHeader,
  Skeleton,
  Tag,
} from "@/components/ui";
import { useHostGuest, useUpdateGuestNotes } from "@/lib/queries/guests";
import { brand } from "@/theme/tokens";

export default function HostGuestRecord() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: guest, isLoading, isError } = useHostGuest(id);
  const saveNotes = useUpdateGuestNotes(id);

  // Draft is null until the host edits, then falls back to the saved note —
  // avoids syncing fetched data into state via an effect.
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const notes = draft ?? guest?.notes ?? "";

  async function onSaveNotes() {
    setSaved(false);
    await saveNotes.mutateAsync(notes);
    setSaved(true);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 bg-white">
        <ScreenHeader title="Guest" onBack={() => router.back()} bordered />

        {isLoading ? (
          <View className="gap-3 p-5">
            <Skeleton height={56} rounded={14} />
            <Skeleton height={120} />
          </View>
        ) : isError || !guest ? (
          <EmptyState
            icon={Users}
            title="Guest not found"
            message="This contact may have been removed."
          />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-row items-center gap-3">
              <Avatar name={guest.name ?? guest.email} size={56} />
              <View className="min-w-0 flex-1">
                <Text className="font-display text-[18px] text-brand-ink">
                  {guest.name ?? guest.email}
                </Text>
                {guest.blocked ? (
                  <Tag label="Blocked" tone="red" dot={false} />
                ) : null}
              </View>
            </View>

            <View className="gap-3 rounded-card border border-brand-line p-4">
              <Row icon={Mail} value={guest.email} />
              {guest.phone ? <Row icon={Phone} value={guest.phone} /> : null}
            </View>

            {guest.tags.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {guest.tags.map((tag) => (
                  <Tag key={tag} label={tag} tone="gray" dot={false} />
                ))}
              </View>
            ) : null}

            {/* Private host note — live write */}
            <View className="gap-2">
              <Text className="font-display text-[14px] text-brand-ink">
                Private note
              </Text>
              <TextInput
                value={notes}
                onChangeText={(v) => {
                  setDraft(v);
                  setSaved(false);
                }}
                placeholder="Notes only you can see…"
                placeholderTextColor="#A6BFB1"
                multiline
                className="min-h-[96px] rounded-card border border-brand-line bg-white p-3 font-sans text-[14px] text-brand-ink"
                style={{ textAlignVertical: "top" }}
              />
              {saved ? (
                <Text className="font-sans text-[12px] text-brand-primary">
                  Saved — synced to your CRM.
                </Text>
              ) : null}
              <Button
                label="Save note"
                onPress={onSaveNotes}
                loading={saveNotes.isPending}
              />
            </View>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ icon, value }: { icon: typeof Users; value: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon icon={icon} size={16} color={brand.mute} />
      <Text className="font-sans text-[13px] text-brand-ink">{value}</Text>
    </View>
  );
}
