import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  useUpdateHostProfile,
  type HostProfilePatch,
} from "@/lib/queries/host-catalogue";
import { t } from "@/i18n";

export default function HostSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { host, refreshProfile } = useAuth();
  const update = useUpdateHostProfile(host?.id);

  const [displayName, setDisplayName] = useState(host?.display_name ?? "");
  const [bio, setBio] = useState(host?.bio ?? "");
  const [website, setWebsite] = useState(host?.website_url ?? "");

  function onSave() {
    if (!displayName.trim()) {
      Alert.alert(t("host.settings.nameRequired"));
      return;
    }
    const patch: HostProfilePatch = {
      display_name: displayName.trim(),
      bio: bio.trim() || null,
      website_url: website.trim() || null,
    };
    update.mutate(patch, {
      onSuccess: async () => {
        await refreshProfile();
        router.back();
      },
      onError: () =>
        Alert.alert(t("common.errorTitle"), t("common.errorMessage")),
    });
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.settings.title")}
        subtitle={t("host.settings.subtitle")}
        onBack={() => router.back()}
        bordered
      />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: insets.bottom + 96,
        }}
      >
        <LabeledField label={t("host.settings.displayName")}>
          <Input value={displayName} onChangeText={setDisplayName} />
        </LabeledField>

        {host?.handle ? (
          <LabeledField label={t("host.settings.handle")}>
            <Text className="font-mono text-[14px] text-brand-mute">
              @{host.handle}
            </Text>
          </LabeledField>
        ) : null}

        <LabeledField label={t("host.settings.bio")}>
          <Input
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={5}
          />
        </LabeledField>

        <LabeledField label={t("host.settings.website")}>
          <Input
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://"
          />
        </LabeledField>

        <View className="mt-2">
          <Button
            label={t("common.save")}
            onPress={onSave}
            loading={update.isPending}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="mb-1.5 font-sans-semibold text-[13px] text-brand-ink">
        {label}
      </Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { multiline, style, ...rest } = props;
  return (
    <TextInput
      {...rest}
      multiline={multiline}
      placeholderTextColor="#A6BFB1"
      textAlignVertical={multiline ? "top" : "center"}
      className="w-full rounded-[12px] border-[1.5px] border-brand-line bg-white px-[14px] py-[13px] font-sans text-[15px] text-brand-ink"
      style={[multiline ? { minHeight: 96 } : null, style]}
    />
  );
}
