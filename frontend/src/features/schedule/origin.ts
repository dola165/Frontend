/** Only server-projected origin chooses another event workflow; event identity stays intact. */
export function scheduleDestination(event: { eventId: number; origin?: string; originId?: number | null }) {
    return event.origin === 'MATCH_EXCHANGE' ? `/match-exchange/${event.eventId}` : null;
}
