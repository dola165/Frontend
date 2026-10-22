import { useId, useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { PASTE_EXAMPLE, pasteIntoRoadmap, type PasteLine, type PasteResult, type RoadmapView } from './api';

const ACTIONS: Record<PasteLine['action'], [string, string]> = { NEW: ['New', 'ახალი'], UPDATED: ['Updated', 'განახლდა'], MOVED: ['Moved', 'გადავიდა'], UNCHANGED: ['Same', 'იგივე'] };

/**
 * Plain text from an AI (or anyone) turned into pieces of work: a preview of what it would do first, then apply.
 * Pieces match by name on this roadmap; nothing is ever deleted.
 */
export function PasteDialog({ roadmapId, onClose, onApplied }: { roadmapId: number; onClose: () => void; onApplied: (view: RoadmapView) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [text, setText] = useState('');
    const [preview, setPreview] = useState<PasteResult | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const send = async (apply: boolean) => {
        setBusy(true); setError('');
        try {
            const result = await pasteIntoRoadmap(roadmapId, text, apply);
            if (apply && result.view) onApplied(result.view); else setPreview(result);
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be read.', 'ვერ წავიკითხეთ.'))); }
        finally { setBusy(false); }
    };
    const summary = preview && [
        preview.created && copy(`${preview.created} new`, `${preview.created} ახალი`),
        preview.updated && copy(`${preview.updated} updated`, `${preview.updated} განახლდება`),
        preview.moved && copy(preview.moved === 1 ? '1 part moved' : `${preview.moved} parts moved`, `${preview.moved} ნაწილი გადავა`),
        preview.unchanged && copy(`${preview.unchanged} the same`, `${preview.unchanged} იგივე`),
    ].filter(Boolean).join(', ');
    const changes = preview ? preview.created + preview.updated + preview.moved : 0;
    return <Dialog open size="lg" className="tw-dialog" title={copy('Paste from AI', 'ჩასმა AI-დან')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy('One piece per line: - [status] Name | started 20 Oct | ends ~2 weeks | Beqa | 70%. Two spaces before the dash make it a part. Nothing is deleted.',
            'თითო საქმე თითო ხაზზე: - [სტატუსი] სახელი | started 20 Oct | ends ~2 weeks | ბექა | 70%. ტირემდე ორი გამოტოვება ნაწილს ნიშნავს. არაფერი იშლება.')}
        footer={<>
            <Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            {preview ? <><Button onClick={() => setPreview(null)}>{copy('Back to the text', 'ტექსტზე დაბრუნება')}</Button>
                <Button variant="primary" disabled={busy || changes === 0} onClick={() => void send(true)}>{busy ? copy('Applying…', 'სრულდება…') : copy('Apply', 'გამოყენება')}</Button></>
                : <Button variant="primary" disabled={busy || !text.trim()} onClick={() => void send(false)}>{busy ? copy('Reading…', 'იკითხება…') : copy('Preview', 'გადახედვა')}</Button>}
        </>}>
        {preview ? <div className="tw-details">
            <p className="tw-paste__summary"><strong>{summary || copy('Nothing to change', 'შესაცვლელი არაფერია')}</strong></p>
            <ol className="tw-paste__lines">{preview.lines.map(line => <li key={line.line} data-action={line.action}>
                <span className="tw-paste__action">{copy(...ACTIONS[line.action])}</span>
                <span className="tw-paste__title">{line.parent && <span className="gk-faint">{line.parent} › </span>}{line.title}</span>
                {line.detail && <span className="gk-faint">{line.detail}</span>}
            </li>)}</ol>
            {preview.problems.length > 0 && <ul className="gk-notice gk-notice--warning tw-paste__problems">{preview.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        </div> : <div className="tw-details">
            <label htmlFor={id} className="gk-visually-hidden">{copy('The work, as text', 'საქმეები ტექსტად')}</label>
            <textarea id={id} className="gk-input tw-paste__text" rows={10} maxLength={20000} value={text} placeholder={PASTE_EXAMPLE} onChange={event => setText(event.target.value)} />
            <p className="gk-faint tw-paste__help">{copy('Status: in progress, on hold, planned, finished. Ends: a date, ~N days/weeks/months, possibly November, don’t know. A first line “roadmap: Name” is optional.',
                'სტატუსი: in progress, on hold, planned, finished. დასრულება: თარიღი, ~N days/weeks/months, possibly November, don’t know. პირველი ხაზი „roadmap: სახელი“ არასავალდებულოა.')}
                {' '}<button type="button" className="tw-link-button" onClick={() => setText(PASTE_EXAMPLE)}>{copy('Use the example', 'მაგალითის ჩასმა')}</button></p>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
