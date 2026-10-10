import { ages, formats, type Match, type Squad } from '../api';
import type { PublicSquad } from '../../clubs/publicJourney';
import type { Arrangement, Ground, MatchTerms, OfficialMode } from './api';

/** Where the match is played. Hosting follows from it, so the form never asks twice. */
export type GroundChoice =
    | { kind: 'OURS'; ground: Ground } | { kind: 'THEIRS'; ground: Ground } | { kind: 'OTHER'; ground: Ground | null }
    | { kind: 'PIN'; name: string; city: string; latitude: string; longitude: string }
    | { kind: 'TRAVEL'; city: string } | { kind: 'LATER'; city: string };
export type RefereeChoice = 'US' | 'THEM' | 'EXTERNAL' | 'NONE';
export interface Opponent { id: number; name: string; logoUrl?: string | null; city?: string | null }
export interface Draft {
    opponent: Opponent | null; targetSquadId: number; squadId: number;
    date: string; time: string; minutes: number | null; format: string | null;
    ground: GroundChoice; referee: RefereeChoice; refereeName: string;
    /** The person picked the ground themselves; until then the club's own ground is the starting choice. */
    groundTouched?: boolean;
    note: string; title: string; matchType: 'FRIENDLY' | 'COMPETITIVE'; level: string; timezone: string; requestId: string;
}
export type Mode = 'direct' | 'open' | 'edit';

// ---------------------------------------------------------------- formats and match length
/** Youth formats by age group: playing format, minutes per half and half-time. */
const PLAN: { upTo: number; format: string; half: number; rest: number }[] = [
    { upTo: 8, format: '5_A_SIDE', half: 20, rest: 10 }, { upTo: 10, format: '7_A_SIDE', half: 25, rest: 10 },
    { upTo: 12, format: '7_A_SIDE', half: 30, rest: 10 }, { upTo: 14, format: '9_A_SIDE', half: 35, rest: 10 },
    { upTo: 16, format: '11_A_SIDE', half: 40, rest: 15 }, { upTo: 99, format: '11_A_SIDE', half: 45, rest: 15 },
];
const ageNumber = (ageGroup: string) => /^U(\d+)$/.test(ageGroup) ? Number(ageGroup.slice(1)) : 99;
const planFor = (ageGroup: string) => PLAN.find(row => ageNumber(ageGroup) <= row.upTo)!;
export const ageGroupOf = (category?: string | null) => category && ages.includes(category.toUpperCase()) ? category.toUpperCase() : 'SENIOR';
export const defaultFormat = (ageGroup: string) => planFor(ageGroup).format;
export const defaultMinutes = (ageGroup: string) => { const row = planFor(ageGroup); return row.half * 2 + row.rest; };
export const halvesLabel = (ageGroup: string) => { const row = planFor(ageGroup); return `2 × ${row.half} minutes and a ${row.rest}-minute break`; };
export const formatLabel = (format: string) => formats[format] ?? format;
export const LENGTHS = [40, 50, 60, 70, 80, 90, 95, 105, 120];

