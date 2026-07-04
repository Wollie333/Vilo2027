import type { CSSProperties } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { ProfileData } from "@/lib/site/types";

import { SectionHeading, Stars } from "./_shared";

type Props = Extract<WebsiteSection, { type: "profile" }>["props"];

/**
 * Host Profile — an auto-populate Wielo block. Pulls the site's host live (photo,
 * name, rating, bio, Superhost/Verified badges). Theme = style (`--site-*`), host
 * can restyle via the block's `--el-*` element controls. Variants: card · side ·
 * centered. Renders nothing when no host resolves (canvas uses demo data).
 */
export function ProfileSection({
  props,
  data,
}: {
  props: Props;
  data?: ProfileData;
}) {
  if (!data) return null;
  const { name, avatar, bio, rating, reviews, superhost, verified } = data;
  const variant = props.variant ?? "card";
  const centered = variant === "centered";
  const isCard = variant === "card";
  const avatarSize = variant === "side" ? 128 : 92;

  const avatarEl = (
    <div
      aria-hidden
      style={{
        width: avatarSize,
        height: avatarSize,
        flexShrink: 0,
        borderRadius: "var(--el-avatar-radius, 9999px)",
        border: "var(--el-avatar-bd, 2px solid var(--site-line))",
        background: avatar
          ? `#0000 url("${avatar}") center/cover no-repeat`
          : "var(--site-bg)",
        display: avatar ? undefined : "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--site-mute)",
        fontSize: 30,
        fontWeight: 700,
      }}
    >
      {avatar ? null : (name[0] ?? "H").toUpperCase()}
    </div>
  );

  const body = (
    <div style={{ textAlign: centered ? "center" : "left", minWidth: 0 }}>
      <h3
        style={{
          margin: 0,
          fontFamily: "var(--site-font-heading)",
          color: "var(--el-name-fg, var(--site-ink))",
          fontSize: "var(--el-name-size, 1.375rem)",
          fontWeight: "var(--el-name-weight, 700)" as unknown as number,
        }}
      >
        {name}
      </h3>
      {props.show_rating !== false && rating != null ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: centered ? "center" : "flex-start",
            marginTop: 5,
          }}
        >
          <Stars rating={rating} />
          <span style={{ color: "var(--site-mute)", fontSize: 13 }}>
            {rating.toFixed(1)}
            {reviews ? ` · ${reviews} review${reviews === 1 ? "" : "s"}` : ""}
          </span>
        </div>
      ) : null}
      {props.show_badges !== false && (superhost || verified) ? (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 8,
            justifyContent: centered ? "center" : "flex-start",
          }}
        >
          {superhost ? <Badge label="Superhost" /> : null}
          {verified ? <Badge label="Verified" /> : null}
        </div>
      ) : null}
      {bio ? (
        <p
          style={{
            margin: "12px 0 0",
            color: "var(--el-bio-fg, var(--site-mute))",
            fontSize: "var(--el-bio-size, 15px)",
            lineHeight: 1.65,
            whiteSpace: "pre-line",
          }}
        >
          {bio}
        </p>
      ) : null}
    </div>
  );

  const wrap: CSSProperties = {
    display: "flex",
    flexDirection: centered ? "column" : "row",
    alignItems: centered || variant === "side" ? "center" : "flex-start",
    gap: 22,
    maxWidth: centered ? 620 : 760,
    margin: "0 auto",
    ...(isCard
      ? {
          background: "var(--el-card-bg, var(--site-surface))",
          border: "var(--el-card-bd, var(--site-card-border))",
          borderRadius: "var(--el-card-radius, var(--site-card-radius))",
          boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
          padding: 26,
        }
      : {}),
  };

  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}
      <div style={wrap}>
        {avatarEl}
        {body}
      </div>
    </>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "3px 9px",
        borderRadius: 9999,
        background: "var(--site-accent)",
        color: "var(--site-accent-ink, #fff)",
      }}
    >
      {label}
    </span>
  );
}
