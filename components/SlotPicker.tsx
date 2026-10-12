"use client";

import { useEffect, useMemo, useState } from "react";
import { Chip } from "./ui";
import { timeLabel } from "@/lib/schedule";
import type { DoctorAvailabilityDay } from "@/lib/types";

/**
 * Day rail + time grid.
 *
 * Days are chips (full pill, ~32px) and slots are 3-up tiles. Booked slots stay
 * visible but disabled — seeing "11:20 taken" is more reassuring than a gap in
 * the grid, and it matches how a clinic receptionist reads out availability.
 */
export function SlotPicker({
  days,
  selectedSlotId,
  onSelect,
  daysToShow = 7,
  emptyHint = "Pick another day",
}: {
  days: DoctorAvailabilityDay[];
  selectedSlotId?: string | null;
  onSelect: (slotId: string) => void;
  daysToShow?: number;
  emptyHint?: string;
}) {
  const visible = useMemo(() => days.slice(0, daysToShow), [days, daysToShow]);
  const [dayIndex, setDayIndex] = useState(0);

  // If the selected slot lives on a different day (e.g. a reschedule), follow it.
  useEffect(() => {
    if (!selectedSlotId) return;
    const idx = visible.findIndex((d) => d.slots.some((s) => s.id === selectedSlotId));
    if (idx >= 0 && idx !== dayIndex) setDayIndex(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlotId]);

  const day = visible[Math.min(dayIndex, Math.max(visible.length - 1, 0))];
  const openCount = day ? day.slots.filter((s) => s.status === "open").length : 0;

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl bg-canvas px-4 py-6 text-center text-[13px] text-ink-muted">
        No slots open in the next two weeks. Try another doctor.
      </p>
    );
  }

  return (
    <div>
      <div className="chip-row pb-1" role="tablist" aria-label="Choose a day">
        {visible.map((d, i) => (
          <Chip
            key={d.date}
            label={`${d.label}`}
            active={i === dayIndex}
            onClick={() => setDayIndex(i)}
          />
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[13px] font-medium text-ink">
            {day.weekday}, {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long" })}
          </p>
          <p className="text-sub text-ink-muted">
            {openCount} {openCount === 1 ? "slot" : "slots"} open
          </p>
        </div>

        {openCount === 0 ? (
          <p className="rounded-2xl bg-canvas px-4 py-5 text-center text-[13px] text-ink-muted">
            {emptyHint} — fully booked.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Choose a time">
            {day.slots.map((slot) => {
              const selected = slot.id === selectedSlotId;
              const taken = slot.status !== "open";
              return (
                <button
                  key={slot.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={taken}
                  onClick={() => onSelect(slot.id)}
                  className={[
                    "h-11 rounded-2xl border text-[13px] font-medium transition-colors duration-150",
                    taken
                      ? "cursor-not-allowed border-line bg-canvas text-ink-muted/45 line-through"
                      : selected
                        ? "border-primary bg-primary text-white font-semibold"
                        : "border-line bg-surface text-ink pressable hover:border-primary",
                  ].join(" ")}
                >
                  {timeLabel(slot.startsAt)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
