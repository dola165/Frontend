/** Exact destinations of Home's domain contributors. Jobs and notification allowlists are separate. */
export function homePendingDestination(value: string): string | null {
    if (value === '/me/staff-club') return value;
    const calendar = /^\/calendar\?eventId=([1-9]\d*)$/.exec(value);
    if (calendar && Number.isSafeInteger(Number(calendar[1]))) return value;
    const helper = /^\/home\?(?:helper|projectHelper|helping|helpingSession)=([1-9]\d*)$/.exec(value);
    if (helper && Number.isSafeInteger(Number(helper[1]))) return value;
    const squad = /^\/squads\/([1-9]\d*)\?tab=players&invite=1$/.exec(value);
    if (squad && Number.isSafeInteger(Number(squad[1]))) return value;
    return null;
}
