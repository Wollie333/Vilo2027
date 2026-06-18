import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, House, Lock, Luggage, Mail } from "lucide-react-native";

import { Button, Field, SegmentedControl, type Segment } from "@/components/ui";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAppStore, type AppRole } from "@/stores/app-store";
import { t } from "@/i18n";

const roleSegments: Segment<AppRole>[] = [
  { value: "guest", label: t("common.guest"), icon: Luggage },
  { value: "host", label: t("common.host"), icon: House },
];

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithEmail } = useAuth();
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  const [role, setRole] = useState<AppRole>("guest");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSignIn() {
    setError(null);
    setSubmitting(true);
    setActiveRole(role);
    const { error: err } = await signInWithEmail(email.trim(), password);
    setSubmitting(false);
    if (err) setError(err);
    // On success the root navigator redirects automatically.
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1 bg-white"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Dark emerald hero band */}
        <View
          className="overflow-hidden px-6 pb-9"
          style={{ paddingTop: insets.top + 24, backgroundColor: "#0A1510" }}
        >
          <Logo />
          <Text className="mt-4 font-display-extrabold text-[28px] leading-tight text-white">
            {t("auth.welcomeBack")}
          </Text>
          <Text className="mt-[6px] font-sans text-[14px] leading-relaxed text-emerald-100/75">
            {t("auth.signInSubtitle")}
          </Text>
        </View>

        <View className="px-6 pb-10 pt-6">
          <SegmentedControl
            segments={roleSegments}
            value={role}
            onChange={setRole}
          />

          <View className="mt-5 gap-[10px]">
            <Button variant="social" label={t("auth.continueWithGoogle")} />
            {Platform.OS === "ios" ? (
              <Button variant="social" label={t("auth.continueWithApple")} />
            ) : null}
          </View>

          <View className="my-5 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-brand-line" />
            <Text className="font-sans-semibold text-[10.5px] uppercase tracking-wider text-brand-mute">
              {t("auth.orWithEmail")}
            </Text>
            <View className="h-px flex-1 bg-brand-line" />
          </View>

          <View className="gap-[14px]">
            <Field
              icon={Mail}
              placeholder={t("auth.email")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              icon={Lock}
              password
              placeholder={t("auth.password")}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable className="self-end">
              <Text className="font-sans-semibold text-[12.5px] text-brand-primary">
                {t("auth.forgot")}
              </Text>
            </Pressable>
          </View>

          {error ? (
            <Text className="mt-3 font-sans text-[13px] text-status-cancelled">
              {error}
            </Text>
          ) : null}

          <View className="mt-5">
            <Button
              label={t("auth.signIn")}
              iconRight={ArrowRight}
              onPress={onSignIn}
              loading={submitting}
            />
          </View>

          <View className="mt-5 flex-row items-center justify-center">
            <Text className="font-sans text-[13.5px] text-brand-mute">
              {t("auth.newToVilo")}{" "}
            </Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text className="font-sans-bold text-[13.5px] text-brand-ink">
                {t("auth.createAnAccount")}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
