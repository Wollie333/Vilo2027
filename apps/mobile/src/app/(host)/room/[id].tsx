import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  useEditableRoom,
  useUpdateRoom,
  type HostRoom,
  type RoomPatch,
} from "@/lib/queries/host-catalogue";
import { t } from "@/i18n";

export default function RoomEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { host } = useAuth();
  const { data, isLoading, isError } = useEditableRoom(host?.id, id);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.roomEdit.title")}
        subtitle={data?.name}
        onBack={() => router.back()}
        bordered
      />

      {isLoading ? (
        <View className="gap-4 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={56} rounded={12} />
          ))}
        </View>
      ) : isError || !data ? (
        <View className="p-8">
          <Text className="text-center font-sans text-[14px] text-brand-mute">
            {t("common.errorMessage")}
          </Text>
        </View>
      ) : (
        <RoomForm
          key={data.id}
          room={data}
          hostId={host?.id}
          onSaved={() => router.back()}
        />
      )}
    </View>
  );
}

type Form = {
  name: string;
  description: string;
  base_price: string;
  max_guests: string;
  bed_type: string;
  inventory_count: string;
  is_active: "active" | "hidden";
};

function seed(r: HostRoom): Form {
  return {
    name: r.name ?? "",
    description: r.description ?? "",
    base_price: r.base_price != null ? String(r.base_price) : "",
    max_guests: r.max_guests != null ? String(r.max_guests) : "",
    bed_type: r.bed_type ?? "",
    inventory_count: r.inventory_count != null ? String(r.inventory_count) : "",
    is_active: r.is_active ? "active" : "hidden",
  };
}

function intOrZero(v: string): number {
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function strOrNull(v: string): string | null {
  const s = v.trim();
  return s ? s : null;
}

function RoomForm({
  room,
  hostId,
  onSaved,
}: {
  room: HostRoom;
  hostId: string | undefined;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const update = useUpdateRoom(hostId, room.property_id, room.id);
  const [form, setForm] = useState<Form>(() => seed(room));

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSave() {
    if (!form.name.trim()) {
      Alert.alert(t("host.roomEdit.nameRequired"));
      return;
    }
    const patch: RoomPatch = {
      name: form.name.trim(),
      description: strOrNull(form.description),
      base_price: intOrZero(form.base_price),
      max_guests: Math.max(1, intOrZero(form.max_guests)),
      bed_type: strOrNull(form.bed_type),
      inventory_count: Math.max(0, intOrZero(form.inventory_count)),
      is_active: form.is_active === "active",
    };
    update.mutate(patch, {
      onSuccess: onSaved,
      onError: () =>
        Alert.alert(t("common.errorTitle"), t("common.errorMessage")),
    });
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
      <LabeledField label={t("host.roomEdit.name")}>
        <Input value={form.name} onChangeText={(v) => set("name", v)} />
      </LabeledField>

      <LabeledField label={t("host.roomEdit.description")}>
        <Input
          value={form.description}
          onChangeText={(v) => set("description", v)}
          multiline
          numberOfLines={4}
        />
      </LabeledField>

      <View className="flex-row gap-3">
        <LabeledField label={t("host.roomEdit.basePrice")} className="flex-1">
          <Input
            value={form.base_price}
            onChangeText={(v) => set("base_price", v)}
            keyboardType="numeric"
          />
        </LabeledField>
        <LabeledField label={t("host.roomEdit.maxGuests")} className="flex-1">
          <Input
            value={form.max_guests}
            onChangeText={(v) => set("max_guests", v)}
            keyboardType="number-pad"
          />
        </LabeledField>
      </View>

      <View className="flex-row gap-3">
        <LabeledField label={t("host.roomEdit.bedType")} className="flex-1">
          <Input
            value={form.bed_type}
            onChangeText={(v) => set("bed_type", v)}
            placeholder="Queen"
          />
        </LabeledField>
        <LabeledField label={t("host.roomEdit.inventory")} className="flex-1">
          <Input
            value={form.inventory_count}
            onChangeText={(v) => set("inventory_count", v)}
            keyboardType="number-pad"
          />
        </LabeledField>
      </View>

      <LabeledField label={t("host.roomEdit.visibility")}>
        <SegmentedControl
          value={form.is_active}
          onChange={(v) => set("is_active", v)}
          segments={[
            { value: "active", label: t("host.rooms.active") },
            { value: "hidden", label: t("host.rooms.hidden") },
          ]}
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
      style={[multiline ? { minHeight: 80 } : null, style]}
    />
  );
}
