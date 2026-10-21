import axios from 'axios';

let localTail: Promise<void> = Promise.resolve();
const active = (signal: AbortSignal) => { if (signal.aborted) throw new axios.CanceledError(); };

/** Refresh and authenticated credential issuance share one origin-wide critical section. */
export async function withSessionCredentialLock<T>(signal: AbortSignal, action: () => Promise<T>): Promise<T> {
    active(signal);
    if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request('grasskickz-session-refresh', { signal }, () => { active(signal); return action(); });
    }
    // Older browsers can at least serialize every credential operation in this document.
    const preceding = localTail;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    localTail = preceding.then(() => held);
    try {
        await new Promise<void>((resolve, reject) => {
            const abort = () => { signal.removeEventListener('abort', abort); reject(new axios.CanceledError()); };
            signal.addEventListener('abort', abort, { once: true });
            preceding.then(() => { signal.removeEventListener('abort', abort); resolve(); });
            if (signal.aborted) abort();
        });
        active(signal);
        return await action();
    } finally { release(); }
}
