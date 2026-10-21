import { availableEnds, hoursLabel } from "./timeRange";
import type { Slot } from "./api";

const windows = (from: string, count: number, minimum = 60): Slot[] => Array.from({length:count},(_,i) => ({startsAt:new Date(Date.parse(from)+i*30*60000).toISOString(), endsAt:new Date(Date.parse(from)+(i*30+minimum)*60000).toISOString(), available:true, price:80}));

it("offers every valid end in half-hour increments, capped by the venue maximum", () => {
  const slots=windows("2099-10-01T18:00:00+04:00",12);
  expect(availableEnds(slots,slots[0].startsAt,30,180)).toEqual(slots.slice(0,5).map(s=>s.endsAt));
  expect(hoursLabel(150)).toBe("2.5 hours");
});
it("never bridges a booking or missing interval even if later slots are free", () => {
  const slots=windows("2099-10-01T18:00:00+04:00",8);
  slots[2].available=false;
  expect(availableEnds(slots,slots[0].startsAt,30,180)).toEqual(slots.slice(0,2).map(s=>s.endsAt));
  expect(availableEnds(slots.filter((_,i)=>i!==1),slots[0].startsAt,30,180)).toEqual([slots[0].endsAt]);
});
it("uses actual instants across midnight and seasonal clock changes", () => {
  for (const start of ["2099-10-01T23:00:00+04:00","2026-10-25T01:30:00+02:00"]) {
    const slots=windows(start,8);
    const ends=availableEnds(slots,start,30,180);
    expect(Date.parse(ends.at(-1)!) - Date.parse(start)).toBe(180*60000);
  }
});
it("respects a two-hour minimum and refuses an unavailable start", () => {
  const slots=windows("2099-10-01T18:00:00+04:00",8,120);
  expect(availableEnds(slots,slots[0].startsAt,30,180)).toHaveLength(3);
  slots[0].available=false;
  expect(availableEnds(slots,slots[0].startsAt,30,180)).toEqual([]);
});
