import type { Availability } from '../../../venues/api';

/** A bookable slot as a chip: when it starts, on which pitch, for how much. */
export interface SlotChip { startsAt: string; endsAt: string; date: string; pitchId: number; price: number }

/** Minutes past midnight of an instant in the venue's time zone. */
function localMinutes(value: string, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
    return get('hour') * 60 + get('minute');
}
const minutesOf = (clock: string) => { const [hours, minutes] = clock.split(':').map(Number); return hours * 60 + (minutes || 0); };

/**
 * Free slots that start inside a time window (training evenings by default), soonest first, one per start time:
 * when several pitches are free at once, the first pitch stands for them. Past slots are left out. The caller
 * shows the first few and counts the rest.
 */
export function freeSlots(availability: Availability, { window = { from: '17:00', to: '21:00' }, keep = () => true, now = Date.now() }: {
    window?: { from: string; to: string }; /** Pitches that suit the squad. */ keep?: (pitchId: number) => boolean; now?: number;
} = {}): SlotChip[] {
    const from = minutesOf(window.from), to = minutesOf(window.to), seen = new Set<string>();
    const chips: SlotChip[] = [];
    for (const day of availability.days) for (const pitch of day.pitches.filter(pitch => keep(pitch.pitchId))) for (const slot of pitch.slots) {
        if (!slot.available || Date.parse(slot.startsAt) <= now || seen.has(slot.startsAt)) continue;
        const start = localMinutes(slot.startsAt, availability.timezone);
        if (start < from || start > to) continue;
        seen.add(slot.startsAt);
        chips.push({ startsAt: slot.startsAt, endsAt: slot.endsAt, date: day.date, pitchId: pitch.pitchId, price: slot.price });
    }
    return chips.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** The venue page with the slot chosen, as its booking calendar restores it. */
export const slotLink = (venueId: number, slot: SlotChip) =>
    `/stadiums/${venueId}?${new URLSearchParams({ date: slot.date, pitch: String(slot.pitchId), start: slot.startsAt, end: slot.endsAt })}`;
