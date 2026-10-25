import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessagesSquare } from 'lucide-react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { createChat } from './api';
import { problem } from './teamChatWords';
import './discuss.css';

/**
 * "Discuss" on a task: opens the task's chat, or starts it (named after the task) the first time. Says how many
 * messages the chat holds. `compact` is the quiet form for a row of tasks: the symbol and the count.
 */
export function DiscussButton({ task, compact = false }: { task: { id: number; key: string; chatId?: number | null; chatMessages?: number }; compact?: boolean }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const count = task.chatMessages ?? 0;
    const open = async () => {
        if (task.chatId) { navigate(`/team-work/chat?chat=${task.chatId}`); return; }
        setBusy(true); setError('');
        try { const chat = await createChat({ taskId: task.id }); navigate(`/team-work/chat?chat=${chat.id}`); }
        catch (failure) { setError(problem(copy, failure, ['The chat could not open.', 'ჩატი ვერ გაიხსნა.'])); setBusy(false); }
    };
    const label = count
        ? copy(`Discuss ${task.key}: ${count} ${count === 1 ? 'message' : 'messages'}`, `${task.key}-ის განხილვა: ${count} შეტყობინება`)
        : copy(`Discuss ${task.key} in a chat`, `${task.key}-ის განხილვა ჩატში`);
    return <span className="tc-discuss" data-compact={compact || undefined}>
        <button type="button" className="tc-discuss__button" onClick={event => { event.stopPropagation(); void open(); }} disabled={busy} aria-label={label} title={error || label}>
            {busy ? <Loader2 className="tc-discuss__spin" aria-hidden="true" /> : <MessagesSquare aria-hidden="true" />}
            {!compact && <span>{copy('Discuss', 'განხილვა')}</span>}
            {count > 0 && <span className="tc-discuss__count gk-num">{count}</span>}
        </button>
        {error && !compact && <span className="tc-discuss__error" role="alert">{error}</span>}
    </span>;
}
