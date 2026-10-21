import { post, type Match } from '../api';
import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { getAuthSessionId, type AuthSessionId } from '../../../utils/authStorage';

/** Offers one of our squads for an open match, with a word for the host's coach. Nothing is agreed until they accept. */
export const offerToPlay = async (m: Pick<Match, 'event_id' | 'revision'>, squadId: number, note: string, session: AuthSessionId = getAuthSessionId()) => {
    const config: AuthSessionRequestConfig = { timeout: 30000, _authSessionId: session };
    return (await apiClient.post(`/match-exchange/${m.event_id}/proposals`, { squadId, note, revision: m.revision }, config)).data;
};

/** Answers a club's invitation: accept with the squad that plays, or decline. */
export const answerInvitation = (m: Pick<Match, 'event_id' | 'revision'>, answer: { accept: true; squadId: number } | { accept: false }) =>
    post(`/match-arrangements/${m.event_id}/response`, answer.accept ? { action: 'ACCEPT', squadId: answer.squadId, revision: m.revision } : { action: 'DECLINE', revision: m.revision });
