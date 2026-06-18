import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ShieldCheck } from "lucide-react-native";

import { EmptyState, Icon, ScreenHeader, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  POLICY_TYPES,
  useAssignPolicy,
  useHostPolicies,
  usePropertyPolicies,
  type PolicyOption,
  type PolicyType,
} from "@/lib/queries/host-policies";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

export default function PropertyPolicies() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { host } = useAuth();

  const policies = useHostPolicies(host?.id);
  const assignments = usePropertyPolicies(propertyId);
  const assign = useAssignPolicy(propertyId ?? "");

  const loading = policies.isLoading || assignments.isLoading;
  const error = policies.isError || assignments.isError;

  function choose(policyType: PolicyType, policyId: string | null) {
    assign.mutate(
      { policyType, policyId },
      {
        onError: () =>
          Alert.alert(t("common.errorTitle"), t("common.errorMessage")),
      },
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.policies.title")}
        subtitle={t("host.policies.subtitle")}
        onBack={() => router.back()}
        bordered
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 20,
          gap: 20,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={120} rounded={16} />)
        ) : error ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("common.errorTitle")}
            message={t("common.errorMessage")}
          />
        ) : !policies.data || policies.data.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("host.policies.emptyTitle")}
            message={t("host.policies.emptyMessage")}
          />
        ) : (
          POLICY_TYPES.map((type) => (
            <PolicySection
              key={type}
              type={type}
              options={(policies.data ?? []).filter((p) => p.type === type)}
              assignedId={assignments.data?.[type] ?? null}
              busy={assign.isPending}
              onChoose={(policyId) => choose(type, policyId)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function PolicySection({
  type,
  options,
  assignedId,
  busy,
  onChoose,
}: {
  type: PolicyType;
  options: PolicyOption[];
  assignedId: string | null;
  busy: boolean;
  onChoose: (policyId: string | null) => void;
}) {
  return (
    <View>
      <Text className="mb-2 font-display text-[15px] text-brand-ink">
        {t(`host.policies.type_${type}`)}
      </Text>
      <View className="gap-2">
        {/* Host default (clears the property-wide assignment) */}
        <OptionRow
          label={t("host.policies.useDefault")}
          hint={t("host.policies.useDefaultHint")}
          selected={assignedId === null}
          disabled={busy}
          onPress={() => onChoose(null)}
        />
        {options.map((p) => (
          <OptionRow
            key={p.id}
            label={p.name}
            hint={p.summary ?? undefined}
            selected={assignedId === p.id}
            disabled={busy}
            onPress={() => onChoose(p.id)}
          />
        ))}
        {options.length === 0 ? (
          <Text className="px-1 font-sans text-[12.5px] text-brand-mute">
            {t("host.policies.noneOfType")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function OptionRow({
  label,
  hint,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-3 rounded-card border p-3.5 ${
        selected
          ? "border-brand-primary bg-brand-light/50"
          : "border-brand-line bg-white"
      } ${disabled ? "opacity-60" : "active:bg-brand-light"}`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected
            ? "border-brand-primary bg-brand-primary"
            : "border-brand-line"
        }`}
      >
        {selected ? <Icon icon={Check} size={12} color={brand.white} /> : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans-semibold text-[14px] text-brand-ink">
          {label}
        </Text>
        {hint ? (
          <Text
            numberOfLines={2}
            className="mt-0.5 font-sans text-[12.5px] text-brand-mute"
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
