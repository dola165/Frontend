import { useSearchParams } from 'react-router-dom';

export type LeaveStep = 'leave' | 'handover' | 'close';
const STEPS: LeaveStep[] = ['leave', 'handover', 'close'];

/**
 * The leave flow lives in the address as `leave=<clubId>:<step>` (`leave|handover|close`), so a reload reopens it and
 * only the dialog for that club opens when a page has several. With `clubId`, `step` is that club's step or null.
 */
export function useLeaveStep(clubId?: number) {
    const [params, setParams] = useSearchParams();
    const [rawClub, rawStep] = (params.get('leave') ?? '').split(':');
    const club = Number(rawClub) || null;
    const parsed = STEPS.find(value => value === rawStep) ?? null;
    const step = parsed && club !== null && (clubId === undefined || club === clubId) ? parsed : null;
    const go = (next: LeaveStep | null, target: number | undefined = clubId) => setParams(current => {
        const out = new URLSearchParams(current);
        if (next && target) out.set('leave', `${target}:${next}`); else out.delete('leave');
        return out;
    }, { replace: true });
    return { step, clubId: step ? club : null, go };
}

/** The address of a club's People with the leave flow open at a step. */
export const leaveFlowPath = (clubId: number, step: LeaveStep) => `/clubs/${clubId}/workspace?tab=personnel&leave=${clubId}:${step}`;
