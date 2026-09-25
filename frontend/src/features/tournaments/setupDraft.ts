import type { TournamentParticipantScope, TournamentVisibility } from './domain';

export type TournamentFormState = {
    hostClubId: string;
    name: string;
    description: string;
    rules: string;
    participantScope: TournamentParticipantScope;
    visibility: TournamentVisibility;
    registrationOpensAt: string;
    registrationClosesAt: string;
    startDate: string;
    endDate: string;
};

export type TournamentSetupDraft = {
    accountId: number;
    organizerId: number | null;
    form: TournamentFormState;
};

// Keep the interrupted event in this navigation history, scoped to its account.
// A returned organization ID is only a selection hint; the server's current
// membership capabilities still decide whether it can be used.
export function readTournamentSetupDraft(state: unknown, accountId?: number): TournamentSetupDraft | null {
    if (!Number.isSafeInteger(accountId) || Number(accountId) <= 0) return null;
    if (!state || typeof state !== 'object' || !('tournamentSetupDraft' in state)) return null;
    const draft = state.tournamentSetupDraft;
    if (!draft || typeof draft !== 'object' || !('accountId' in draft) || draft.accountId !== accountId
        || !('organizerId' in draft) || (draft.organizerId !== null && (!Number.isSafeInteger(draft.organizerId) || Number(draft.organizerId) <= 0))
        || !('form' in draft) || !draft.form || typeof draft.form !== 'object') return null;
    const form = draft.form as Record<string, unknown>;
    if (!['hostClubId', 'name', 'description', 'rules', 'registrationOpensAt', 'registrationClosesAt', 'startDate', 'endDate']
        .every(key => typeof form[key] === 'string')
        || !['CLUB', 'SQUAD', 'PLAYER'].includes(String(form.participantScope))
        || !['PRIVATE', 'PUBLIC', 'UNLISTED'].includes(String(form.visibility))) return null;
    return draft as TournamentSetupDraft;
}

export function readOrganizerSelection(value: string | null): number | null {
    if (!value || !/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}
