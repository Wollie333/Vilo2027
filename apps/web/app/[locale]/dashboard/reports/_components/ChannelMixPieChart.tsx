"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface ChannelData {
  channel: string;
  revenue: number;
  bookings: number;
  percentage: number;
}

interface ChannelMixPieChartProps {
  data: ChannelData[];
}

// Channel colors matching brand palette
const CHANNEL_COLORS: Record<string, string> = {
  direct: "#10B981", // Wielo-app direct (brand green)
  vilo: "#10B981",
  website: "#0EA5E9", // host's own website (sky)
  "web-referred": "#7C3AED",
  lekkerslaap: "#E11D48",
  airbnb: "#FF5A5F", // Airbnb brand red
  booking: "#003580", // Booking.com brand blue
  "booking.com": "#003580",
  expedia: "#FFCC00", // Expedia brand yellow
  other: "#9CA3AF", // gray
};

export function ChannelMixPieChart({ data }: ChannelMixPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
        <div className="text-center text-sm text-brand-mute">
          No channel data available
        </div>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = data.map((item) => ({
    name: formatChannelName(item.channel),
    value: item.revenue,
    bookings: item.bookings,
    percentage: item.percentage,
    channel: item.channel.toLowerCase(),
  }));

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalBookings = data.reduce((sum, item) => sum + item.bookings, 0);

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Channel mix
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          R {formatCurrency(totalRevenue)} from {data.length} channels
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          {totalBookings} bookings · Direct bookings save 15% commission
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHANNEL_COLORS[entry.channel] || CHANNEL_COLORS.other}
              />
            ))}
          </Pie>

          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "none",
              borderRadius: "6px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              padding: "8px 12px",
            }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const data = payload[0].payload;
              return (
                <div style={{ fontSize: "11px" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#fff",
                      marginBottom: "4px",
                    }}
                  >
                    {data.name}
                  </div>
                  <div style={{ color: "#fff" }}>
                    R {formatCurrency(data.value)}
                  </div>
                  <div
                    style={{
                      color: "#9DC1B0",
                      fontSize: "10px",
                      marginTop: "2px",
                    }}
                  >
                    {data.bookings} bookings · {data.percentage}%
                  </div>
                </div>
              );
            }}
          />

          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{
              paddingTop: "16px",
              fontSize: "11px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Channel breakdown list */}
      <div className="mt-4 space-y-2 border-t border-brand-line pt-4">
        {data.map((item) => (
          <div
            key={item.channel}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    CHANNEL_COLORS[item.channel.toLowerCase()] ||
                    CHANNEL_COLORS.other,
                }}
              />
              <span className="font-medium text-brand-ink">
                {formatChannelName(item.channel)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-brand-mute">{item.bookings} bookings</span>
              <span className="font-semibold text-brand-ink">
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper: Format currency
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + "k";
  }
  return value.toFixed(0);
}

// Helper: Format channel name
function formatChannelName(channel: string): string {
  const formatted = channel.toLowerCase();

  const nameMap: Record<string, string> = {
    direct: "Wielo",
    vilo: "Wielo",
    website: "Website",
    "web-referred": "Web referral",
    airbnb: "Airbnb",
    booking: "Booking.com",
    "booking.com": "Booking.com",
    expedia: "Expedia",
    lekkerslaap: "LekkerSlaap",
    other: "Other",
  };

  return (
    nameMap[formatted] || channel.charAt(0).toUpperCase() + channel.slice(1)
  );
}
