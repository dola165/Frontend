import { useState } from 'react';
import { otherClubOf } from './api';
import { OtherClubNotice } from './OtherClubNotice';

/**
 * Where a staff job is accepted: `catchOther(failure, retry)` takes a STAFF_OF_ANOTHER_CLUB refusal (true when it
 * did) and `notice` shows "Leave {club} first" with the leave flow; once left, `retry` runs the accept again.
 */
export function useOtherClub() {
    const [pending, setPending] = useState<{ club: { clubId: number; name: string }; retry: () => void } | null>(null);
    const catchOther = (failure: unknown, retry: () => void) => {
        const club = otherClubOf(failure);
        if (!club) return false;
        setPending({ club, retry });
        return true;
    };
    const notice = pending ? <OtherClubNotice club={pending.club} onLeft={() => { const retry = pending.retry; setPending(null); retry(); }} /> : null;
    return { catchOther, notice };
}
