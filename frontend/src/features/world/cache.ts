/**
 * One request per key for a short while, shared by every field that needs it (a coach's fixtures and listings
 * feed several fields). Not tied to one component's abort signal: the first field to ask starts it, the rest
 * reuse it. A failed request is forgotten, so a retry asks again.
 */
const store = new Map<string, { at: number; promise: Promise<unknown> }>();

export function shared<T>(key: string, load: () => Promise<T>, ttl = 60_000): Promise<T> {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.promise as Promise<T>;
    const promise = load().catch(error => { store.delete(key); throw error; });
    store.set(key, { at: Date.now(), promise });
    return promise;
}

/** Drops cached answers whose key starts with the prefix, after something they depend on changed. */
export function forget(prefix: string) {
    for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
}
