import { Text, View } from "react-native";
import type { Tone } from "@/theme/tokens";

// Mirrors .tag colour families from the design source.
const toneStyles: Record<Tone, { box: string; text: string; dot: string }> = {
  green: {
    box: "bg-[#ECFDF5] border-[#C7F0DC]",
    text: "text-[#047857]",
    dot: "bg-[#10B981]",
  },
  amber: {
    box: "bg-[#FFFBEB] border-[#FCE9B6]",
    text: "text-[#B45309]",
    dot: "bg-[#F59E0B]",
  },
  red: {
    box: "bg-[#FEF2F2] border-[#FBD5D5]",
    text: "text-[#DC2626]",
    dot: "bg-[#EF4444]",
  },
  indigo: {
    box: "bg-[#EEF0FF] border-[#D7DBFB]",
    text: "text-[#4F46E5]",
    dot: "bg-[#6366F1]",
  },
  sky: {
    box: "bg-[#EFF8FE] border-[#C9E9F8]",
    text: "text-[#0284C7]",
    dot: "bg-[#0EA5E9]",
  },
  gray: {
    box: "bg-[#F4F7F5] border-[#E4EFE8]",
    text: "text-[#5B7065]",
    dot: "bg-[#94A3B8]",
  },
};

export function Tag({
  label,
  tone = "gray",
  dot = true,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
}) {
  const s = toneStyles[tone];
  return (
    <View
      className={`flex-row items-center gap-[5px] self-start rounded-pill border px-[9px] py-[3px] ${s.box}`}
    >
      {dot ? (
        <View className={`h-[6px] w-[6px] rounded-pill ${s.dot}`} />
      ) : null}
      <Text className={`font-sans-semibold text-[11px] ${s.text}`}>
        {label}
      </Text>
    </View>
  );
}

// Maps a booking/payment status string to a tag tone, matching web conventions.
export function statusTone(status: string): Tone {
  switch (status) {
    case "confirmed":
    case "completed":
    case "paid":
    case "active":
      return "green";
    case "pending":
    case "awaiting_payment":
    case "checked_in":
      return "amber";
    case "cancelled":
    case "declined":
    case "refunded":
      return "red";
    default:
      return "gray";
  }
}
