import type { Venue } from "./api";

export const canBookVenue = (venue: Venue) => venue.published && !venue.promotionBlocked && venue.capabilities?.enabledActivities.includes('VENUE') === true && venue.pitches.some(p => p.active);

export const money = (value: number, currency = "GEL") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 ? 2 : 0,
  }).format(value);
export const today = (timezone = "Asia/Tbilisi") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const addDays = (date: string, count: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
};
export const dayLabel = (date: string, style: "short" | "long" = "short") =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: style,
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
export const timeLabel = (value: string, timezone: string) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
export const bookingDate = (value: string, timezone?: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    hour12: false,
  });
export const fromPrice = (venue: Venue) => {
  const pitches = venue.pitches.filter((pitch) => pitch.active);
  return pitches.length
    ? Math.min(...pitches.map((pitch) => pitch.pricePerHour))
    : null;
};
export const safeWebsite = (value: string | null) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};
/** Interpret an owner's wall-clock entry in the venue's timezone, not the browser's. */
export const zonedInstant = (date: string, time: string, timezone: string) => {
  const desired = Date.parse(`${date}T${time}:00Z`);
  let instant = desired;
  for (let index = 0; index < 3; index++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const observed = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
    );
    const correction = desired - observed;
    instant += correction;
    if (!correction) return new Date(instant).toISOString();
  }
  throw new Error(
    "This time does not exist in the venue timezone. Choose another time.",
  );
};

export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export const bookingDuration = (
  requested: number,
  minimum: number,
  maximum: number,
  step: number,
) =>
  Math.max(
    minimum,
    Math.min(
      maximum,
      minimum + Math.floor((requested - minimum) / step) * step,
    ),
  );
