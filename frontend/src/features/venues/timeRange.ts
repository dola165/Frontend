import type { Slot } from "./api";

/** Extend only through consecutive server-approved minimum-length windows.
 * Timestamp arithmetic preserves midnight and daylight-saving boundaries. */
export function availableEnds(slots: Slot[], start: string, stepMinutes: number, maximumMinutes: number) {
  const byStart = new Map(slots.map(slot => [Date.parse(slot.startsAt), slot]));
  const from = Date.parse(start);
  const ends: string[] = [];
  if (!Number.isFinite(from) || stepMinutes <= 0) return ends;
  for (let at = from; at < from + maximumMinutes * 60000; at += stepMinutes * 60000) {
    const slot = byStart.get(at);
    if (!slot?.available || Date.parse(slot.endsAt) > from + maximumMinutes * 60000) break;
    ends.push(slot.endsAt);
  }
  return ends;
}

export const hoursLabel = (minutes: number) => `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`;
