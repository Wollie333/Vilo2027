import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Button, Field, ScreenHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  profileSchema,
  useUpdateProfile,
  type ProfileForm,
} from "@/lib/queries/profile";

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
  const update = useUpdateProfile(session?.user.id);
  const [saved, setSaved] = useState(false);

  const { control, handleSubmit, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      bio: profile?.bio ?? "",
    },
  });

  async function onSubmit(values: ProfileForm) {
    setSaved(false);
    await update.mutateAsync(values);
    await refreshProfile();
    setSaved(true);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1 bg-white">
        <ScreenHeader
          title="Edit profile"
          onBack={() => router.back()}
          bordered
        />
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1.5">
            <Text className="font-sans-semibold text-[12px] text-brand-mute">
              Full name
            </Text>
            <Controller
              control={control}
              name="full_name"
              render={({ field }) => (
                <Field
                  placeholder="Your name"
                  value={field.value}
                  onChangeText={field.onChange}
                />
              )}
            />
            {formState.errors.full_name ? (
              <Text className="font-sans text-[12px] text-status-cancelled">
                {formState.errors.full_name.message}
              </Text>
            ) : null}
          </View>

          <View className="gap-1.5">
            <Text className="font-sans-semibold text-[12px] text-brand-mute">
              Phone
            </Text>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Field
                  placeholder="Optional"
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  keyboardType="phone-pad"
                />
              )}
            />
          </View>

          <View className="gap-1.5">
            <Text className="font-sans-semibold text-[12px] text-brand-mute">
              About you
            </Text>
            <Controller
              control={control}
              name="bio"
              render={({ field }) => (
                <Field
                  placeholder="A short bio (optional)"
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  multiline
                />
              )}
            />
          </View>

          {update.isError ? (
            <Text className="font-sans text-[13px] text-status-cancelled">
              Couldn&apos;t save. Please try again.
            </Text>
          ) : null}
          {saved ? (
            <Text className="font-sans text-[13px] text-brand-primary">
              Saved — synced to your account.
            </Text>
          ) : null}

          <Button
            label="Save changes"
            onPress={handleSubmit(onSubmit)}
            loading={update.isPending}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
