import { describe, expect, it } from 'vitest';
import type { TournamentEntryDto, TournamentInvitationInboxItem } from './domain';
import { entryGate, instantEntry, type EntryGateInput } from './entryGates';

const NOW = Date.parse('2026-10-12T12:00:00+04:00');
const time = (value?: string | null) => (value ? Date.parse(`${value}+04:00`) : null);
const entry = (id: number, clubId: number | null, status: TournamentEntryDto['status'], extra: Partial<TournamentEntryDto> = {}): TournamentEntryDto => ({
    id, clubId, clubName: clubId ? `Club ${clubId}` : null, squadId: null, squadName: null, userId: null, displayName: null, status, seed: null,
    requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: null, withdrawnAt: null, withdrawalReason: null, ...extra,
});
const squad = (id: number, clubId: number) => ({ id, club_id: clubId, name: `U${id}`, category: 'U14', club_name: `Club ${clubId}` });
const base = (over: Partial<EntryGateInput['detail']> = {}, input: Partial<EntryGateInput> = {}): EntryGateInput => ({
    detail: { status: 'PLANNING', participantScope: 'CLUB', visibility: 'PUBLIC', registrationPolicy: 'OPEN', registrationOpensAt: '2026-09-01T00:00:00', registrationClosesAt: '2026-10-20T00:00:00', entryCap: 4, entries: [], ...over },
    signedIn: true, userId: 7, canManage: false, squads: [squad(14, 1)], time, now: NOW, ...input,
});
const invitation: TournamentInvitationInboxItem = { invitationId: 9, tournamentId: 3, tournamentName: 'Cup', tournamentStatus: 'PLANNING', visibility: 'PUBLIC', participantScope: 'CLUB', clubId: 1, clubName: 'Club 1', squadId: null, squadName: null, status: 'PENDING' };

describe('who may enter a tournament', () => {
    it('sends the organiser’s staff to the workspace before anything else', () => {
        expect(entryGate(base({}, { canManage: true })).kind).toBe('workspace');
    });

    it('shows the club’s one live entry, whatever the squad, and lets it be withdrawn while the tournament is being planned', () => {
        expect(entryGate(base({ entries: [entry(1, 1, 'WAITLISTED', { squadId: 14 })] }))).toMatchObject({ kind: 'entered', entry: { id: 1 }, withdrawable: true });
        // Another squad of the club, which someone else arranges for: shown, but not withdrawn from here.
        expect(entryGate(base({ entries: [entry(1, 1, 'WAITLISTED', { squadId: 99 })] }))).toMatchObject({ kind: 'entered', withdrawable: false });
        expect(entryGate(base({ entries: [entry(1, 1, 'WITHDRAWN')] })).kind).toBe('enter');
    });

    it('answers an invitation before the window or the policy, saying when the club is already in', () => {
        expect(entryGate(base({ registrationPolicy: 'INVITE_ONLY' }, { invitation })).kind).toBe('answer');
        expect(entryGate(base({ entries: [entry(4, 1, 'ACTIVE')] }, { invitation }))).toMatchObject({ kind: 'answer', entered: { id: 4 } });
    });

    it('says why entering is not possible: signed out, not open yet, closed, by invitation only', () => {
        expect(entryGate(base({}, { signedIn: false }))).toMatchObject({ kind: 'reason', reason: 'sign-in' });
        expect(entryGate(base({ registrationOpensAt: '2026-11-02T09:00:00' }))).toMatchObject({ kind: 'reason', reason: 'not-open', date: '2026-11-02T09:00:00' });
        expect(entryGate(base({ registrationClosesAt: '2026-10-12T00:00:00' }))).toMatchObject({ kind: 'reason', reason: 'closed' });
        expect(entryGate(base({ registrationPolicy: 'INVITE_ONLY' }))).toMatchObject({ kind: 'reason', reason: 'invite-only' });
    });

    it('never refuses a full tournament: the entry joins the waiting list', () => {
        const full = [1, 2, 3, 4].map(id => entry(id, 10 + id, 'ACTIVE'));
        expect(entryGate(base({ entries: full }))).toMatchObject({ kind: 'enter', full: true });
        expect(entryGate(base({ entries: full.slice(1) }))).toMatchObject({ kind: 'enter', full: false });
        // Pending entries hold places too, as the backend counts them.
        expect(entryGate(base({ entries: [1, 2, 3, 4].map(id => entry(id, 10 + id, 'PENDING')) }))).toMatchObject({ kind: 'enter', full: true });
        expect(entryGate(base({ entries: full }, { invitation }))).toMatchObject({ kind: 'answer', full: true });
    });

    it('waits for the squads and the player check rather than saying no', () => {
        expect(entryGate(base({}, { squads: undefined })).kind).toBe('checking');
        expect(entryGate(base({ participantScope: 'PLAYER' }, { playerEligible: undefined })).kind).toBe('checking');
        expect(entryGate(base({ participantScope: 'PLAYER' }, { playerEligible: true }))).toMatchObject({ kind: 'register' });
        expect(entryGate(base({}, { squads: [] })).kind).toBe('none');
    });

    it('says an entry is in at once only where the backend takes it at once', () => {
        const rules = { eligibilityCategory: 'Open' };
        expect(instantEntry({ registrationPolicy: 'OPEN', participantScope: 'SQUAD' }, rules)).toBe(true);
        expect(instantEntry({ registrationPolicy: 'OPEN', participantScope: 'CLUB' }, rules)).toBe(false);
        expect(instantEntry({ registrationPolicy: 'OPEN', participantScope: 'SQUAD' }, { eligibilityCategory: 'Girls' })).toBe(false);
        expect(instantEntry({ registrationPolicy: 'OPEN', participantScope: 'CLUB' }, null)).toBe(true);
        expect(instantEntry({ registrationPolicy: 'INVITE_ONLY', participantScope: 'SQUAD' }, rules)).toBe(false);
    });

    it('offers nothing once the tournament has started, beyond showing an entry', () => {
        expect(entryGate(base({ status: 'ACTIVE' })).kind).toBe('none');
        expect(entryGate(base({ status: 'ACTIVE', entries: [entry(1, 1, 'ACTIVE')] }))).toMatchObject({ kind: 'entered', withdrawable: false });
    });
});
