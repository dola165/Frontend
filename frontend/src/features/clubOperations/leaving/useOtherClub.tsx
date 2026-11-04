import { useCallback, useRef, useState } from 'react';
import { otherClubOf } from './api';
import { OtherClubNotice } from './OtherClubNotice';

type Refusal = { club: { clubId: number; name: string }; retry: () => void };

/**
 * Where a staff job is accepted: `catchOther(failure, retry)` takes a STAFF_OF_ANOTHER_CLUB refusal (true when it
 * did) and `notice` shows "Leave {club} first" with the leave flow; once left, `retry` runs the accept again.
 * `forget` drops it when the person moves on to something else. Leaving takes a while and its dialog holds on to the
 * callback, so only the refusal still current retries.
 */
export function useOtherClub() {
    const [pending, setPending] = useState<Refusal | null>(null);
    const current = useRef<Refusal | null>(null);
    const forget = useCallback(() => { current.current = null; setPending(null); }, []);
    const catchOther = (failure: unknown, retry: () => void) => {
        const club = otherClubOf(failure);
        if (!club) return false;
        const refusal = { club, retry };
        current.current = refusal;
        setPending(refusal);
        return true;
    };
    const notice = pending ? <OtherClubNotice club={pending.club} onLeft={() => { if (current.current !== pending) return; forget(); pending.retry(); }} /> : null;
    return { catchOther, notice, forget };
}
