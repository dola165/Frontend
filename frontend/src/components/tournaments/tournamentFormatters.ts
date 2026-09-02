import type {
    TournamentEntryStatus,
    TournamentFixtureStatus,
    TournamentParticipantScope,
    TournamentStageStatus,
    TournamentStageType,
    TournamentStatus,
    TournamentVisibility,
} from '../../features/tournaments/domain';

export const tournamentStatusLabel = (status: TournamentStatus, translate: (key: string) => string) =>
    translate(`tournaments.public.status.${status.toLowerCase()}`);

export const tournamentScopeText = (scope: TournamentParticipantScope, translate: (key: string) => string) =>
    translate(`tournaments.public.scope.${scope.toLowerCase()}`);

export const tournamentVisibilityText = (visibility: TournamentVisibility, translate: (key: string) => string) =>
    translate(`tournaments.public.visibility.${visibility.toLowerCase()}`);

export const tournamentPolicyText = (
    policy: 'OPEN' | 'APPROVAL_ONLY' | 'INVITE_ONLY' | null | undefined,
    translate: (key: string) => string,
) => translate(`tournaments.public.policy.${(policy ?? 'OPEN').toLowerCase()}`);

export const tournamentEntryStatusText = (status: TournamentEntryStatus, translate: (key: string) => string) =>
    translate(`tournaments.workspace.entryStatus.${status.toLowerCase()}`);

export const tournamentEntryTypeText = (type: string, translate: (key: string) => string) =>
    translate(`tournaments.workspace.entryType.${type.toLowerCase().replace(/\s+/g, '_')}`);

export const tournamentFixtureStatusText = (status: TournamentFixtureStatus, translate: (key: string) => string) =>
    translate(`tournaments.workspace.fixtureStatus.${status.toLowerCase()}`);

export const tournamentStageTypeText = (type: TournamentStageType, translate: (key: string) => string) =>
    translate(`tournaments.workspace.stageType.${type.toLowerCase()}`);

export const tournamentStageStatusText = (status: TournamentStageStatus, translate: (key: string) => string) =>
    translate(`tournaments.workspace.stageStatus.${status.toLowerCase()}`);

export const formatTournamentDate = (value: string | null | undefined, language = 'en') => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(language.startsWith('ka') ? 'ka-GE' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

export const formatTournamentDateRange = (
    start: string | null | undefined,
    end: string | null | undefined,
    language = 'en',
) => {
    const startLabel = formatTournamentDate(start, language);
    const endLabel = formatTournamentDate(end, language);
    if (!startLabel) return null;
    return endLabel ? `${startLabel} — ${endLabel}` : startLabel;
};
