import { useId, useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { setChatStatus, type ChatSummary } from './api';
import { problem } from './teamChatWords';

/**
 * Setting Decided asks for one line: the decision. It is pinned at the top of the chat and, when the chat is about a
 * task, written into the task's history and notes, so what was agreed is never lost.
 */
export function DecideDialog({ chat, max, onClose, onDone }: { chat: ChatSummary; max: number; onClose: () => void; onDone: (chat: ChatSummary) => void }) {
    const copy = useJourneyCopy();
    const [line, setLine] = useState(chat.decision ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const fieldId = useId(), hintId = useId();
    const words = line.trim();
    const save = async () => {
        if (!words || words.length > max) return;
        setBusy(true); setError('');
        try { onDone(await setChatStatus(chat.id, 'DECIDED', words)); }
        catch (failure) { setError(problem(copy, failure, ['The decision was not saved.', 'გადაწყვეტილება ვერ შეინახა.'])); setBusy(false); }
    };
    const where = chat.task
        ? copy(`It is pinned at the top of the chat and written to ${chat.task.key} (its history and notes).`, `ის ჩატის თავში მიემაგრება და ჩაიწერება ${chat.task.key}-ში (ისტორიასა და შენიშვნებში).`)
        : copy('It is pinned at the top of the chat. This chat has no task, so it lives only here.', 'ის ჩატის თავში მიემაგრება. ამ ჩატს საქმე არ აქვს, ამიტომ მხოლოდ აქ დარჩება.');
    return <Dialog open size="md" className="tc-dialog tc-decide" title={copy('What was decided?', 'რა გადაწყდა?')} description={where}
        onClose={onClose} closeLabel={copy('Cancel', 'გაუქმება')}
        footer={<>
            <Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant="primary" disabled={busy || !words || words.length > max} onClick={() => void save()}>{copy('Mark decided', 'გადაწყდა')}</Button>
        </>}>
        <form onSubmit={event => { event.preventDefault(); void save(); }}>
            <label className="tc-sr" htmlFor={fieldId}>{copy('The decision, in one line', 'გადაწყვეტილება, ერთ ხაზად')}</label>
            <input id={fieldId} className="gk-input" value={line} maxLength={max} autoFocus aria-describedby={hintId}
                placeholder={copy('For example: MapLibre with our own tiles', 'მაგალითად: MapLibre, ჩვენი ფილებით')} onChange={event => setLine(event.target.value.replace(/[\r\n]+/g, ' '))} />
            <p id={hintId} className="tc-faint tc-decide__count gk-num">{`${line.length}/${max}`}</p>
        </form>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
