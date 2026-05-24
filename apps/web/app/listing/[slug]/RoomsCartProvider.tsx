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

  const toggle = useCallback((roomId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const handleSetFlexibleTab = useCallback((t: FlexibleTab) => {
    setFlexibleTab(t);
    setSelected(new Set());
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
