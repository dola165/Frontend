import { useSearchParams } from 'react-router-dom';

export type LeaveStep = 'leave' | 'handover' | 'close';
const STEPS: LeaveStep[] = ['leave', 'handover', 'close'];

/** The leave flow's step lives in the address (`leave=leave|handover|close`), so a reload lands back on it. */
export function useLeaveStep() {
    const [params, setParams] = useSearchParams();
    const step = STEPS.find(value => value === params.get('leave')) ?? null;
    const go = (next: LeaveStep | null) => setParams(current => {
        const out = new URLSearchParams(current);
        if (next) out.set('leave', next); else out.delete('leave');
        return out;
    }, { replace: true });
    return { step, go };
}
