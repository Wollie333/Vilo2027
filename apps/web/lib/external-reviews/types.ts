// External Review Source Types
export type ExternalReviewSource = "google" | "facebook" | "trustpilot";

export interface ExternalReviewSourceRow {
  id: string;
  host_id: string;
  source: ExternalReviewSource;
  external_account_id: string;
  account_name: string | null;
  account_url: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
}

export interface ExternalReviewRow {
  id: string;
  source_id: string;
  host_id: string;
  property_id: string | null;
  external_review_id: string;
  reviewer_name: string | null;
  reviewer_avatar_url: string | null;
  rating: number | null;
  body: string | null;
  review_url: string | null;
  host_reply: string | null;
  host_reply_at: string | null;
  reply_synced: boolean;
  reviewed_at: string;
  is_visible: boolean;
  is_featured: boolean;
  created_at: string;
}

// OAuth state stored in session/cookie
export interface OAuthState {
  source: ExternalReviewSource;
  hostId: string;
  returnUrl: string;
  nonce: string;
}

// Google Business Profile types
export interface GoogleLocation {
  name: string; // accounts/{accountId}/locations/{locationId}
  locationName: string;
  primaryPhone?: string;
  websiteUrl?: string;
}

export interface GoogleReview {
  name: string; // accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

// Facebook types
export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

export interface FacebookReview {
  recommendation_type: "positive" | "negative" | "none";
  review_text?: string;
  created_time: string;
  reviewer: {
    id: string;
    name: string;
  };
  rating?: number; // Only available in some regions
}

// Trustpilot types
export interface TrustpilotReview {
  id: string;
  consumer: {
    id: string;
    displayName: string;
  };
  stars: number;
  text?: string;
  createdAt: string;
  companyReply?: {
    text: string;
    createdAt: string;
  };
}
