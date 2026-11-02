/** Exact destinations of Home's domain contributors. Jobs and notification allowlists are separate. */
export function homePendingDestination(value: string): string | null {
    // Ordinary cross-job work keeps its canonical record; private tools are deliberately absent.
    const operation = /^\/clubs\/([1-9]\d*)\/office\?tab=tools&tool=(?:staff-duties|facilities)&record=([1-9]\d*)(?:&squad=([1-9]\d*))?$/.exec(value);
    if (operation && operation.slice(1).filter(Boolean).every(id => Number.isSafeInteger(Number(id)))) return value;
    if (value === '/me/staff-club') return value;
    const calendar = /^\/calendar\?eventId=([1-9]\d*)$/.exec(value);
    if (calendar && Number.isSafeInteger(Number(calendar[1]))) return value;
    const helper = /^\/home\?(?:helper|projectHelper|helping|helpingSession)=([1-9]\d*)$/.exec(value);
    if (helper && Number.isSafeInteger(Number(helper[1]))) return value;
    const squad = /^\/squads\/([1-9]\d*)\?tab=players&invite=1$/.exec(value);
    if (squad && Number.isSafeInteger(Number(squad[1]))) return value;
    return null;
}
