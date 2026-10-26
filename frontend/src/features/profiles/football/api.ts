import { apiClient } from '../../../api/axiosConfig';

// ---- What the server sends (fnd-profile-b, `GET /users/{id}/football-profile`) ------------------------------------

/** The rule-checker's answer for one action on one line (fnd-access-b). */
export interface AccessVerdict { action: string; allowed: boolean; reason?: string | null; message?: string | null }

export type LineKind = 'OWNER' | 'ADMIN' | 'JOB' | 'COACH' | 'PLAYS_FOR' | 'MEMBER' | 'REFEREE' | 'FOLLOWS' | 'PARENT_OF';

/** One relationship that fills itself from a link or a job. Nobody ticks or types one. */
export interface ServerLine {
    line: string;
    kind: LineKind;
    title: string;
    /** Ready to show: "Head coach · U12 · Dinamo Tbilisi". */
    label: string;
    club?: { id: number; name: string; logoUrl?: string | null } | null;
    squads?: { id: number; name: string }[];
    clubWide?: boolean;
    /** Parent lines, own view only. */
    child?: { id: number; name: string } | null;
    since?: string | null;
    until?: string | null;
    appointmentId?: number | null;
    revision?: number | null;
    leaveAs?: 'STAFF' | 'PLAYER' | null;
    actions?: AccessVerdict[];
}

export interface PersonFootballProfile {
    userId: number;
    own: boolean;
    publicRole: { line: string; label: string; chosen: boolean } | null;
    roleChoices?: { line: string; label: string }[];
    revision?: number;
    whereYouAre?: ServerLine[];
    career?: { lines?: ServerLine[]; counts?: Partial<CareerTotals> };
}

export interface CareerTotals { sessionsCoached: number; matchesPlayed: number; matchesRefereed: number }

// ---- What the screens draw ----------------------------------------------------------------------------------------

/** Where a line or a career row happens: a club now, other homes later. */
export interface FootballHome { id: number; name: string; logoUrl?: string | null }

/** How "Leave" ends a line: a job ends as a job; anything else is the club's departure. */
export type LeaveRoute =
    | { kind: 'END_JOB'; clubId: number; appointmentId: number; revision: number }
    | { kind: 'DEPART'; clubId: number; as: 'STAFF' | 'PLAYER' };

/** One row of "Where you are". Other viewers never get a parent line, a child's lines, or the controls. */
export interface FootballLine {
    id: string;
    kind: LineKind;
    /** "Head coach · U12" (without the club, which the row shows under it). */
    title: string;
    label: string;
    home: FootballHome | null;
    child: { id: number; name: string } | null;
    since: string | null;
    /** The page where this line is worked on; own view only. */
    manage: string | null;
    leave: LeaveRoute | null;
}

/** One past stint, from the clubs' records. */
export interface CareerRow { id: string; kind: LineKind; title: string; home: FootballHome | null; startsOn: string | null; endsOn: string | null }

export interface FootballProfileData {
    own: boolean;
    lines: FootballLine[];
    /** Clubs the person follows, shown as crests (own view only). */
    follows: FootballHome[];
    publicRole: { id: string; label: string; chosen: boolean } | null;
    choices: { id: string; label: string; home: FootballHome | null }[];
    revision: number;
    career: CareerRow[];
    totals: CareerTotals;
}

const list = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];
const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0 ? value as number : 0;
const allowed = (line: ServerLine, action: string) => list(line.actions).some(verdict => verdict.action === action && verdict.allowed);
const COACHING = /coach/i;

/** The page that works on a line, when the rule-checker lets the person in. */
function manageOf(line: ServerLine): string | null {
    const club = line.club?.id;
    switch (line.kind) {
        case 'PARENT_OF': return line.child ? `/parent?player=${line.child.id}` : '/parent';
        case 'REFEREE': return '/referees/me';
        case 'PLAYS_FOR': { const squad = line.squads?.[0]?.id; return squad ? `/squads/${squad}` : null; }
        case 'JOB': case 'COACH':
            if (!allowed(line, 'manage_club')) return null;
            return COACHING.test(line.title) && (line.squads?.length ?? 0) > 0 ? '/my-squads' : club ? `/clubs/${club}/workspace` : null;
        case 'OWNER': case 'ADMIN': return club && allowed(line, 'manage_club') ? `/clubs/${club}/workspace` : null;
        default: return null;
    }
}

