"use client";

import { ShieldCheck, Mail, Phone, UserCheck, HelpCircle } from "lucide-react";

interface GuestVerification {
  email_verified: boolean;
  phone_verified: boolean;
  id_verified: boolean;
}

interface GuestTrustBadgeProps {
  verification: GuestVerification;
  size?: "sm" | "md";
}

export function GuestTrustBadge({
  verification,
  size = "sm",
}: GuestTrustBadgeProps) {
  const { email_verified, phone_verified, id_verified } = verification;

  // Calculate trust level
  const trustLevel =
    (email_verified ? 1 : 0) + (phone_verified ? 1 : 0) + (id_verified ? 2 : 0); // ID verification counts double

  // Build tooltip text
  const verifications = [];
  if (email_verified) verifications.push("Email verified");
  if (phone_verified) verifications.push("Phone verified");
  if (id_verified) verifications.push("ID verified");
  const tooltipText =
    verifications.length > 0
      ? verifications.join(", ")
      : "No verifications yet";

  // Determine badge appearance based on trust level
  const getBadgeConfig = () => {
    if (trustLevel >= 3) {
      // ID verified + at least one other
      return {
        icon: ShieldCheck,
        label: "Verified",
        className: "text-green-600 bg-green-50",
        borderClass: "border-green-200",
      };
    } else if (trustLevel >= 2) {
      // Multiple verifications
      return {
        icon: UserCheck,
        label: "Trusted",
        className: "text-blue-600 bg-blue-50",
        borderClass: "border-blue-200",
      };
    } else if (trustLevel === 1) {
      // Just email verified
      return {
        icon: Mail,
        label: "Email verified",
        className: "text-brand-mute bg-brand-light",
        borderClass: "border-brand-line",
      };
    } else {
      // No verification
      return {
        icon: HelpCircle,
        label: "New guest",
        className: "text-brand-mute bg-gray-50",
        borderClass: "border-gray-200",
      };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${config.borderClass} ${config.className} ${padding} ${textSize}`}
      title={tooltipText}
    >
      <Icon className={iconSize} />
      <span>{config.label}</span>
    </span>
  );
}

/**
 * Compact verification indicators for use in cards
 */
export function GuestVerificationIcons({
  verification,
}: {
  verification: GuestVerification;
}) {
  const { email_verified, phone_verified, id_verified } = verification;

  if (!email_verified && !phone_verified && !id_verified) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5">
      {email_verified && (
        <span title="Email verified">
          <Mail className="h-3 w-3 text-green-600" />
        </span>
      )}
      {phone_verified && (
        <span title="Phone verified">
          <Phone className="h-3 w-3 text-green-600" />
        </span>
      )}
      {id_verified && (
        <span title="ID verified">
          <ShieldCheck className="h-3 w-3 text-green-600" />
        </span>
      )}
    </div>
  );
}
