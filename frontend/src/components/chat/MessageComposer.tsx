import type { FormEvent } from 'react';
import { Send } from 'lucide-react';
import { useMessageCopy } from './messageCopy';

/** Text-only composer. The draft itself is durable (useMessageDraft); this only edits and submits it. */
export const MessageComposer = ({ input, setInput, sending, deliveryError, onSubmit }: {
    input: string; setInput: (value: string) => void; sending: boolean; deliveryError: string | null; onSubmit: (event: FormEvent) => void;
}) => {
    const copy = useMessageCopy();
    return (
        <div className="px-4 py-3 bg-[var(--chat-card)] border-t border-[var(--chat-card-border)] shrink-0">
            {deliveryError && <p role="alert" className="mb-2 text-sm text-[color:var(--color-warning)]">{copy(deliveryError)}</p>}
            <form onSubmit={onSubmit} className="flex items-center gap-2">
                <input
                    type="text"
                    aria-label={copy('Write a message')}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={sending}
                    placeholder={
                        sending ? copy('Sending…', 'იგზავნება…') : copy('Write a message…', 'დაწერეთ შეტყობინება…')
                    }
                    className="flex-1 bg-[var(--chat-input-bg)] border border-[var(--chat-card-border)] text-[var(--chat-text-primary)] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--chat-accent)]/40 transition-all disabled:opacity-50 placeholder:text-[var(--chat-text-placeholder)]"
                />

                {/* Emoji button removed — chat API is text-only; no emoji/attachment support (P1 W6) */}

                <button
                    type="submit"
                    aria-label={copy('Send message', 'გაგზავნა')}
                    disabled={!input.trim() || sending}
                    className="w-10 h-10 bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] disabled:opacity-40 text-[var(--chat-accent-contrast)] rounded-full flex items-center justify-center transition-colors shrink-0"
                >
                    <Send className="w-4 h-4 ml-0.5" />
                </button>
            </form>
        </div>
    );
};
