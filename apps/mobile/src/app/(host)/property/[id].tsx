import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BedDouble,
  CalendarRange,
  ChevronRight,
  ShieldCheck,
} from "lucide-react-native";

import { Button, Icon, ScreenHeader, Skeleton } from "@/components/ui";
import { brand } from "@/theme/tokens";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  useEditableProperty,
  useUpdateProperty,
  type EditableProperty,
  type PropertyPatch,
} from "@/lib/queries/host-catalogue";
import { t } from "@/i18n";

export default function PropertyEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { host } = useAuth();
  const { data, isLoading, isError } = useEditableProperty(host?.id, id);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("host.propertyEdit.title")}
        subtitle={data?.name}
        onBack={() => router.back()}
        bordered
      />

      {isLoading ? (
        <View className="gap-4 p-5">
          {[0, 1, 2, 3].map((i) => (
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
        // Keyed by id so the form (seeded from props) remounts per property —
        // avoids seeding state in an effect.
        <PropertyForm
          key={data.id}
          property={data}
          hostId={host?.id}
          onSaved={() => router.back()}
        />
      )}
    </View>
  );
}

// Local form shape: every field is a string for the inputs; parsed on save.
type Form = {
  name: string;
  description: string;
  base_price: string;
  bedrooms: string;
  bathrooms: string;
  max_guests: string;
  city: string;
  province: string;
  check_in_time: string;
  check_out_time: string;
  house_rules: string;
};

function seed(p: EditableProperty): Form {
  const num = (n: number | null) => (n != null ? String(n) : "");
  return {
    name: p.name ?? "",
    description: p.description ?? "",
    base_price: num(p.base_price),
    bedrooms: num(p.bedrooms),
    bathrooms: num(p.bathrooms),
    max_guests: num(p.max_guests),
    city: p.city ?? "",
    province: p.province ?? "",
    check_in_time: p.check_in_time ?? "",
    check_out_time: p.check_out_time ?? "",
    house_rules: p.house_rules ?? "",
  };
}

// "" → null; otherwise the parsed number (or null if not a finite number).
function numOrNull(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: string): string | null {
  const s = v.trim();
  return s ? s : null;
}

function PropertyForm({
  property,
  hostId,
  onSaved,
}: {
  property: EditableProperty;
  hostId: string | undefined;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const update = useUpdateProperty(hostId, property.id);
  const [form, setForm] = useState<Form>(() => seed(property));

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSave() {
    if (!form.name.trim()) {
      Alert.alert(t("host.propertyEdit.nameRequired"));
      return;
    }
    const patch: PropertyPatch = {
      name: form.name.trim(),
      description: strOrNull(form.description),
      base_price: numOrNull(form.base_price),
      bedrooms: numOrNull(form.bedrooms),
      bathrooms: numOrNull(form.bathrooms),
      max_guests: numOrNull(form.max_guests),
      city: strOrNull(form.city),
      province: strOrNull(form.province),
      check_in_time: strOrNull(form.check_in_time),
      check_out_time: strOrNull(form.check_out_time),
      house_rules: strOrNull(form.house_rules),
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
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(host)/rooms/[propertyId]",
            params: { propertyId: property.id },
          })
        }
        className="flex-row items-center gap-3 rounded-card border border-brand-line p-3.5 active:bg-brand-light"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-light">
          <Icon icon={BedDouble} size={20} color={brand.primary} />
        </View>
        <Text className="flex-1 font-display text-[15px] text-brand-ink">
          {t("host.rooms.manage")}
        </Text>
        <Icon icon={ChevronRight} size={20} color={brand.mute} />
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(host)/seasonal/[propertyId]",
            params: { propertyId: property.id },
          })
        }
        className="flex-row items-center gap-3 rounded-card border border-brand-line p-3.5 active:bg-brand-light"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-light">
          <Icon icon={CalendarRange} size={20} color={brand.primary} />
        </View>
        <Text className="flex-1 font-display text-[15px] text-brand-ink">
          {t("host.seasons.manage")}
        </Text>
        <Icon icon={ChevronRight} size={20} color={brand.mute} />
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(host)/policies/[propertyId]",
            params: { propertyId: property.id },
          })
        }
        className="flex-row items-center gap-3 rounded-card border border-brand-line p-3.5 active:bg-brand-light"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-light">
          <Icon icon={ShieldCheck} size={20} color={brand.primary} />
        </View>
        <Text className="flex-1 font-display text-[15px] text-brand-ink">
          {t("host.policies.manage")}
        </Text>
        <Icon icon={ChevronRight} size={20} color={brand.mute} />
      </Pressable>

      <LabeledField label={t("host.propertyEdit.name")}>
        <Input value={form.name} onChangeText={(v) => set("name", v)} />
      </LabeledField>

      <LabeledField label={t("host.propertyEdit.description")}>
        <Input
          value={form.description}
          onChangeText={(v) => set("description", v)}
          multiline
          numberOfLines={5}
        />
      </LabeledField>

      <View className="flex-row gap-3">
        <LabeledField
          label={t("host.propertyEdit.basePrice")}
          className="flex-1"
        >
          <Input
            value={form.base_price}
            onChangeText={(v) => set("base_price", v)}
            keyboardType="numeric"
          />
        </LabeledField>
        <LabeledField
          label={t("host.propertyEdit.maxGuests")}
          className="flex-1"
        >
          <Input
            value={form.max_guests}
            onChangeText={(v) => set("max_guests", v)}
            keyboardType="number-pad"
          />
        </LabeledField>
      </View>

      <View className="flex-row gap-3">
        <LabeledField
          label={t("host.propertyEdit.bedrooms")}
          className="flex-1"
        >
          <Input
            value={form.bedrooms}
            onChangeText={(v) => set("bedrooms", v)}
            keyboardType="number-pad"
          />
        </LabeledField>
        <LabeledField
          label={t("host.propertyEdit.bathrooms")}
          className="flex-1"
        >
          <Input
            value={form.bathrooms}
            onChangeText={(v) => set("bathrooms", v)}
            keyboardType="number-pad"
          />
        </LabeledField>
      </View>

      <View className="flex-row gap-3">
        <LabeledField label={t("host.propertyEdit.city")} className="flex-1">
          <Input value={form.city} onChangeText={(v) => set("city", v)} />
        </LabeledField>
        <LabeledField
          label={t("host.propertyEdit.province")}
          className="flex-1"
        >
          <Input
            value={form.province}
            onChangeText={(v) => set("province", v)}
          />
        </LabeledField>
      </View>

      <View className="flex-row gap-3">
        <LabeledField label={t("host.propertyEdit.checkIn")} className="flex-1">
          <Input
            value={form.check_in_time}
            onChangeText={(v) => set("check_in_time", v)}
            placeholder="14:00"
          />
        </LabeledField>
        <LabeledField
          label={t("host.propertyEdit.checkOut")}
          className="flex-1"
        >
          <Input
            value={form.check_out_time}
            onChangeText={(v) => set("check_out_time", v)}
            placeholder="10:00"
          />
        </LabeledField>
      </View>

      <LabeledField label={t("host.propertyEdit.houseRules")}>
        <Input
          value={form.house_rules}
          onChangeText={(v) => set("house_rules", v)}
          multiline
          numberOfLines={4}
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

// A plain bordered input (the shared Field adds icon/password chrome we don't
// need here; this matches the same visual token set).
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
