import type { Squad } from '../matchExchange/api';
import type { TournamentDetail, TournamentEntryDto, TournamentInvitationInboxItem } from './domain';

/** Why a person cannot enter now, said in words beside the tournament. */
export type EntryReason = 'sign-in' | 'not-open' | 'closed' | 'invite-only';

/** The one thing a person can do about entering a tournament, by the backend's own rules. */
export type EntryGate =
    | { kind: 'workspace' }
    | { kind: 'entered'; entry: TournamentEntryDto; withdrawable: boolean }
    | { kind: 'answer'; invitation: TournamentInvitationInboxItem; /** The club's live entry, when it is in already (one entry per club). */ entered: TournamentEntryDto | null }
    | { kind: 'enter'; clubs: { id: number; name: string; squads: Squad[] }[]; full: boolean }
    | { kind: 'register'; full: boolean }
    | { kind: 'reason'; reason: EntryReason; date?: string | null }
    | { kind: 'checking' }
    | { kind: 'none' };

/** Entries that hold a place or wait for one; a club holds at most one of these per tournament. */
const LIVE = new Set(['PENDING', 'APPROVED', 'WAITLISTED', 'ACTIVE']);

export interface EntryGateInput {
    detail: Pick<TournamentDetail, 'status' | 'participantScope' | 'visibility' | 'registrationPolicy' | 'registrationOpensAt' | 'registrationClosesAt' | 'entryCap' | 'entries'>;
    signedIn: boolean; userId: number | null;
    /** The organiser's staff (admin or staff) run it from the workspace. */ canManage: boolean;
    /** The squads the person may arrange matches for (entering needs those rights); undefined while they load. */ squads: Squad[] | undefined;
    /** The person's pending invitation to this tournament, if any. */ invitation?: TournamentInvitationInboxItem | null;
    /** For a players' tournament: whether this person may register; undefined while it is checked. */ playerEligible?: boolean;
    /** Reads one of the tournament's wall times as an instant (the backend sends them without a zone). */ time: (value?: string | null) => number | null;
    now?: number;
}

/**
 * What a person can do about entering, in the backend's order: the organiser's staff open the workspace; an entry of
 * theirs (their club's, whatever the squad, or their own as a player) shows how it stands; nothing more once the
 * tournament has started; an invitation is answered; then the entry window, invitation-only tournaments, and finally
 * Enter (by the squads they may arrange for) or Register. A full tournament never refuses: the entry joins the waiting
 * list. Gender and age are never checked here (the backend checks age from the roster), so fitting is only a hint.
 */
export function entryGate({ detail, signedIn, userId, canManage, squads, invitation, playerEligible, time, now = Date.now() }: EntryGateInput): EntryGate {
    if (canManage) return { kind: 'workspace' };
    const live = detail.entries.filter(entry => LIVE.has(entry.status));
    const clubs = new Set((squads ?? []).map(squad => squad.club_id));
    const own = live.find(entry => (userId != null && entry.userId === userId) || (entry.clubId != null && clubs.has(entry.clubId)));
    if (own) return { kind: 'entered', entry: own, withdrawable: detail.status === 'PLANNING' };
    if (detail.status !== 'PLANNING') return { kind: 'none' };
    if (invitation) return { kind: 'answer', invitation, entered: live.find(entry => entry.clubId != null && entry.clubId === invitation.clubId) ?? null };
    if (!signedIn) return { kind: 'reason', reason: 'sign-in' };
    const opens = time(detail.registrationOpensAt), closes = time(detail.registrationClosesAt);
    if (opens != null && opens > now) return { kind: 'reason', reason: 'not-open', date: detail.registrationOpensAt };
    if (closes != null && closes <= now) return { kind: 'reason', reason: 'closed', date: detail.registrationClosesAt };
    if (detail.registrationPolicy === 'INVITE_ONLY' || detail.visibility === 'PRIVATE') return { kind: 'reason', reason: 'invite-only' };
    const full = Boolean(detail.entryCap) && live.filter(entry => entry.status === 'APPROVED' || entry.status === 'ACTIVE').length >= detail.entryCap!;
    if (detail.participantScope === 'PLAYER') return playerEligible === undefined ? { kind: 'checking' } : playerEligible ? { kind: 'register', full } : { kind: 'none' };
    if (squads === undefined) return { kind: 'checking' };
    const byClub = new Map<number, { id: number; name: string; squads: Squad[] }>();
    for (const squad of squads) {
        const club = byClub.get(squad.club_id) ?? { id: squad.club_id, name: squad.club_name, squads: [] };
        club.squads.push(squad);
        byClub.set(squad.club_id, club);
    }
    return byClub.size ? { kind: 'enter', clubs: [...byClub.values()], full } : { kind: 'none' };
}
