"use client";

import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { useRoomsCart } from "./RoomsCartProvider";

/**
 * Interactive availability calendar wired to the rooms-cart dates, so picking
 * a range here updates the booking sidebar (and its price) live.
 */
export function RoomsCalendarSection({
  unavailable,
}: {
  unavailable: string[];
}) {
  const { checkIn, checkOut, setCheckIn, setCheckOut } = useRoomsCart();

  return (
    <section id="sec-calendar" className="border-b border-brand-line py-7">
      <h3 className="font-display text-xl font-bold text-brand-ink">
        Choose your dates
      </h3>
      <p className="mt-1 text-sm text-brand-mute">
        Pick a check-in and check-out — prices update in the booking panel.
      </p>
      <div className="mt-5">
        <AvailabilityCalendar
          unavailable={unavailable}
          from={checkIn}
          to={checkOut}
          onSelect={(f, t) => {
            setCheckIn(f);
            setCheckOut(t);
          }}
        />
      </div>
    </section>
  );
}
