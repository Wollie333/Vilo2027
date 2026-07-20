// WS-3a — Build Board constants + types shared by server and client. No
// "server-only" import here so client components can pull the status metadata
// and shapes; the data-access functions live in lib/buildBoard.ts (server).

export const BOARD_STATUSES = [
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "not_doing",
] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const STATUS_META: Record<
  BoardStatus,
  { label: string; blurb: string; tone: string; dot: string }
> = {
  under_review: {
    label: "Under review",
    blurb: "We've seen it and we're weighing it up.",
    tone: "bg-brand-mute/12 text-brand-mute",
    dot: "bg-brand-mute",
  },
  planned: {
    label: "Planned",
    blurb: "On the roadmap — not started yet.",
    tone: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
  },
  in_progress: {
    label: "In progress",
    blurb: "Being built right now.",
    tone: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  shipped: {
    label: "Shipped",
    blurb: "Live for everyone.",
    tone: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  not_doing: {
    label: "Not doing",
    blurb: "An honest no — and why.",
    tone: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
  },
};

export type FeatureRequest = {
  id: string;
  title: string;
  body: string | null;
  status: BoardStatus;
  voteCount: number;
  hostVoteCount: number;
  guestVoteCount: number;
  submitterRole: "host" | "guest" | null;
  shippedAt: string | null;
  createdAt: string;
};

export type AdminFeatureRequest = FeatureRequest & {
  isPublic: boolean;
  mergedIntoId: string | null;
  submitterEmail: string | null;
  adminNote: string | null;
};

export type BuildBoardData = {
  requests: FeatureRequest[];
  votedIds: string[];
  isAuthenticated: boolean;
  counts: Record<BoardStatus, number>;
};
