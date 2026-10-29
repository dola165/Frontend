import { useId, useState, type ReactNode } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import './work.css';

/**
 * Plain text pasted in (from an AI, a WhatsApp list, anyone) turned into work: a preview of what it would do first,
 * then apply. Team work's "Paste from AI" and a club's "Paste a plan" are this dialog with their own reading of the
 * text: `read` asks the server, `preview` draws its answer, and `changes` says how much applying would change.
 */
export function PasteFrame<R>({ title, description, example, format, read, preview, changes, onClose, onApplied }: {
    title: string;
    description: string;
    example: string;
    format?: ReactNode;
    read: (text: string, apply: boolean) => Promise<R>;
    preview: (result: R) => ReactNode;
    changes: (result: R) => number;
    onClose: () => void;
    onApplied: (result: R) => void;
}) {
    const copy = useJourneyCopy();
    const id = useId();
    const [text, setText] = useState('');
    const [result, setResult] = useState<R | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const send = async (apply: boolean) => {
        setBusy(true); setError('');
        try {
            const answer = await read(text, apply);
            if (apply) onApplied(answer); else setResult(answer);
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be read.', 'ვერ წავიკითხეთ.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="lg" className="work-paste" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')} description={description}
        footer={<>
            <Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            {result ? <><Button onClick={() => setResult(null)}>{copy('Back to the text', 'ტექსტზე დაბრუნება')}</Button>
                <Button variant="primary" disabled={busy || changes(result) === 0} onClick={() => void send(true)}>{busy ? copy('Applying…', 'სრულდება…') : copy('Apply', 'გამოყენება')}</Button></>
                : <Button variant="primary" disabled={busy || !text.trim()} onClick={() => void send(false)}>{busy ? copy('Reading…', 'იკითხება…') : copy('Preview', 'გადახედვა')}</Button>}
        </>}>
        {result ? <div className="work-paste__body">{preview(result)}</div> : <div className="work-paste__body">
            <label htmlFor={id} className="gk-visually-hidden">{copy('The work, as text', 'საქმეები ტექსტად')}</label>
            <textarea id={id} className="gk-input work-paste__text" rows={10} maxLength={20000} value={text} placeholder={example} onChange={event => setText(event.target.value)} />
            <p className="work-paste__tools"><button type="button" className="work-link-button" onClick={() => setText(example)}>{copy('Use the example', 'მაგალითის ჩასმა')}</button></p>
            {format}
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
