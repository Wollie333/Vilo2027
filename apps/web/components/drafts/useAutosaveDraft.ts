"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  discardFormDraftAction,
  saveFormDraftAction,
} from "@/lib/drafts/actions";
import type { DraftEntityType, LoadedDraft } from "@/lib/drafts/store";

// ── Shared auto-save hook (Layer A local + Layer B durable) ──────────────────
//
// Zero-loss editing: the live form snapshot is debounce-persisted to
// localStorage (instant, offline) AND synced to the durable `form_drafts` store
// (cross-device), and flushed on tab-hide / unload. On mount it reconciles the
// newer of the local vs server draft against the loaded entity and, only when
// they actually differ, surfaces a "resume where you left off" prompt.
//
// The editor owns WHAT to protect: pass `value` = a serialisable snapshot of the
// fields that are lost on navigate-away (i.e. the ones that only persist on an
// explicit Save). Fields saved by their own immediate action (image upload,
// active toggle, availability) should be left out.

const LOCAL_DEBOUNCE_MS = 500;
const SERVER_DEBOUNCE_MS = 2500;

export type DraftTarget = {
  entityType: DraftEntityType;
  entityId: string | null;
  scopeId: string | null;
};

export type UseAutosaveDraftArgs<T> = {
  userId: string;
  target: DraftTarget;
  /** Serialisable snapshot of the at-risk form fields. */
  value: T;
  /** Apply a restored payload back into the form. */
  onRestore: (payload: T) => void;
  /** Gate persistence (e.g. until the editor is ready). Default true. */
  enabled?: boolean;
  /** Durable draft loaded server-side and passed in for reconciliation. */
  serverDraft?: LoadedDraft | null;
  /**
   * localStorage-ONLY mode (default false). For anonymous editors with no
   * session (the public post-first funnel): the durable `form_drafts` store is
   * user-scoped, so skip every server call (save / beacon / unmount flush /
   * discard) and keep the draft purely on this device.
   */
  localOnly?: boolean;
};

export type AutosaveStatus = "idle" | "saving" | "saved";

export type UseAutosaveDraftResult = {
  /** An unsaved draft is available to restore (drives the resume banner). */
  hasDraft: boolean;
  /** Restore the available draft into the form. */
  restore: () => void;
  /** Throw away the available draft (keeps editing from current state). */
  discard: () => void;
  /** Clear the draft + rebaseline — call on successful Save. */
  clearSaved: () => void;
  /** ISO timestamp of the available draft (for "from 3 min ago"). */
  savedAt: string | null;
  status: AutosaveStatus;
};

function localKey(userId: string, t: DraftTarget): string {
  return `wielo:draft:${userId}:${t.entityType}:${t.entityId ?? "new"}:${
    t.scopeId ?? "-"
  }`;
}

