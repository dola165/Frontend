import { apiClient } from '../api/axiosConfig';

// Only mounted consumers share bytes. Releasing the last consumer revokes the URL
// immediately, so private media never becomes a persistent browser cache.
const MAX_IN_FLIGHT = 6;
type Entry = {
    refs: number;
    controller: AbortController;
    promise: Promise<string>;
    start: () => void;
    reject: (reason: unknown) => void;
    finish?: () => void;
    url?: string;
};
const entries = new Map<string, Entry>();
const queued = new Set<Entry>();
let inFlight = 0;
const drain = () => {
    while (inFlight < MAX_IN_FLIGHT && queued.size) {
        const entry = queued.values().next().value!;
        queued.delete(entry);
        if (!entry.controller.signal.aborted) entry.start();
    }
};

export const acquireMedia = (key: string, source: string) => {
    let entry = entries.get(key);
    if (!entry) {
        let resolve!: (url: string) => void;
        let reject!: (reason: unknown) => void;
        const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
        const controller = new AbortController();
        const created: Entry = {
            refs: 0, controller, promise, reject,
            start: () => {
                inFlight++;
                let finished = false;
                created.finish = () => {
                    if (finished) return;
                    finished = true;
                    inFlight--;
                    queueMicrotask(drain);
                };
                void apiClient.get<Blob>(source, { responseType: 'blob', signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } })
                    .then(response => {
                        if (controller.signal.aborted) return;
                        created.url = URL.createObjectURL(response.data);
                        resolve(created.url);
                    }).catch(reject).finally(() => created.finish?.());
            },
        };
        entry = created;
        entries.set(key, entry);
        queued.add(entry);
    }
    entry.refs++;
    drain();
    let released = false;
    return {
        promise: entry.promise,
        release: () => {
            if (released) return;
            released = true;
            if (--entry.refs) return;
            entries.delete(key);
            queued.delete(entry);
            entry.controller.abort();
            entry.finish?.();
            entry.reject(new DOMException('Media no longer in use', 'AbortError'));
            if (entry.url) URL.revokeObjectURL(entry.url);
        },
    };
};
