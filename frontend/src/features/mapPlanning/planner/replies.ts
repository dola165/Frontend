import type { Plan } from '../api';

export type Reply = 'GOING' | 'NOT_GOING' | 'RECONFIRM' | 'PENDING';
export const REPLY_LABEL: Record<Reply, string> = { GOING: 'Going', NOT_GOING: 'Can’t go', RECONFIRM: 'Asked again', PENDING: 'No reply yet' };

/** A player's attendance reply for the published version: their family's or their own. */
export function replyOf(plan: Plan, playerId: number): Reply {
    const family = plan.journeyResponses?.find(item => item.subject_id === playerId)?.response;
    const own = plan.playerResponses?.find(item => item.actor_id === playerId)?.status;
    const value = family ?? own;
    return value === 'GOING' ? 'GOING' : value === 'NOT_GOING' ? 'NOT_GOING' : value === 'RECONFIRMATION_REQUIRED' ? 'RECONFIRM' : 'PENDING';
}

/** Replies across the players on the plan, plus families who read the update and gave permission. */
export function replySummary(plan: Plan) {
    const players = plan.draft.participants;
    const counts = { GOING: 0, NOT_GOING: 0, RECONFIRM: 0, PENDING: 0 } as Record<Reply, number>;
    players.forEach(id => { counts[replyOf(plan, id)] += 1; });
    const families = plan.familyResponses ?? [];
    return {
        players: players.length, ...counts,
        families: families.length,
        read: families.filter(item => item.acknowledged_at).length,
        permitted: families.filter(item => item.permission_status === 'GRANTED').length,
    };
}
