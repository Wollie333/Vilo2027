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
  isIsoDate,
  useCreateSeason,
  useDeleteSeason,
  useEditableSeason,
  useUpdateSeason,
  type AdjustmentType,
  type HostSeason,
  type SeasonInput,
} from "@/lib/queries/host-seasons";
import { t } from "@/i18n";

export default function SeasonEdit() {
  const router = useRouter();
  const { id, propertyId } = useLocalSearchParams<{
    id: string;
    propertyId: string;
  }>();
  const { host } = useAuth();
  const isNew = id === "new";
  const { data, isLoading, isError } = useEditableSeason(host?.id, id);
  const ready = isNew || (!isLoading && !isError && !!data);
  const effectivePropertyId = isNew
    ? propertyId
    : ((data as HostSeason | undefined)?.property_id ?? "");

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={
          isNew ? t("host.seasonEdit.newTitle") : t("host.seasonEdit.title")
        }
        subtitle={isNew ? undefined : data?.label}
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
        <SeasonForm
          key={isNew ? "new" : (data as HostSeason).id}
          seasonId={isNew ? null : (data as HostSeason).id}
          propertyId={effectivePropertyId}
          season={isNew ? null : (data as HostSeason)}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}

type Form = {
  label: string;
  start_date: string;
  end_date: string;
  adjustment_type: AdjustmentType;
  adjustment_value: string;
  is_active: "active" | "hidden";
};

function seed(s: HostSeason | null): Form {
  return {
    label: s?.label ?? "",
    start_date: s?.start_date ?? "",
    end_date: s?.end_date ?? "",
    adjustment_type: (s?.adjustment_type as AdjustmentType) ?? "absolute",
    adjustment_value:
      s?.adjustment_value != null ? String(s.adjustment_value) : "",
    is_active: s ? (s.is_active ? "active" : "hidden") : "active",
  };
}

function SeasonForm({
  seasonId,
  propertyId,
  season,
  onDone,
}: {
  seasonId: string | null;
  propertyId: string;
  season: HostSeason | null;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isNew = season === null;
  const create = useCreateSeason(propertyId);
  const update = useUpdateSeason(propertyId, seasonId ?? "");
  const del = useDeleteSeason(propertyId);
  const [form, setForm] = useState<Form>(() => seed(season));

  const busy = create.isPending || update.isPending || del.isPending;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSave() {
    if (!form.label.trim()) {
      Alert.alert(t("host.seasonEdit.labelRequired"));
      return;
    }
    if (!isIsoDate(form.start_date) || !isIsoDate(form.end_date)) {
      Alert.alert(t("host.seasonEdit.dateInvalid"));
      return;
    }
    if (form.end_date < form.start_date) {
      Alert.alert(t("host.seasonEdit.dateOrder"));
      return;
    }
    const value = Number(form.adjustment_value.trim());
    if (!Number.isFinite(value)) {
      Alert.alert(t("host.seasonEdit.valueInvalid"));
      return;
    }
    const input: SeasonInput = {
      label: form.label.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      adjustment_type: form.adjustment_type,
      adjustment_value: value,
      is_active: form.is_active === "active",
    };
    const onError = () =>
      Alert.alert(t("common.errorTitle"), t("common.errorMessage"));
    if (isNew) create.mutate(input, { onSuccess: onDone, onError });
    else update.mutate(input, { onSuccess: onDone, onError });
  }

  function onDelete() {
    if (!seasonId) return;
    Alert.alert(
      t("host.seasonEdit.deleteTitle"),
      t("host.seasonEdit.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("host.seasonEdit.delete"),
          style: "destructive",
          onPress: () =>
            del.mutate(seasonId, {
              onSuccess: onDone,
              onError: () =>
                Alert.alert(t("common.errorTitle"), t("common.errorMessage")),
            }),
        },
      ],
    );
  }

  const valueLabel =
    form.adjustment_type === "percent"
      ? t("host.seasonEdit.valuePercent")
      : t("host.seasonEdit.valueAbsolute");

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
      <LabeledField label={t("host.seasonEdit.label")}>
        <Input
          value={form.label}
          onChangeText={(v) => set("label", v)}
          placeholder={t("host.seasonEdit.labelPlaceholder")}
        />
      </LabeledField>

      <View className="flex-row gap-3">
        <LabeledField label={t("host.seasonEdit.startDate")} className="flex-1">
          <Input
            value={form.start_date}
            onChangeText={(v) => set("start_date", v)}
            placeholder="2026-12-01"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </LabeledField>
        <LabeledField label={t("host.seasonEdit.endDate")} className="flex-1">
          <Input
            value={form.end_date}
            onChangeText={(v) => set("end_date", v)}
            placeholder="2026-12-31"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </LabeledField>
      </View>

      <LabeledField label={t("host.seasonEdit.adjustmentType")}>
        <SegmentedControl
          value={form.adjustment_type}
          onChange={(v) => set("adjustment_type", v)}
          segments={[
            { value: "absolute", label: t("host.seasonEdit.absolute") },
            { value: "percent", label: t("host.seasonEdit.percent") },
          ]}
        />
      </LabeledField>

      <LabeledField label={valueLabel}>
        <Input
          value={form.adjustment_value}
          onChangeText={(v) => set("adjustment_value", v)}
          keyboardType="numbers-and-punctuation"
        />
      </LabeledField>

      <LabeledField label={t("host.seasonEdit.visibility")}>
        <SegmentedControl
          value={form.is_active}
          onChange={(v) => set("is_active", v)}
          segments={[
            { value: "active", label: t("host.seasons.active") },
            { value: "hidden", label: t("host.seasons.hidden") },
          ]}
        />
      </LabeledField>

      <View className="mt-2">
        <Button label={t("common.save")} onPress={onSave} loading={busy} />
      </View>

      {!isNew ? (
        <View className="mt-1">
          <Button
            label={t("host.seasonEdit.delete")}
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
  const { style, ...rest } = props;
  return (
    <TextInput
      {...rest}
      placeholderTextColor="#A6BFB1"
      className="w-full rounded-[12px] border-[1.5px] border-brand-line bg-white px-[14px] py-[13px] font-sans text-[15px] text-brand-ink"
      style={style}
    />
  );
}