function readLocal(
  key: string,
): { payload: unknown; updatedAt: string } | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload: unknown; updatedAt: string };
    if (!parsed || typeof parsed.updatedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useAutosaveDraft<T>({
  userId,
  target,
  value,
  onRestore,
  enabled = true,
  serverDraft = null,
  localOnly = false,
}: UseAutosaveDraftArgs<T>): UseAutosaveDraftResult {
  const key = useMemo(() => localKey(userId, target), [userId, target]);
  const serial = useMemo(() => JSON.stringify(value ?? null), [value]);

  // Latest snapshot, kept in refs so unload handlers see current data.
  const valueRef = useRef(value);
  const serialRef = useRef(serial);
  valueRef.current = value;
  serialRef.current = serial;

  // Baseline = the state we consider "saved". Starts at the mount snapshot; we
  // only persist a draft when the live form diverges from it, so an unchanged
  // editor never writes (or resurrects) a draft.
  const baselineRef = useRef<string | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  const [available, setAvailable] = useState<{
    payload: T;
    updatedAt: string;
  } | null>(null);
  const [status, setStatus] = useState<AutosaveStatus>("idle");

  // ---- Mount: capture baseline + reconcile local/server drafts ----
  useEffect(() => {
    baselineRef.current = serialRef.current;
    if (typeof window === "undefined") return;

    const local = readLocal(key);
    const server = serverDraft;
    // Newest of the two candidate drafts.
    let candidate: { payload: unknown; updatedAt: string } | null = null;
    if (local && server) {
      candidate = local.updatedAt >= server.updatedAt ? local : server;
    } else {
      candidate = local ?? server ?? null;
    }
    if (!candidate) return;

    // Only offer a resume if the draft actually differs from the loaded entity.
    if (JSON.stringify(candidate.payload ?? null) === baselineRef.current)
      return;
    setAvailable({
      payload: candidate.payload as T,
      updatedAt: candidate.updatedAt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ---- Debounced persistence (local fast, server slower) ----
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushServer = useCallback(() => {
    // Anonymous editor → localStorage only; the mount effect already persisted
    // it locally, so just mark saved and skip the user-scoped durable store.
    if (localOnly) {
      setStatus("saved");
      return;
    }
    // A timer scheduled just before a Save can fire after it — never resurrect a
    // draft that now equals the saved baseline.
    if (
      baselineRef.current !== null &&
      serialRef.current === baselineRef.current
    ) {
      return;
    }
    void saveFormDraftAction(targetRef.current, valueRef.current).then(() =>
      setStatus("saved"),
    );
  }, [localOnly]);

  const clearTimers = useCallback(() => {
    if (localTimer.current) clearTimeout(localTimer.current);
    if (serverTimer.current) clearTimeout(serverTimer.current);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (baselineRef.current === null) return; // before mount reconcile
    // No divergence from the saved baseline → nothing at risk, don't persist.
    if (serial === baselineRef.current) return;

    setStatus("saving");
    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => {
      if (
        baselineRef.current !== null &&
        serialRef.current === baselineRef.current
      ) {
        return;
      }
      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            payload: valueRef.current,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // storage full / disabled — server sync still covers us.
      }
    }, LOCAL_DEBOUNCE_MS);

    if (serverTimer.current) clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(flushServer, SERVER_DEBOUNCE_MS);

    return () => {
      if (localTimer.current) clearTimeout(localTimer.current);
      if (serverTimer.current) clearTimeout(serverTimer.current);
    };
  }, [serial, enabled, key, flushServer]);

  // ---- Flush on tab-hide / unload ----
  useEffect(() => {
    if (!enabled) return;
    function persistNow() {
      if (baselineRef.current === null) return;
      if (serialRef.current === baselineRef.current) return;
      const at = new Date().toISOString();
      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({ payload: valueRef.current, updatedAt: at }),
        );
      } catch {
        /* ignore */
      }
      // Best-effort durable flush that survives the page going away. Skipped for
      // an anonymous editor — the durable store is user-scoped (local is enough).
      if (localOnly) return;
      try {
        const blob = new Blob(
          [
            JSON.stringify({
              target: targetRef.current,
              payload: valueRef.current,
            }),
          ],
          { type: "application/json" },
        );
        navigator.sendBeacon?.("/api/drafts", blob);
      } catch {
        /* ignore */
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") persistNow();
    }
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", persistNow);
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", persistNow);
    };
  }, [enabled, key, localOnly]);

  // ---- Final flush on unmount (client-side route change fires no pagehide) ----
  useEffect(() => {
    return () => {
      if (baselineRef.current === null) return;
      if (serialRef.current === baselineRef.current) return;
      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            payload: valueRef.current,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        /* ignore */
      }
      if (!localOnly)
        void saveFormDraftAction(targetRef.current, valueRef.current);
    };
  }, [key, localOnly]);

  // ---- Controls ----
  const restore = useCallback(() => {
    setAvailable((cur) => {
      if (cur) onRestore(cur.payload);
      return null;
    });
  }, [onRestore]);

  const wipe = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    if (!localOnly) void discardFormDraftAction(targetRef.current);
  }, [key, localOnly]);

  const discard = useCallback(() => {
    // Rebaseline to the current form so it isn't re-detected as a draft.
    clearTimers();
    baselineRef.current = serialRef.current;
    wipe();
    setAvailable(null);
    setStatus("idle");
  }, [wipe, clearTimers]);

  const clearSaved = useCallback(() => {
    // After a real Save: current state IS the new saved baseline.
    clearTimers();
    baselineRef.current = serialRef.current;
    wipe();
    setAvailable(null);
    setStatus("idle");
  }, [wipe, clearTimers]);

  return {
    hasDraft: available !== null,
    restore,
    discard,
    clearSaved,
    savedAt: available?.updatedAt ?? null,
    status,
  };
}
