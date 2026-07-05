"use client";

// Media-picker context — lets every `MediaControl` (anywhere in the app) open the
// SAME media-library modal (upload OR pick a previously-uploaded asset) without
// each parent wiring a modal. The builder wraps its tree in a real provider
// (which renders the modal + knows the websiteId); surfaces with no provider fall
// back to MediaControl's inline upload/URL. See Business Principle #8.

import { createContext, useContext } from "react";

export type MediaPickerRequest = {
  /** The current image URL (highlighted in the library), if any. */
  value?: string;
  /** Called with the chosen/uploaded image URL. */
  onPick: (url: string) => void;
};

/** Opens the media-library modal; null when no provider is mounted. */
export type OpenMediaPicker = (req: MediaPickerRequest) => void;

const MediaPickerContext = createContext<OpenMediaPicker | null>(null);

export function MediaPickerContextProvider({
  open,
  children,
}: {
  open: OpenMediaPicker;
  children: React.ReactNode;
}) {
  return (
    <MediaPickerContext.Provider value={open}>
      {children}
    </MediaPickerContext.Provider>
  );
}

/** The open-picker function, or null when no media-library provider is mounted. */
export function useMediaPicker(): OpenMediaPicker | null {
  return useContext(MediaPickerContext);
}
