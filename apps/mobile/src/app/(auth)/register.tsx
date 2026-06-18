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
import {
  ArrowLeft,
  ArrowRight,
  Check,
  House,
  Lock,
  Luggage,
  Mail,
  User,
} from "lucide-react-native";

import {
  Button,
  Field,
  Icon,
  SegmentedControl,
  type Segment,
} from "@/components/ui";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAppStore, type AppRole } from "@/stores/app-store";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

const roleSegments: Segment<AppRole>[] = [
  { value: "guest", label: t("common.guest"), icon: Luggage },
  { value: "host", label: t("common.host"), icon: House },
];

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUpWithEmail } = useAuth();
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  const [role, setRole] = useState<AppRole>("guest");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onCreate() {
    setError(null);
    if (!agreed) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setSubmitting(true);
    setActiveRole(role);
    const { error: err } = await signUpWithEmail(
      email.trim(),
      password,
      fullName.trim(),
    );
    setSubmitting(false);
    if (err) setError(err);
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
        <View className="px-6 pb-10" style={{ paddingTop: insets.top + 16 }}>
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            accessibilityLabel={t("common.back")}
            className="-ml-1.5 h-10 w-10 items-center justify-center rounded-full active:bg-brand-light"
          >
            <Icon icon={ArrowLeft} size={20} color={brand.ink} />
          </Pressable>

          <View className="mt-3">
            <Logo />
            <Text className="mt-4 font-display-extrabold text-[28px] leading-tight text-brand-ink">
              {t("auth.createAccount")}
            </Text>
            <Text className="mt-[6px] font-sans text-[14px] leading-relaxed text-brand-mute">
              {t("auth.registerSubtitle")}
            </Text>
          </View>

          <View className="mt-6">
            <Text className="mb-2 font-sans-bold text-[11px] uppercase tracking-wider text-brand-mute">
              {t("auth.joiningAs")}
            </Text>
            <SegmentedControl
              segments={roleSegments}
              value={role}
              onChange={setRole}
            />
            <Text className="mt-2 font-sans text-[12px] text-brand-mute">
              {role === "guest"
                ? t("auth.guestRoleNote")
                : t("auth.hostRoleNote")}
            </Text>
          </View>

          <View className="mt-5 gap-[10px]">
            <Button variant="social" label={t("auth.continueWithGoogle")} />
            {Platform.OS === "ios" ? (
              <Button variant="social" label={t("auth.continueWithApple")} />
            ) : null}
          </View>

          <View className="my-5 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-brand-line" />
            <Text className="font-sans-semibold text-[10.5px] uppercase tracking-wider text-brand-mute">
              {t("auth.orSignUpWithEmail")}
            </Text>
            <View className="h-px flex-1 bg-brand-line" />
          </View>

          <View className="gap-[14px]">
            <Field
              icon={User}
              placeholder={t("auth.fullName")}
              value={fullName}
              onChangeText={setFullName}
            />
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
              placeholder={t("auth.createPassword")}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Pressable
            onPress={() => setAgreed((a) => !a)}
            className="mt-4 flex-row items-start gap-[10px]"
          >
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded-[6px] border-[1.5px] ${
                agreed
                  ? "border-brand-primary bg-brand-primary"
                  : "border-[#CFE3D7] bg-white"
              }`}
            >
              {agreed ? (
                <Icon icon={Check} size={13} color={brand.white} />
              ) : null}
            </View>
            <Text className="flex-1 font-sans text-[12.5px] leading-relaxed text-brand-mute">
              {t("auth.agreeTerms")}
            </Text>
          </Pressable>

          {error ? (
            <Text className="mt-3 font-sans text-[13px] text-status-cancelled">
              {error}
            </Text>
          ) : null}

          <View className="mt-5">
            <Button
              label={t("auth.createAccount")}
              iconRight={ArrowRight}
              onPress={onCreate}
              loading={submitting}
            />
          </View>

          <View className="mt-5 flex-row items-center justify-center">
            <Text className="font-sans text-[13.5px] text-brand-mute">
              {t("auth.alreadyHaveAccount")}{" "}
            </Text>
            <Pressable onPress={() => router.push("/(auth)/login")}>
              <Text className="font-sans-bold text-[13.5px] text-brand-ink">
                {t("auth.signInLink")}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