// ---------------------------------------------------------------- wall-clock time
const pad = (n: number) => String(n).padStart(2, '0');
/** Adds minutes to a local `YYYY-MM-DDTHH:mm` stamp without any time zone conversion. */
export function addMinutes(stamp: string, minutes: number) {
    const d = new Date(`${stamp}:00Z`);
    d.setUTCMinutes(d.getUTCMinutes() + minutes);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
/** The wall-clock stamp of an instant in a time zone. */
export function localStamp(instant: string | Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export const validZone = (zone: string) => { try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; } catch { return false; } };
/** The next two weekends' match days, as quick choices: Saturday, Sunday, then the following Saturday. */
export function weekendDays(today: string) {
    const base = new Date(`${today}T12:00:00Z`);
    const out: string[] = [];
    for (let offset = 1; offset <= 14 && out.length < 3; offset++) {
        const d = new Date(base.getTime() + offset * 86400000);
        if (d.getUTCDay() === 6 || (d.getUTCDay() === 0 && out.length === 1)) out.push(d.toISOString().slice(0, 10));
    }
    return out;
}
export const dayLabel = (date: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const weekday = (date: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

// ---------------------------------------------------------------- prefill
const genderWord = (name: string, gender?: string | null) => gender === 'MALE' || /\bboys?\b|\bmen\b/i.test(name) ? 'MALE' : gender === 'FEMALE' || /\bgirls?\b|\bwomen\b/i.test(name) ? 'FEMALE' : 'MIXED';
/** Our squad when the choice is obvious: the only one of that age (and gender), preferring the squads I coach. */
export function suggestOurSquad(ours: Squad[], coached: number[], theirs?: PublicSquad | null): number {
    if (ours.length === 1) return ours[0].id;
    let pool = theirs ? ours.filter(s => ageGroupOf(s.category) === ageGroupOf(theirs.category)) : ours.filter(s => coached.includes(s.id));
    if (theirs && pool.length > 1) {
        const gender = genderWord(theirs.name, theirs.gender);
        const sameGender = gender === 'MIXED' ? [] : pool.filter(s => genderWord(s.name) === gender);
        if (sameGender.length) pool = sameGender;
        if (pool.length > 1 && pool.some(s => coached.includes(s.id))) pool = pool.filter(s => coached.includes(s.id));
    }
    return pool.length === 1 ? pool[0].id : 0;
}
/** Their squad when the choice is obvious: the only one in our squad's age group (and gender). */
export function suggestTheirSquad(theirs: PublicSquad[], ours?: Squad | null): number {
    if (!ours) return theirs.length === 1 ? theirs[0].id : 0;
    let pool = theirs.filter(s => ageGroupOf(s.category) === ageGroupOf(ours.category));
    if (pool.length > 1) {
        // Same gender first; a boys' or girls' squad can also play a mixed one, never the other way round.
        const gender = genderWord(ours.name);
        const exact = pool.filter(s => genderWord(s.name, s.gender) === gender);
        const compatible = gender === 'MIXED' ? pool : pool.filter(s => genderWord(s.name, s.gender) !== (gender === 'MALE' ? 'FEMALE' : 'MALE'));
        pool = exact.length ? exact : compatible;
    }
    return pool.length === 1 ? pool[0].id : 0;
}

// ---------------------------------------------------------------- terms
const hosting = (ground: GroundChoice): Arrangement['hostingChoice'] =>
    ground.kind === 'OURS' ? 'HOME' : ground.kind === 'THEIRS' || ground.kind === 'TRAVEL' ? 'AWAY' : ground.kind === 'LATER' ? 'FLEXIBLE' : 'NEUTRAL';
export function automaticTitle(draft: Draft, squad: Squad | undefined, mode: Mode) {
    const kind = draft.matchType === 'COMPETITIVE' ? 'match' : 'friendly';
    if (!squad) return '';
    if (mode === 'open') return `${squad.name} looking for a ${draft.date ? `${weekday(draft.date)} ` : ''}${kind}`;
    return draft.opponent ? `${squad.name} v ${draft.opponent.name}` : `${squad.name} ${kind}`;
}
export function groundLocation(ground: GroundChoice) {
    if (ground.kind === 'OURS' || ground.kind === 'THEIRS' || ground.kind === 'OTHER') {
        const venue = ground.ground;
        return { venueId: venue?.venueId ?? null, locationName: venue?.name ?? '', city: venue?.city ?? '', latitude: venue?.latitude ?? null, longitude: venue?.longitude ?? null };
    }
    if (ground.kind === 'PIN') return { venueId: null, locationName: ground.name.trim(), city: ground.city.trim(), latitude: ground.latitude ? Number(ground.latitude) : null, longitude: ground.longitude ? Number(ground.longitude) : null };
    return { venueId: null, locationName: ground.kind === 'TRAVEL' ? 'At the opponent’s ground' : 'Ground to be arranged', city: ground.city.trim(), latitude: null, longitude: null };
}
export function buildTerms(draft: Draft, squad: Squad, mode: Mode, revision = 0): MatchTerms {
    const ageGroup = ageGroupOf(squad.category);
    const startsAt = `${draft.date}T${draft.time}`;
    const choice = hosting(draft.ground);
    return {
        squadId: squad.id, title: (draft.title.trim() || automaticTitle(draft, squad, mode)).slice(0, 140), description: draft.note.trim(),
        startsAt, endsAt: addMinutes(startsAt, draft.minutes ?? defaultMinutes(ageGroup)), timezone: draft.timezone,
        ...groundLocation(draft.ground), ageGroup, level: draft.level, format: draft.format ?? defaultFormat(ageGroup),
        venuePreference: choice === 'HOME' || choice === 'AWAY' ? choice : 'EITHER', refereeRequired: draft.referee !== 'NONE',
        requestId: draft.requestId, revision,
    };
}
export function buildArrangement(draft: Draft, squad: Squad, mode: Mode): Arrangement {
    const officialMode: OfficialMode = draft.referee === 'NONE' ? 'NONE' : draft.referee === 'EXTERNAL' ? 'EXTERNAL' : 'LATER';
    return {
        match: buildTerms(draft, squad, mode), targetClubId: mode === 'direct' ? draft.opponent?.id ?? null : null, targetSquadId: mode === 'direct' && draft.targetSquadId ? draft.targetSquadId : null,
        bookingId: null, matchType: draft.matchType, hostingChoice: hosting(draft.ground), officialMode,
        officialResponsibility: draft.referee === 'THEM' ? 'OPPONENT' : 'HOST', refereeId: null,
        externalRefereeName: officialMode === 'EXTERNAL' ? draft.refereeName.trim() : null, volunteer: true, fee: 0, currency: 'GEL',
    };
}

// ---------------------------------------------------------------- validation
export type Problems = Partial<Record<'opponent' | 'squad' | 'date' | 'time' | 'ground' | 'referee' | 'timezone', string>>;
export function problemsWith(draft: Draft, mode: Mode, now: Date): Problems {
    const out: Problems = {};
    if (mode === 'direct' && !draft.opponent) out.opponent = 'Search for the club you want to play.';
    if (!draft.squadId) out.squad = 'Choose the squad that will play.';
    if (!validZone(draft.timezone)) out.timezone = 'Choose a valid time zone, such as Asia/Tbilisi.';
    if (!draft.date) out.date = 'Choose the match day.';
    if (!draft.time) out.time = 'Choose the kick-off time.';
    else if (draft.date && !out.timezone && `${draft.date}T${draft.time}` <= localStamp(now, draft.timezone)) out.date = 'Kick-off must be in the future.';
    const g = draft.ground;
    if (g.kind === 'OTHER' && !g.ground) out.ground = 'Search for the venue, or choose another option.';
    // A ground recorded before pins existed may have only a name; editing keeps it without forcing a pin.
    else if (g.kind === 'PIN' && mode !== 'edit' && (!g.latitude || !g.longitude)) out.ground = 'Drop a pin on the ground, or choose another option.';
    else if (g.kind === 'PIN' && !g.name.trim()) out.ground = 'Name the ground so both teams can find it.';
    else if ((g.kind === 'PIN' || g.kind === 'LATER' || g.kind === 'TRAVEL') && !g.city.trim()) out.ground = 'Add the city where you plan to play.';
    if (draft.referee === 'EXTERNAL' && !draft.refereeName.trim()) out.referee = 'Name the referee you have arranged.';
    return out;
}

// ---------------------------------------------------------------- editing a published match
const minutesBetween = (start: string, end: string) => Math.round((new Date(`${end.slice(0, 16)}:00Z`).getTime() - new Date(`${start.slice(0, 16)}:00Z`).getTime()) / 60000);
/** The form's draft for a published match, read from its stored terms. */
export function draftFromMatch(m: Match): Draft {
    const ground: GroundChoice = m.venue_id
        ? { kind: 'OTHER', ground: { key: `venue:${m.venue_id}`, venueId: m.venue_id, name: m.location_name, city: m.city, detail: m.city, latitude: m.location_lat, longitude: m.location_lng } }
        : !m.location_name || /to be (arranged|agreed|confirmed)/i.test(m.location_name) ? { kind: 'LATER', city: m.city }
            : { kind: 'PIN', name: m.location_name, city: m.city, latitude: m.location_lat?.toString() ?? '', longitude: m.location_lng?.toString() ?? '' };
    const minutes = minutesBetween(m.starts_at, m.ends_at);
    return {
        opponent: m.opponent_club_id && m.opponent_name ? { id: m.opponent_club_id, name: m.opponent_name } : null, targetSquadId: m.target_squad_id ?? 0, squadId: m.squad_id,
        date: m.starts_at.slice(0, 10), time: m.starts_at.slice(11, 16), minutes: minutes > 0 ? minutes : null, format: m.format,
        ground, referee: m.referee_required ? 'US' : 'NONE', refereeName: '', note: m.description ?? '', title: m.title, matchType: 'FRIENDLY',
        level: m.level, timezone: m.timezone, requestId: crypto.randomUUID(),
    };
}
/** A venue that is one of our grounds or theirs is shown as that option, not as "another venue". */
export function placeGround(ground: GroundChoice, ours: Ground[], theirs: Ground[]): GroundChoice {
    if (ground.kind !== 'OTHER' || !ground.ground?.venueId) return ground;
    const id = ground.ground.venueId;
    const own = ours.find(g => g.venueId === id), their = theirs.find(g => g.venueId === id);
    return own ? { kind: 'OURS', ground: own } : their ? { kind: 'THEIRS', ground: their } : ground;
}
