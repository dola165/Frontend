import type { BadgeTone } from '../../../../design/primitives';
import { getCompetitionProfile, type CompetitionCard, type CompetitionRules } from '../../../competitions/api';
import { fetchMyTournamentInvitations, fetchTournament } from '../../../tournaments/api';
import type { AuthSessionId } from '../../../../utils/authStorage';
import type { TournamentDetail, TournamentInvitationInboxItem, TournamentStatus, TournamentSummary } from '../../../tournaments/domain';
import { shared } from '../../cache';
import { wt } from '../../copy';
import { calendarDaysUntil, codeLabel, SCOPE_LABEL, shortDate } from '../../format';
import { competitionTimestamp as zoned } from '../../../competitions/competitionTime';
import { sideIsMine, type MyTeams } from '../../scoreboard/myTeams';
import { appLocale } from '../../../../utils/formatting';

/** Where entries stand when the list asked for it (a list of tournaments open for entries). */
export type EntriesState = 'OPEN' | 'NOT_OPEN' | 'CLOSED';

/**
 * A tournament as World's lists show it, from whichever answer brought it: a list card (`/competitions`), a summary
 * (`/competitions/mine`, the overview) or an invitation, with what is known about the person's part in it. Every time
 * is a wall time read through `zoned`. Fields an answer does not carry stay undefined and are never guessed.
 */
export interface TournamentItem {
    id: number; name: string; status: TournamentStatus; scope: string;
    start: string | null; end: string | null;
    organizer: string | null; banner: string | null;
    rules: CompetitionRules | null;
    entryCount: number | null; entryCap: number | null;
    /** The entry window: a summary carries it, a list card does not. */ opensAt?: string | null; closesAt?: string | null;
    entries?: EntriesState;
    invitation?: TournamentInvitationInboxItem;
    /** My squads entered (by name) and how each entry stands. */ mine?: { name: string; status: string }[];
    /** The person runs it (admin or staff), or referees in it. */ role?: 'running' | 'refereeing';
    /** Teams enter only when the organiser invites them. */ inviteOnly?: boolean;
    /** What waits for the person who runs it, in its workspace. */ work?: OrganiserWork[];
    champion?: string | null;
}

export const fromCard = (card: CompetitionCard, entries?: EntriesState): TournamentItem => ({
    id: card.id, name: card.name, status: card.status, scope: card.participantScope, start: zoned(card.startDate, card.profile?.rules?.timezone), end: zoned(card.endDate, card.profile?.rules?.timezone),
    organizer: card.hostClubName || card.organizerName, banner: card.bannerImageUrl, rules: card.profile?.rules ?? null,
    entryCount: card.entryCount, entryCap: card.entryCap, entries,
});

export const fromSummary = (summary: TournamentSummary, rules: CompetitionRules | null): TournamentItem => ({
    id: summary.id, name: summary.name, status: summary.status, scope: summary.participantScope, start: zoned(summary.startDate, rules?.timezone), end: zoned(summary.endDate, rules?.timezone),
    organizer: summary.hostClubName || summary.organizerName || null, banner: summary.bannerImageUrl ?? null, rules,
    entryCount: summary.entryCount, entryCap: null, opensAt: zoned(summary.registrationOpensAt, rules?.timezone), closesAt: zoned(summary.registrationClosesAt, rules?.timezone),
});

export const fromInvitation = (invitation: TournamentInvitationInboxItem, rules: CompetitionRules | null): TournamentItem => ({
    id: invitation.tournamentId, name: invitation.tournamentName, status: invitation.tournamentStatus, scope: invitation.participantScope,
    start: zoned(invitation.startDate, rules?.timezone), end: null, organizer: null, banner: null, rules, entryCount: null, entryCap: null, invitation,
});

/** A tournament's published rules (format, age, fee), shared for a minute; null for a legacy tournament or on failure. */
export const rulesOf = (id: number) => shared(`tournament-rules:${id}`, () => getCompetitionProfile(id)).then(profile => profile.rules, () => null);
/** The tournament's detail, shared with every drawer and field that reads it. */
export const detailOf = (id: number) => shared(`tournament:${id}`, () => fetchTournament(id));

/** One kind of organiser work waiting in the workspace (decision 16): its view there, and how many. */
export interface OrganiserWork { view: 'participants' | 'schedule'; label: string; count: number }

