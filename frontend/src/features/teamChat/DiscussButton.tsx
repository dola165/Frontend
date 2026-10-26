import { useState } from 'react';
import { Loader2, Lock, MessagesSquare, X } from 'lucide-react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { CHAT_PRIVATE, problem } from './teamChatWords';
import './discuss.css';
import { useDiscuss, type Discussed } from './useDiscuss';

/**
 * "Discuss" on a task: opens the task's chat, or starts it (named after the task) the first time. Says how many
 * messages the chat holds. `compact` is the quiet form for a row of tasks: the symbol and the count. A task whose chat
 * is for chosen people you are not in says so, and who can add you.
 */
export function DiscussButton({ task, compact = false }: { task: Discussed; compact?: boolean }) {
    const copy = useJourneyCopy();
    const discuss = useDiscuss();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const count = task.chatMessages ?? 0;
    const open = async () => {
        setBusy(true); setError('');
        try { await discuss(task); }
        catch (failure) { setError(problem(copy, failure, ['The chat could not open.', 'ჩატი ვერ გაიხსნა.'], CHAT_PRIVATE)); setBusy(false); }
    };
    if (task.chatPrivate) {
        const why = copy(...CHAT_PRIVATE);
        return <span className="tc-discuss" data-compact={compact || undefined}>
            <button type="button" className="tc-discuss__button" disabled aria-label={copy(`${task.key}: ${why}`, `${task.key}: ${why}`)} title={why}>
                <Lock aria-hidden="true" />{!compact && <span>{copy('Chosen people', 'არჩეული ხალხი')}</span>}
            </button>
        </span>;
    }
    const label = count
        ? copy(`Discuss ${task.key}: ${count} ${count === 1 ? 'message' : 'messages'}`, `${task.key}-ის განხილვა: ${count} შეტყობინება`)
        : copy(`Discuss ${task.key} in a chat`, `${task.key}-ის განხილვა ჩატში`);
    // In a row of tasks the error is a small bubble under the button: seen, without moving the row.
    return <span className="tc-discuss" data-compact={compact || undefined}>
        <button type="button" className="tc-discuss__button" onClick={event => { event.stopPropagation(); void open(); }} disabled={busy}
            aria-label={label} title={label}>
            {busy ? <Loader2 className="tc-discuss__spin" aria-hidden="true" /> : <MessagesSquare aria-hidden="true" />}
            {!compact && <span>{copy('Discuss', 'განხილვა')}</span>}
            {count > 0 && <span className="tc-discuss__count gk-num">{count}</span>}
        </button>
        {error && <span className="tc-discuss__error" role="alert">
            {error}
            {compact && <button type="button" className="tc-discuss__dismiss" aria-label={copy('Close', 'დახურვა')}
                onClick={event => { event.stopPropagation(); setError(''); }}><X aria-hidden="true" /></button>}
        </span>}
    </span>;
}
