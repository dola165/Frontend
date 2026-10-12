import { useState } from 'react';
import { isAxiosError } from 'axios';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { noteDone } from './stepNotice';

/**
 * A step's sending state: busy while it goes, the reason when it did not. Once it worked, what it did is kept
 * (`noteDone`) and the drawer reads its thing again. A thing changed by someone else meanwhile (409) says so, with
 * Reload, because sending again would repeat the same out-of-date answer.
 */
export function useSend(reload: () => void, changedText = 'This match changed since you opened it.') {
    const [state, setState] = useState({ busy: false, error: '', changed: false });
    /** 'done' says what happened, from what the server answered when that decides it (an entry in, or on the waiting list). */
    const send = async <T,>(action: () => Promise<T>, done: string | ((result: T) => string), failed: string) => {
        setState({ busy: true, error: '', changed: false });
        try { const result = await action(); setState({ busy: false, error: '', changed: false }); noteDone(typeof done === 'function' ? done(result) : done); reload(); }
        catch (error) {
            const changed = isAxiosError(error) && error.response?.status === 409;
            setState({ busy: false, changed, error: changed ? changedText : extractApiErrorMessage(error, failed) });
        }
    };
    return { ...state, send };
}