/** What waits for a tournament's staff: entries to decide, and results of matches already played to add. */
export function organiserWork(detail: Pick<TournamentDetail, 'entries' | 'fixtures' | 'status'>, now = Date.now(), zone?: string): OrganiserWork[] {
    const entries = detail.entries.filter(entry => entry.status === 'PENDING').length;
    const results = detail.fixtures.filter(fixture => fixture.status === 'SCHEDULED' && fixture.homeEntryId != null && fixture.awayEntryId != null
        && fixture.scheduledAt != null && Date.parse(zoned(fixture.scheduledAt, zone)!) < now).length;
    // A tournament still being planned with nobody in it waits for its first invitations.
    const empty = detail.status === 'PLANNING' && !detail.entries.some(entry => !['WITHDRAWN', 'REJECTED'].includes(entry.status));
    return [
        ...(empty ? [{ view: 'participants' as const, label: 'Invite teams', count: 0 }] : []),
        ...(entries ? [{ view: 'participants' as const, label: entries === 1 ? '1 entry to decide' : '{count} entries to decide', count: entries }] : []),
        ...(results ? [{ view: 'schedule' as const, label: results === 1 ? '1 result to add' : '{count} results to add', count: results }] : []),
    ];
}

/** Invitations still to answer, shared for a minute by the lists, the tab's count and the tournament's pane. */
export const tournamentInvitations = (sessionId: AuthSessionId) => shared(`tournament-invitations:${sessionId}`, () => fetchMyTournamentInvitations(0, 20))
    .then(page => page.content.filter(item => item.status === 'PENDING'));

/** My part in a tournament, from its detail: my squads' entries, whether I run or referee it, its places and champion. */
export async function withPart(item: TournamentItem, userId: number | null | undefined, teams: MyTeams): Promise<TournamentItem> {
    const detail = await detailOf(item.id).catch(() => null);
    if (!detail) return item;
    const staff = detail.staffAssignments.filter(assignment => userId != null && assignment.userId === userId && assignment.status === 'ACTIVE');
    const role = staff.some(assignment => assignment.role === 'ADMIN' || assignment.role === 'STAFF') ? 'running' as const : staff.some(assignment => assignment.role === 'REFEREE') ? 'refereeing' as const : undefined;
    // My squads' entries, and my club's own (another squad of my club, or the club as a whole).
    const mine = detail.entries.filter(entry => !['WITHDRAWN', 'REJECTED'].includes(entry.status) && (sideIsMine(entry, teams) || (entry.clubId != null && teams.clubIds.has(entry.clubId)) || (userId != null && entry.userId === userId)))
        .map(entry => ({ name: (entry.squadId != null ? teams.names.get(entry.squadId) : null) ?? entry.squadName ?? entry.clubName ?? entry.displayName ?? wt('Your team'), status: entry.status }));
    return {
        // The champion by its club (the backend's name for it is "Squad (Club)").
        ...item, role, mine, work: role === 'running' ? organiserWork(detail, Date.now(), item.rules?.timezone) : undefined, champion: detail.entries.find(entry => entry.id === detail.championEntryId)?.clubName ?? detail.championName ?? null, entryCap: detail.entryCap ?? item.entryCap,
        // Places taken as the list card counts them (approved and active entries, and those that played on or went out),
        // always from the detail: a summary counts only approved and active ones, so a finished cup would say 0.
        inviteOnly: detail.registrationPolicy === 'INVITE_ONLY',
        entryCount: detail.entries.filter(entry => ['APPROVED', 'ACTIVE', 'COMPLETED', 'ELIMINATED'].includes(entry.status)).length,
        organizer: item.organizer ?? detail.hostClubName ?? detail.organizerName ?? null, banner: item.banner ?? detail.bannerImageUrl ?? null,
        end: item.end ?? zoned(detail.endDate, item.rules?.timezone), opensAt: item.opensAt ?? zoned(detail.registrationOpensAt, item.rules?.timezone), closesAt: item.closesAt ?? zoned(detail.registrationClosesAt, item.rules?.timezone),
    };
}

/** "150 GEL a team", "20 GEL a player", "Free": the entry fee as the rules publish it. */
export function feeLabel(rules: CompetitionRules | null) {
    if (!rules) return null;
    if (!rules.entryFee) return wt('Free');
    const amount = `${rules.entryFee.toLocaleString(appLocale())} ${rules.currency}`;
    return rules.feeBasis === 'TEAM' ? wt('{amount} a team', { amount }) : rules.feeBasis === 'PLAYER' ? wt('{amount} a player', { amount }) : amount;
}

