import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";

import {
  Button,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  useCreateCoupon,
  useDeleteCoupon,
  useEditableCoupon,
  useUpdateCoupon,
  type CouponInput,
  type DiscountType,
  type HostCoupon,
} from "@/lib/queries/host-coupons";
import { t } from "@/i18n";

export default function CouponEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { host } = useAuth();
  const isNew = id === "new";
  const { data, isLoading, isError } = useEditableCoupon(host?.id, id);
  const ready = isNew || (!isLoading && !isError && !!data);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={
          isNew ? t("host.couponEdit.newTitle") : t("host.couponEdit.title")
        }
        subtitle={isNew ? undefined : data?.code}
        onBack={() => router.back()}
        bordered
      />
      {!ready ? (
        isError ? (
          <View className="p-8">
            <Text className="text-center font-sans text-[14px] text-brand-mute">
              {t("common.errorMessage")}
            </Text>
          </View>
        ) : (
          <View className="gap-4 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={56} rounded={12} />
            ))}
          </View>
        )
      ) : (
        <CouponForm
          key={isNew ? "new" : (data as HostCoupon).id}
          hostId={host?.id}
          coupon={isNew ? null : (data as HostCoupon)}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}

type Form = {
  code: string;
  discount_type: DiscountType;
  discount_value: string;
  min_spend: string;
  max_redemptions: string;
  description: string;
  is_active: "active" | "hidden";
};

function seed(c: HostCoupon | null): Form {
  return {
    code: c?.code ?? "",
    discount_type: (c?.discount_type as DiscountType) ?? "percent",
    discount_value: c?.discount_value != null ? String(c.discount_value) : "",
    min_spend: c?.min_spend != null ? String(c.min_spend) : "",
    max_redemptions:
      c?.max_redemptions != null ? String(c.max_redemptions) : "",
    description: c?.description ?? "",
    is_active: c ? (c.is_active ? "active" : "hidden") : "active",
  };
}

function numOrZero(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function numOrNull(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function CouponForm({
  hostId,
  coupon,
  onDone,
}: {
  hostId: string | undefined;
  coupon: HostCoupon | null;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isNew = coupon === null;
  const create = useCreateCoupon(hostId);
  const update = useUpdateCoupon(hostId, coupon?.id ?? "");
  const del = useDeleteCoupon(hostId);
  const [form, setForm] = useState<Form>(() => seed(coupon));

  const busy = create.isPending || update.isPending || del.isPending;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSave() {
    const code = form.code.trim().toUpperCase();
    if (!code) {
      Alert.alert(t("host.couponEdit.codeRequired"));
      return;
    }
    const input: CouponInput = {
      code,
      discount_type: form.discount_type,
      discount_value: numOrZero(form.discount_value),
      min_spend: numOrNull(form.min_spend),
      max_redemptions: numOrNull(form.max_redemptions),
      description: form.description.trim() || null,
      is_active: form.is_active === "active",
    };
    const onError = () =>
      Alert.alert(t("common.errorTitle"), t("host.couponEdit.saveError"));
    if (isNew) create.mutate(input, { onSuccess: onDone, onError });
    else update.mutate(input, { onSuccess: onDone, onError });
  }

  function onDelete() {
    if (!coupon) return;
    Alert.alert(
      t("host.couponEdit.deleteTitle"),
      t("host.couponEdit.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("host.couponEdit.delete"),
          style: "destructive",
          onPress: () =>
            del.mutate(coupon.id, {
              onSuccess: onDone,
              onError: () =>
                Alert.alert(t("common.errorTitle"), t("common.errorMessage")),
            }),
        },
      ],
    );
  }

  return (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 20,
        gap: 16,
        paddingBottom: insets.bottom + 96,
      }}
    >
      <LabeledField label={t("host.couponEdit.code")}>
        <Input
          value={form.code}
          onChangeText={(v) => set("code", v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="SUMMER10"
        />
      </LabeledField>

      <LabeledField label={t("host.couponEdit.type")}>
        <SegmentedControl
          value={form.discount_type}
          onChange={(v) => set("discount_type", v)}
          segments={[
            { value: "percent", label: t("host.couponEdit.percent") },
            { value: "fixed", label: t("host.couponEdit.fixed") },
          ]}
        />
      </LabeledField>

      <View className="flex-row gap-3">
        <LabeledField label={t("host.couponEdit.value")} className="flex-1">
          <Input
            value={form.discount_value}
            onChangeText={(v) => set("discount_value", v)}
            keyboardType="numeric"
          />
        </LabeledField>
        <LabeledField label={t("host.couponEdit.minSpend")} className="flex-1">
          <Input
            value={form.min_spend}
            onChangeText={(v) => set("min_spend", v)}
            keyboardType="numeric"
          />
        </LabeledField>
      </View>

      <LabeledField label={t("host.couponEdit.maxRedemptions")}>
        <Input
          value={form.max_redemptions}
          onChangeText={(v) => set("max_redemptions", v)}
          keyboardType="number-pad"
          placeholder={t("host.couponEdit.unlimited")}
        />
      </LabeledField>

      <LabeledField label={t("host.couponEdit.description")}>
        <Input
          value={form.description}
          onChangeText={(v) => set("description", v)}
          multiline
          numberOfLines={2}
        />
      </LabeledField>

      <LabeledField label={t("host.couponEdit.visibility")}>
        <SegmentedControl
          value={form.is_active}
          onChange={(v) => set("is_active", v)}
          segments={[
            { value: "active", label: t("host.coupons.active") },
            { value: "hidden", label: t("host.coupons.hidden") },
          ]}
        />
      </LabeledField>

      <View className="mt-2">
        <Button label={t("common.save")} onPress={onSave} loading={busy} />
      </View>

      {!isNew ? (
        <View className="mt-1">
          <Button
            label={t("host.couponEdit.delete")}
            variant="secondary"
            icon={Trash2}
            onPress={onDelete}
            disabled={busy}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function LabeledField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View className={className}>
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
      style={[multiline ? { minHeight: 60 } : null, style]}
    />
  );
}
