import type { TournamentParticipantScope, TournamentVisibility } from './domain';
import {defaultRules,defaultPolicy,structures} from '../competitions/api';

export type TournamentFormState = {
    hostClubId: string;
    venueId?: string;
    bannerImageUrl?: string;
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
    competitionRules?: import('../competitions/api').CompetitionRules;
    eligibilityPolicy?: import('../competitions/api').EligibilityPolicy;
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
    if('competitionRules' in draft&&draft.competitionRules!==undefined){
        const rules=draft.competitionRules;
        if(!rules||typeof rules!=='object'||!('family' in rules)||!Object.hasOwn(structures,String(rules.family)))return null;
        const values=rules as Record<string,unknown>;
        if(!Object.entries(defaultRules()).every(([key,value])=>key==='ageCutoff'?values[key]===null||typeof values[key]==='string':Array.isArray(value)?Array.isArray(values[key])&&(values[key] as unknown[]).length>0&&(values[key] as unknown[]).every(v=>['POINTS','GOAL_DIFFERENCE','GOALS_FOR','WINS','BUCHHOLZ','SEED'].includes(String(v))):typeof values[key]===typeof value&&(typeof value!=='number'||Number.isFinite(values[key])))
            ||!structures[values.family as keyof typeof structures].includes(values.structure as import('../competitions/api').Structure)
            ||!['ASSOCIATION','FUTSAL','BEACH','WALKING','OTHER'].includes(String(values.discipline)))return null;
    }
    if('eligibilityPolicy' in draft&&draft.eligibilityPolicy!==undefined){const policy=draft.eligibilityPolicy;if(!policy||typeof policy!=='object'||!Object.entries(defaultPolicy()).every(([key,value])=>key in policy&&typeof (policy as Record<string,unknown>)[key]===typeof value&&(typeof value!=='number'||Number.isFinite((policy as Record<string,unknown>)[key]))))return null;}
    if(form.venueId!==undefined&&(typeof form.venueId!=='string'||form.venueId!==''&&!/^[1-9]\\d*$/.test(form.venueId)))return null;
    if(form.bannerImageUrl!==undefined&&(typeof form.bannerImageUrl!=='string'||form.bannerImageUrl.length>500))return null;
    return draft as TournamentSetupDraft;
}

export function readOrganizerSelection(value: string | null): number | null {
    if (!value || !/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}