/** "6 of 8 places", "6 entered", or nothing before anyone enters a tournament without a cap. */
export const placesLabel = (item: TournamentItem) => item.entryCap ? wt('{count} of {cap} places', { count: item.entryCount ?? 0, cap: item.entryCap })
    : item.entryCount ? wt('{count} entered', { count: item.entryCount }) : null;

/** What a tournament is, in a few words: age (and who it is for), players per side, who enters. */
export function whatLabel(item: TournamentItem) {
    const rules = item.rules, category = rules?.eligibilityCategory?.trim();
    const age = rules ? [codeLabel(rules.ageGroup), category && category !== 'Open' && category.length <= 16 ? wt(category) : null].filter(Boolean).join(' ') : null;
    return [age, rules ? `${rules.sideSize}v${rules.sideSize}` : null, SCOPE_LABEL[item.scope] ? wt(SCOPE_LABEL[item.scope]) : null].filter(Boolean);
}

/** The last day entries are taken: a window closing at midnight belongs to the day before. */
const lastDay = (closesAt: string) => new Date(Date.parse(closesAt) - 60_000).toISOString();
/** The last day to enter, in words ("23 Oct"), from the closing time (a wall time); null when there is none. */
export const lastEntryDay = (closesAt?: string | null, zone?: string) => { const at = zoned(closesAt, zone); return at ? shortDate(lastDay(at), zone) : null; };

/**
 * The one fact a tournament's row shows, by what matters most: an invitation to answer, my squads in it, then where
 * entries stand or how far it has got. A fact needing a field this answer lacks (the entry window on a list card) is
 * left out, never guessed.
 */
export function tournamentFact(item: TournamentItem): { label: string; tone: BadgeTone } {
    if (item.invitation) return { label: wt('Answer'), tone: 'warning' };
    const work = item.work?.[0];
    if (work) return { label: wt(work.label, { count: work.count }), tone: 'warning' };
    const live = item.mine?.filter(entry => !['ELIMINATED'].includes(entry.status)) ?? [];
    if (item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && live.length) {
        const first = live[0], more = live.length > 1 ? ` +${live.length - 1}` : '';
        if (first.status === 'PENDING') return { label: wt('{team}: waiting for the organiser', { team: first.name }), tone: 'warning' };
        if (first.status === 'WAITLISTED') return { label: wt('{team}: on the waiting list', { team: first.name }), tone: 'warning' };
        return { label: wt('{team} in', { team: `${first.name}${more}` }), tone: 'accent' };
    }
    if (item.status === 'ACTIVE') return { label: wt('On now'), tone: 'accent' };
    if (item.status === 'COMPLETED') return item.champion ? { label: wt('Won by {team}', { team: item.champion }), tone: 'neutral' } : { label: wt('Finished'), tone: 'neutral' };
    if (item.status === 'CANCELLED') return { label: wt('Cancelled'), tone: 'danger' };
    if (item.entryCap && (item.entryCount ?? 0) >= item.entryCap) return { label: wt('Full · waiting list'), tone: 'neutral' };
    if (item.opensAt && Date.parse(item.opensAt) > Date.now()) return { label: wt('Opens {date}', { date: shortDate(item.opensAt, item.rules?.timezone) ?? '' }), tone: 'violet' };
    if (item.closesAt) {
        const left = calendarDaysUntil(lastDay(item.closesAt), item.rules?.timezone);
        if (left != null && left < 0) return { label: wt('Entries closed'), tone: 'neutral' };
        if (left != null) return { label: wt('Last day {date}', { date: shortDate(lastDay(item.closesAt), item.rules?.timezone) ?? '' }), tone: left <= 7 ? 'warning' : 'violet' };
    }
    if (item.inviteOnly) return { label: wt('By invitation'), tone: 'neutral' };
    if (item.entries === 'OPEN') return { label: wt('Open for entries'), tone: 'accent' };
    if (item.entries === 'NOT_OPEN') return { label: wt('Opening soon'), tone: 'violet' };
    if (item.entries === 'CLOSED') return { label: wt('Entries closed'), tone: 'neutral' };
    return { label: wt('Coming up'), tone: 'violet' };
}
