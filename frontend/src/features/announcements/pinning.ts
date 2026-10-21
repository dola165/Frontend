import type { SquadMessage } from '../squadCommunication/api';

const DAY = 86_400_000;
/** Announcements posted before expiry existed (or by a server that omits it) stay pinned this long. */
export const DEFAULT_PIN_DAYS = 7;

export type PinChoice = '1' | '3' | '7' | '14' | 'date';
export const PIN_CHOICES: { id: PinChoice; label: string }[] = [
    { id: '1', label: 'Tomorrow' }, { id: '3', label: '3 days' }, { id: '7', label: '1 week' }, { id: '14', label: '2 weeks' }, { id: 'date', label: 'Until a date' },
];

const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0, 0);
/** `YYYY-MM-DD` in local time, for date inputs. */
export const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** When a new announcement stops being pinned: the end of the chosen day, as an instant. */
export function expiryFor(choice: PinChoice, date: string, now = new Date()): Date | null {
    if (choice === 'date') {
        const [y, m, d] = date.split('-').map(Number);
        return y && m && d ? endOfDay(new Date(y, m - 1, d)) : null;
    }
    return endOfDay(new Date(now.getTime() + Number(choice) * DAY));
}

/** When an announcement stops being pinned. */
export function pinnedUntil(message: Pick<SquadMessage, 'expires_at' | 'created_at'>) {
    return message.expires_at ? new Date(message.expires_at) : new Date(Date.parse(message.created_at) + DEFAULT_PIN_DAYS * DAY);
}
export const isPinned = (message: Pick<SquadMessage, 'expires_at' | 'created_at' | 'kind'>, now = Date.now()) =>
    message.kind === 'ANNOUNCEMENT' && pinnedUntil(message).getTime() > now;

/** "today", "tomorrow" or "Fri 16 Oct". */
export function dayText(date: Date, now = new Date()) {
    const days = Math.round((endOfDay(date).getTime() - endOfDay(now).getTime()) / DAY);
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}
export const pinnedText = (message: Pick<SquadMessage, 'expires_at' | 'created_at' | 'kind'>, now = new Date()) =>
    isPinned(message, now.getTime()) ? `Pinned until ${dayText(pinnedUntil(message), now)}` : 'No longer pinned';
