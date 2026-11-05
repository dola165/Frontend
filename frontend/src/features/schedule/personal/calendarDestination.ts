const keep = ['eventId', 'newEvent', 'date', 'journey', 'journeyChild'];

/**
 * `/calendar` moved: your schedule lives on your profile, a squad's on its squad page and a club's
 * on the club profile. Every old link, notification and bookmark lands in the right place.
 */
export function calendarDestination(search: string) {
    const params = new URLSearchParams(search);
    const scope = params.get('scope'), squad = params.get('squadId'), club = params.get('clubId'), session = params.get('sessionId');
    if ((scope === 'squad' || scope === 'club') && squad && /^\d+$/.test(squad)) {
        const query = new URLSearchParams({ tab: 'sessions' });
        if (session && /^\d+$/.test(session)) query.set('sessionId', session);
        if (params.get('date')) query.set('at', params.get('date')!);
        return `/squads/${squad}?${query}`;
    }
    if (scope === 'squad' || scope === 'club') return club && /^\d+$/.test(club) ? `/clubs/${club}/office?tab=calendar` : '/my-squads?tab=calendar';
    if (club && /^\d+$/.test(club) && !params.has('eventId') && scope !== 'personal') return `/clubs/${club}/office?tab=calendar`;
    const query = new URLSearchParams({ tab: 'schedule' });
    for (const key of keep) { const value = params.get(key); if (value) query.set(key, value); }
    return `/profile/me?${query}`;
}
