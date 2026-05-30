"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type BookingMode = "whole_listing" | "rooms_only" | "flexible";
export type FlexibleTab = "whole" | "rooms";

type CartState = {
  mode: BookingMode;
  flexibleTab: FlexibleTab;
  setFlexibleTab: (t: FlexibleTab) => void;

  selected: Set<string>;
  toggle: (roomId: string) => void;
  clear: () => void;
  isSelected: (roomId: string) => boolean;

  // Per-room guest counts (rooms scope). Drives per-person / extra-guest
  // pricing and per-room capacity. Keyed by room id.
  roomGuests: Record<string, number>;
  setRoomGuests: (roomId: string, n: number) => void;

  checkIn: string;
  checkOut: string;
  setCheckIn: (v: string) => void;
  setCheckOut: (v: string) => void;

  guests: number;
  setGuests: (n: number) => void;
};

const Ctx = createContext<CartState | null>(null);

export function RoomsCartProvider({
  mode,
  children,
}: {
  mode: BookingMode;
  children: React.ReactNode;
}) {
  const [flexibleTab, setFlexibleTab] = useState<FlexibleTab>("whole");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [roomGuests, setRoomGuestsState] = useState<Record<string, number>>({});

  const toggle = useCallback((roomId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
    // Seed a default of 1 guest when first adding a room; drop it on removal.
    setRoomGuestsState((prev) => {
      const next = { ...prev };
      if (next[roomId] == null) next[roomId] = 1;
      else delete next[roomId];
      return next;
    });
  }, []);

  const setRoomGuests = useCallback((roomId: string, n: number) => {
    setRoomGuestsState((prev) => ({ ...prev, [roomId]: Math.max(1, n) }));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setRoomGuestsState({});
  }, []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const handleSetFlexibleTab = useCallback((t: FlexibleTab) => {
    setFlexibleTab(t);
    setSelected(new Set());
    setRoomGuestsState({});
  }, []);

  const value = useMemo<CartState>(
    () => ({
      mode,
      flexibleTab,
      setFlexibleTab: handleSetFlexibleTab,
      selected,
      toggle,
      clear,
      isSelected,
      roomGuests,
      setRoomGuests,
      checkIn,
      checkOut,
      setCheckIn,
      setCheckOut,
      guests,
      setGuests,
    }),
    [
      mode,
      flexibleTab,
      handleSetFlexibleTab,
      selected,
      toggle,
      clear,
      isSelected,
      roomGuests,
      setRoomGuests,
      checkIn,
      checkOut,
      guests,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRoomsCart(): CartState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoomsCart must be used inside RoomsCartProvider");
  return v;
}
