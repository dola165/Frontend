/**
 * "What was shared in this chat changed": the open chat says so when files come or go with its messages (arriving,
 * sent, deleted), and the panel's Media looks again, so a picture sent a moment ago shows there without a reload.
 */
type Listener = (chatId: number) => void;
const listeners = new Set<Listener>();

export const sharedChanged = (chatId: number) => listeners.forEach(listener => listener(chatId));

/** Calls the listener after each change; returns the way to stop. */
export function onSharedChanged(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
