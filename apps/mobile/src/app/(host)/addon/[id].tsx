import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";

import {
  Button,
  Chip,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  PRICING_MODELS,
  useCreateAddon,
  useDeleteAddon,
  useEditableAddon,
  useUpdateAddon,
  type AddonInput,
  type HostAddon,
  type PricingModel,
} from "@/lib/queries/host-addons";
import { t } from "@/i18n";

export default function AddonEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { host } = useAuth();
  const isNew = id === "new";
  const { data, isLoading, isError } = useEditableAddon(host?.id, id);

  const ready = isNew || (!isLoading && !isError && !!data);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={isNew ? t("host.addonEdit.newTitle") : t("host.addonEdit.title")}
        subtitle={isNew ? undefined : data?.name}
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
        <AddonForm
          key={isNew ? "new" : (data as HostAddon).id}
          hostId={host?.id}
          addon={isNew ? null : (data as HostAddon)}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}

type Form = {
  name: string;
  description: string;
  unit_price: string;
  pricing_model: PricingModel;
  category: string;
  is_active: "active" | "hidden";
};

function seed(a: HostAddon | null): Form {
  return {
    name: a?.name ?? "",
    description: a?.description ?? "",
    unit_price: a?.unit_price != null ? String(a.unit_price) : "",
    pricing_model: (a?.pricing_model as PricingModel) ?? "per_stay",
    category: a?.category ?? "",
    is_active: a ? (a.is_active ? "active" : "hidden") : "active",
  };
}

function priceOrZero(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function AddonForm({
  hostId,
  addon,
  onDone,
}: {
  hostId: string | undefined;
  addon: HostAddon | null;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isNew = addon === null;
  const create = useCreateAddon(hostId);
  const update = useUpdateAddon(hostId, addon?.id ?? "");
  const del = useDeleteAddon(hostId);
  const [form, setForm] = useState<Form>(() => seed(addon));

  const busy = create.isPending || update.isPending || del.isPending;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSave() {
    if (!form.name.trim()) {
      Alert.alert(t("host.addonEdit.nameRequired"));
      return;
    }
    const input: AddonInput = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      unit_price: priceOrZero(form.unit_price),
      pricing_model: form.pricing_model,
      category: form.category.trim() || null,
      is_active: form.is_active === "active",
    };
    const onError = () =>
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    if (isNew) {
      create.mutate(input, { onSuccess: onDone, onError });
    } else {
      update.mutate(input, { onSuccess: onDone, onError });
    }
  }

  function onDelete() {
    if (!addon) return;
    Alert.alert(
      t("host.addonEdit.deleteTitle"),
      t("host.addonEdit.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("host.addonEdit.delete"),
          style: "destructive",
          onPress: () =>
            del.mutate(addon.id, {
              onSuccess: onDone,
              onError: () =>
                Alert.alert(
                  t("common.errorTitle"),
                  t("host.addonEdit.deleteError"),
                ),
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
      <LabeledField label={t("host.addonEdit.name")}>
        <Input value={form.name} onChangeText={(v) => set("name", v)} />
      </LabeledField>

      <LabeledField label={t("host.addonEdit.description")}>
        <Input
          value={form.description}
          onChangeText={(v) => set("description", v)}
          multiline
          numberOfLines={3}
        />
      </LabeledField>

      <View className="flex-row gap-3">
        <LabeledField label={t("host.addonEdit.price")} className="flex-1">
          <Input
            value={form.unit_price}
            onChangeText={(v) => set("unit_price", v)}
            keyboardType="numeric"
          />
        </LabeledField>
        <LabeledField label={t("host.addonEdit.category")} className="flex-1">
          <Input
            value={form.category}
            onChangeText={(v) => set("category", v)}
          />
        </LabeledField>
      </View>

      <LabeledField label={t("host.addonEdit.pricingModel")}>
        <View className="flex-row flex-wrap gap-2">
          {PRICING_MODELS.map((m) => (
            <Chip
              key={m}
              label={t(`host.addons.pm_${m}`)}
              active={form.pricing_model === m}
              onPress={() => set("pricing_model", m)}
            />
          ))}
        </View>
      </LabeledField>

      <LabeledField label={t("host.addonEdit.visibility")}>
        <SegmentedControl
          value={form.is_active}
          onChange={(v) => set("is_active", v)}
          segments={[
            { value: "active", label: t("host.addons.active") },
            { value: "hidden", label: t("host.addons.hidden") },
          ]}
        />
      </LabeledField>

      <View className="mt-2">
        <Button label={t("common.save")} onPress={onSave} loading={busy} />
      </View>

      {!isNew ? (
        <View className="mt-1">
          <Button
            label={t("host.addonEdit.delete")}
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
      style={[multiline ? { minHeight: 72 } : null, style]}
    />
  );
}
