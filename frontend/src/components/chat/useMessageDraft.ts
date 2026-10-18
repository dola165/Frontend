import { useCallback, useState, type SetStateAction } from 'react';
import { createMessageRecovery } from './messageRecovery';

export function useMessageDraft(conversationId: number | null) {
    const [recovery] = useState(createMessageRecovery);
    const [draft, setDraft] = useState<{ id: number | null; text: string }>({ id: null, text: '' });
    const input = conversationId === null ? '' : draft.id === conversationId ? draft.text : recovery.readDraft(conversationId);
    const setInput = useCallback((value: SetStateAction<string>) => {
        if (conversationId === null || !recovery.current()) return;
        setDraft(previous => {
            const before = previous.id === conversationId ? previous.text : recovery.readDraft(conversationId);
            const text = typeof value === 'function' ? value(before) : value;
            recovery.writeDraft(conversationId, text);
            return { id: conversationId, text };
        });
    }, [conversationId, recovery]);
    const confirmDraft = useCallback((id: number, text: string) => {
        if (!recovery.current()) return;
        if (recovery.readDraft(id) === text) recovery.writeDraft(id, '');
        setDraft(previous => previous.id === id && previous.text === text ? { id, text: '' } : previous);
    }, [recovery]);
    return { input, setInput, confirmDraft };
}
