import { useId, useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { PASTE_EXAMPLE, pasteIntoPlan, type PasteLine, type PasteResult, type PlanView } from './api';

const ACTIONS: Record<PasteLine['action'], [string, string]> = { NEW: ['New', 'ახალი'], UPDATED: ['Updated', 'განახლდა'], MOVED: ['Moved', 'გადავიდა'], UNCHANGED: ['Same', 'იგივე'], DELETED: ['Deleted', 'წაიშლება'] };

/**
 * Plain text from an AI (or anyone) turned into tasks of work: a preview of what it would do first, then apply.
 * Tasks match by name in this plan; only lines marked [delete] delete. A new task whose name is already in another
 * plan is flagged, so a plan pasted twice does not quietly double.
 */
export function PasteDialog({ planId, elsewhere, onClose, onApplied }: { planId: number; elsewhere: Map<string, string>; onClose: () => void; onApplied: (view: PlanView) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [text, setText] = useState('');
    const [preview, setPreview] = useState<PasteResult | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const send = async (apply: boolean) => {
        setBusy(true); setError('');
        try {
            const result = await pasteIntoPlan(planId, text, apply);
            if (apply && result.view) onApplied(result.view); else setPreview(result);
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be read.', 'ვერ წავიკითხეთ.'))); }
        finally { setBusy(false); }
    };
    const summary = preview && [
        preview.created && copy(`${preview.created} new`, `${preview.created} ახალი`),
        preview.updated && copy(`${preview.updated} updated`, `${preview.updated} განახლდება`),
        preview.moved && copy(preview.moved === 1 ? '1 step moved' : `${preview.moved} steps moved`, `${preview.moved} ნაბიჯი გადავა`),
        preview.deleted && copy(`${preview.deleted} deleted`, `${preview.deleted} წაიშლება`),
        preview.unchanged && copy(`${preview.unchanged} the same`, `${preview.unchanged} იგივე`),
    ].filter(Boolean).join(', ');
    const changes = preview ? preview.created + preview.updated + preview.moved + (preview.deleted ?? 0) : 0;
    const doubled = preview?.lines.filter(line => line.action === 'NEW' && !line.parent && elsewhere.has(line.title.trim().toLowerCase())) ?? [];
    return <Dialog open size="lg" className="tw-dialog" title={copy('Paste from AI', 'ჩასმა AI-დან')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy('One task per line: - [status] Name | started 20 Oct | ends ~2 weeks | Beqa | 70%. Two spaces before the dash make it a step. [delete] removes a task.',
            'თითო საქმე თითო ხაზზე: - [სტატუსი] სახელი | started 20 Oct | ends ~2 weeks | ბექა | 70%. ტირემდე ორი გამოტოვება ნაბიჯს ნიშნავს. [delete] საქმეს წაშლის.')}
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
                {line.action === 'NEW' && !line.parent && elsewhere.has(line.title.trim().toLowerCase()) && <span className="tw-paste__doubled">{copy(`Already in ${elsewhere.get(line.title.trim().toLowerCase())}`, `უკვე არის: ${elsewhere.get(line.title.trim().toLowerCase())}`)}</span>}
            </li>)}</ol>
            {doubled.length > 0 && <p className="gk-notice gk-notice--warning" role="status">{copy(`${doubled.length === 1 ? '1 new task has' : `${doubled.length} new tasks have`} the name of a task in another plan. Applying makes a second copy; to update the existing one, paste into its plan instead.`, `${doubled.length} ახალ საქმეს სხვა გეგმის საქმის სახელი აქვს. გამოყენება მეორე ასლს შექმნის; არსებულის განსაახლებლად ჩასვით მის გეგმაში.`)}</p>}
            {preview.problems.length > 0 && <ul className="gk-notice gk-notice--warning tw-paste__problems">{preview.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        </div> : <div className="tw-details">
            <label htmlFor={id} className="gk-visually-hidden">{copy('The work, as text', 'საქმეები ტექსტად')}</label>
            <textarea id={id} className="gk-input tw-paste__text" rows={10} maxLength={20000} value={text} placeholder={PASTE_EXAMPLE} onChange={event => setText(event.target.value)} />
            <p className="gk-faint tw-paste__help">{copy('Status: in progress, on hold, planned, finished; add “small” for a small fix: [planned, small]. Ends: a date, ~N days/weeks/months, possibly November, don’t know. A first line “plan: Name” is optional.',
                'სტატუსი: in progress, on hold, planned, finished; პატარა შესწორებისთვის დაამატეთ „small“: [planned, small]. დასრულება: თარიღი, ~N days/weeks/months, possibly November, don’t know. პირველი ხაზი „plan: სახელი“ არასავალდებულოა.')}
                {' '}<button type="button" className="tw-link-button" onClick={() => setText(PASTE_EXAMPLE)}>{copy('Use the example', 'მაგალითის ჩასმა')}</button></p>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
