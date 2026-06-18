import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, Home } from "lucide-react-native";

import {
  Chip,
  EmptyState,
  Icon,
  ScreenHeader,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  useCalendar,
  useHostProperties,
  useToggleBlock,
  type DayStatus,
} from "@/lib/queries/calendar";
import { brand } from "@/theme/tokens";
import { t } from "@/i18n";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Build the 6-row month matrix (leading/trailing days from neighbouring months are null).
function monthMatrix(year: number, month: number): (Date | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(new Date(Date.UTC(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const cellBg: Record<DayStatus, string> = {
  open: "bg-white",
  booked: "bg-brand-primary",
  blocked: "bg-[#EFF3F1]",
};
const cellText: Record<DayStatus, string> = {
  open: "text-brand-ink",
  booked: "text-white",
  blocked: "text-[#7C9388]",
};

export default function HostCalendar() {
  const { host, session } = useAuth();
  const { data: properties, isLoading: loadingProps } = useHostProperties(
    host?.id,
  );
  const [propertyId, setPropertyId] = useState<string | undefined>(undefined);
  const activeProperty = propertyId ?? properties?.[0]?.id;

  const { data: calendar, isLoading } = useCalendar(activeProperty);
  const toggle = useToggleBlock(activeProperty ?? "", session?.user.id);

  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const todayIso = iso(
    new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
  );

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(
    "en-ZA",
    {
      month: "long",
      year: "numeric",
    },
  );

  function shift(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function onDayPress(date: Date) {
    const key = iso(date);
    const status = calendar?.statusByDate[key] ?? "open";
    if (status === "booked") return; // bookings can't be toggled here
    const isManual = calendar?.manualBlocked.has(key) ?? false;
    if (status === "blocked" && !isManual) return; // ical/booking blocks aren't editable
    toggle.mutate({ date: key, blocked: status === "blocked" });
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("host.tabs.calendar")} bordered />

      {loadingProps ? (
        <View className="p-5">
          <Skeleton height={300} rounded={16} />
        </View>
      ) : !properties || properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No properties"
          message="Add a property to manage its calendar."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {/* Property picker */}
          {properties.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {properties.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  active={p.id === activeProperty}
                  onPress={() => setPropertyId(p.id)}
                />
              ))}
            </ScrollView>
          ) : null}

          {/* Month nav */}
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => shift(-1)}
              className="h-9 w-9 items-center justify-center rounded-full border border-brand-line"
            >
              <Icon icon={ChevronLeft} size={18} color={brand.ink} />
            </Pressable>
            <Text className="font-display text-[16px] text-brand-ink">
              {monthLabel}
            </Text>
            <Pressable
              onPress={() => shift(1)}
              className="h-9 w-9 items-center justify-center rounded-full border border-brand-line"
            >
              <Icon icon={ChevronRight} size={18} color={brand.ink} />
            </Pressable>
          </View>

          {/* Day-of-week header */}
          <View className="flex-row">
            {DOW.map((d, i) => (
              <Text
                key={i}
                className="flex-1 text-center font-sans-semibold text-[10px] uppercase text-[#9CB3A8]"
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Grid */}
          {isLoading ? (
            <Skeleton height={260} rounded={12} />
          ) : (
            <View className="flex-row flex-wrap">
              {cells.map((date, i) => {
                if (!date)
                  return (
                    <View
                      key={i}
                      style={{ width: `${100 / 7}%`, aspectRatio: 1 }}
                    />
                  );
                const key = iso(date);
                const status = calendar?.statusByDate[key] ?? "open";
                const isToday = key === todayIso;
                return (
                  <View
                    key={i}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
                  >
                    <Pressable
                      onPress={() => onDayPress(date)}
                      className={`flex-1 items-center justify-center rounded-[10px] border ${cellBg[status]} ${
                        isToday ? "border-brand-secondary" : "border-[#EEF4F0]"
                      }`}
                    >
                      <Text
                        className={`font-sans-semibold text-[12.5px] ${cellText[status]}`}
                      >
                        {date.getUTCDate()}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Legend */}
          <View className="flex-row flex-wrap gap-x-4 gap-y-2">
            <Legend color={brand.primary} label="Booked" />
            <Legend color="#EFF3F1" label="Blocked (tap to unblock)" border />
            <Legend color="#FFFFFF" label="Open (tap to block)" border />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Legend({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        className="h-3.5 w-3.5 rounded-[4px]"
        style={{
          backgroundColor: color,
          borderWidth: border ? 1 : 0,
          borderColor: brand.line,
        }}
      />
      <Text className="font-sans text-[12px] text-brand-mute">{label}</Text>
    </View>
  );
}
