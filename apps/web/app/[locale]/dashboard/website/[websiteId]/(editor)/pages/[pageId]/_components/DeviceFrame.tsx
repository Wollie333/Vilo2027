"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useTranslations } from "next-intl";

const WIDTH = {
  desktop: "max-w-full",
  tablet: "max-w-[834px]",
  phone: "max-w-[390px]",
} as const;

type Device = keyof typeof WIDTH;

/**
 * Reusable responsive preview shell — a desktop/tablet/mobile toggle over a
 * framed, scrollable canvas. `toolbar` renders extra controls inline with the
 * device switch (e.g. a visual-edit toggle).
 */
export function DeviceFrame({
  toolbar,
  children,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("website");
  const [device, setDevice] = useState<Device>("desktop");

  const devices: Array<{ key: Device; title: string; icon: ReactNode }> = [
    {
      key: "desktop",
      title: t("deviceDesktop"),
      icon: <Monitor className="h-4 w-4" />,
    },
    {
      key: "tablet",
      title: t("deviceTablet"),
      icon: <Tablet className="h-4 w-4" />,
    },
    {
      key: "phone",
      title: t("devicePhone"),
      icon: <Smartphone className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
          {t("livePreview")}
        </span>
        <div className="flex items-center gap-2">
          {toolbar}
          <div className="inline-flex rounded-[10px] border border-brand-line bg-white p-0.5">
            {devices.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDevice(d.key)}
                title={d.title}
                className={`rounded-[8px] p-1.5 ${
                  device === d.key
                    ? "bg-brand-primary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {d.icon}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-card border border-brand-line bg-brand-light/40">
        <div
          className={`mx-auto max-h-[78vh] overflow-y-auto bg-white transition-[max-width] ${WIDTH[device]}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
