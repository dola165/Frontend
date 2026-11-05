import { getAuthSessionId, getStoredUserId, isCurrentAuthSession } from '../../utils/authStorage';

type Attempt = { content: string; key: string };
type Recovery = { draft: string; attempts: Attempt[] };
export type ConversationKey = number | string;
const prefix = 'gk-chat-recovery:';

/** Private, tab-local recovery belongs to one login, including a second login to the same account. */
export function createMessageRecovery() {
    const session = getAuthSessionId();
    const user = getStoredUserId();
    const scope = `${prefix}${session ?? 'legacy'}:${user ?? 'guest'}:`;
    const current = () => isCurrentAuthSession(session) && getStoredUserId() === user;
    const memory = new Map<ConversationKey, Recovery>();
    const read = (id: ConversationKey): Recovery => {
        if (!current()) return { draft: '', attempts: [] };
        let value: Recovery = { draft: '', attempts: [] };
        try {
            const saved = JSON.parse(sessionStorage.getItem(`${scope}${id}`) ?? 'null') as Recovery | null;
            if (saved && typeof saved.draft === 'string' && Array.isArray(saved.attempts)
                && saved.attempts.every(item => typeof item.content === 'string' && typeof item.key === 'string')) value = saved;
        } catch { value = memory.get(id) ?? value; }
        memory.set(id, value);
        return value;
    };
    const write = (id: ConversationKey, value: Recovery) => {
        if (!current()) throw new Error('The login changed.');
        // Retired login drafts are never restored, even for the same account.
        for (const key of Object.keys(sessionStorage)) {
            if (key.startsWith(prefix) && !key.startsWith(scope)) sessionStorage.removeItem(key);
        }
        if (value.draft || value.attempts.length) sessionStorage.setItem(`${scope}${id}`, JSON.stringify(value));
        else sessionStorage.removeItem(`${scope}${id}`);
        memory.set(id, value);
    };
    return {
        current,
        readDraft: (id: ConversationKey) => read(id).draft,
        writeDraft(id: ConversationKey, draft: string) {
            const value = { ...read(id), draft };
            try { write(id, value); } catch { if (current()) memory.set(id, value); }
        },
        prepare(id: ConversationKey, content: string) {
            const value = read(id);
            const attempt = value.attempts.find(item => item.content === content) ?? { content, key: crypto.randomUUID() };
            write(id, { ...value, attempts: [...value.attempts.filter(item => item.key !== attempt.key), attempt] });
            return attempt;
        },
        confirm(id: ConversationKey, attempt: Attempt) {
            const value = read(id);
            write(id, { draft: value.draft.trim() === attempt.content ? '' : value.draft,
                attempts: value.attempts.filter(item => item.key !== attempt.key) });
        },
    };
}
