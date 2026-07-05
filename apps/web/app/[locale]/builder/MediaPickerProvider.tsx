"use client";

// Mounts ONE media-library modal for the whole builder and exposes `openPicker`
// via the MediaPicker context, so every MediaControl/MediaField anywhere in the
// tree opens the same "upload OR pick from library" modal.

import { useCallback, useState } from "react";

import {
  MediaPickerContextProvider,
  type MediaPickerRequest,
} from "@/components/builder/controls/MediaPicker";
import { MediaLibraryModal } from "./MediaLibraryModal";

export function MediaPickerProvider({
  websiteId,
  children,
}: {
  websiteId?: string;
  children: React.ReactNode;
}) {
  const [req, setReq] = useState<MediaPickerRequest | null>(null);
  const open = useCallback((r: MediaPickerRequest) => setReq(r), []);

  return (
    <MediaPickerContextProvider open={open}>
      {children}
      <MediaLibraryModal
        open={!!req}
        websiteId={websiteId}
        current={req?.value}
        onClose={() => setReq(null)}
        onPick={(url) => req?.onPick(url)}
      />
    </MediaPickerContextProvider>
  );
}