function leaveOf(line: ServerLine): LeaveRoute | null {
    const club = line.club?.id;
    if (!club) return null;
    if (line.kind === 'JOB' && allowed(line, 'end_job') && line.appointmentId && line.revision != null) return { kind: 'END_JOB', clubId: club, appointmentId: line.appointmentId, revision: line.revision };
    if (line.leaveAs && allowed(line, 'leave_club')) return { kind: 'DEPART', clubId: club, as: line.leaveAs };
    return null;
}

const homeOf = (line: ServerLine): FootballHome | null => line.club ? { id: line.club.id, name: line.club.name, logoUrl: line.club.logoUrl ?? null } : null;
const titleOf = (line: ServerLine) => [line.title, line.clubWide ? null : list(line.squads).map(squad => squad.name).join(', ') || null].filter(Boolean).join(' · ');

export function readFootball(value: PersonFootballProfile): FootballProfileData {
    const own = value.own === true;
    const current = list(value.whereYouAre).filter(line => own || line.kind !== 'PARENT_OF');
    const homes = new Map(current.map(line => [line.line, homeOf(line)]));
    return {
        own,
        lines: current.filter(line => line.kind !== 'FOLLOWS').map(line => ({
            id: line.line, kind: line.kind, title: titleOf(line), label: line.label, home: homeOf(line),
            child: own ? line.child ?? null : null, since: line.since ?? null,
            manage: own ? manageOf(line) : null, leave: own ? leaveOf(line) : null,
        })),
        follows: own ? current.filter(line => line.kind === 'FOLLOWS').map(homeOf).filter((home): home is FootballHome => home !== null) : [],
        publicRole: value.publicRole ? { id: value.publicRole.line, label: value.publicRole.label, chosen: value.publicRole.chosen === true } : null,
        choices: own ? list(value.roleChoices).map(choice => ({ id: choice.line, label: choice.label, home: homes.get(choice.line) ?? null })) : [],
        revision: value.revision ?? 0,
        career: list(value.career?.lines).filter(line => line.kind !== 'FOLLOWS' && line.kind !== 'PARENT_OF')
            .map(line => ({ id: line.line, kind: line.kind, title: titleOf(line), home: homeOf(line), startsOn: line.since ?? null, endsOn: line.until ?? null })),
        totals: { sessionsCoached: count(value.career?.counts?.sessionsCoached), matchesPlayed: count(value.career?.counts?.matchesPlayed), matchesRefereed: count(value.career?.counts?.matchesRefereed) },
    };
}

export const fetchFootball = async (userId: number | 'me', signal?: AbortSignal) =>
    readFootball((await apiClient.get<PersonFootballProfile>(`/users/${userId}/football-profile`, { signal })).data);

/** Shows one of the person's own lines under their name, or `null` to let GrassKickZ pick. */
export const savePublicRole = async (line: string | null, revision: number) =>
    readFootball((await apiClient.put<PersonFootballProfile>('/users/me/football-profile/public-role', { line, revision })).data);

interface Relationship { clubId: number; departureSnapshots?: Partial<Record<'STAFF' | 'PLAYER', string>> }

/** Leaves a line: a job ends as a job; a club membership through the club's departure with its current snapshot. */
export async function leaveLine(route: LeaveRoute) {
    if (route.kind === 'END_JOB') {
        await apiClient.post(`/clubs/${route.clubId}/people/jobs/${route.appointmentId}/end`, { revision: route.revision });
        return;
    }
    const rows = (await apiClient.get<Relationship[]>('/me/club-relationships')).data;
    const snapshot = rows.find(row => row.clubId === route.clubId)?.departureSnapshots?.[route.as];
    if (!snapshot) throw new Error('This changed a moment ago. Reload and try again.');
    await apiClient.post(`/clubs/${route.clubId}/relationships/${route.as}/leave`, { requestId: crypto.randomUUID(), snapshot });
}
