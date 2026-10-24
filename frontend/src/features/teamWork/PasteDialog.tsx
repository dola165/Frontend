import { useId, useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { NAME_LIMIT, PASTE_EXAMPLE, pasteIntoPlan, type PasteLine, type PasteResult, type PlanView } from './api';
import './team-work-now.css';

const ACTIONS: Record<PasteLine['action'], [string, string]> = { NEW: ['New', 'ახალი'], UPDATED: ['Updated', 'განახლდა'], MOVED: ['Moved', 'გადავიდა'], UNCHANGED: ['Same', 'იგივე'], DELETED: ['Deleted', 'წაიშლება'] };

/**
 * Plain text from an AI (or anyone) turned into tasks of work: a preview of what it would do first, then apply.
 * Tasks match by name in this plan; only lines marked [delete] delete. A new task whose name is already in another
 * plan is flagged, so a plan pasted twice does not quietly double. A name over 30 characters still goes in, with a
 * warning to shorten it.
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
        description={copy('One task per line; two spaces before the dash make it a step. You see what changes before anything is saved.', 'თითო საქმე თითო ხაზზე; ტირემდე ორი გამოტოვება ნაბიჯია. შენახვამდე ნახავთ, რა შეიცვლება.')}
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
                {line.action !== 'DELETED' && line.title.trim().length > NAME_LIMIT && <span className="tw-paste__long">{copy('Long name: shorten it', 'გრძელი სახელი: შეამოკლეთ')}</span>}
                {line.detail && <span className="gk-faint">{line.detail}</span>}
                {line.action === 'NEW' && !line.parent && elsewhere.has(line.title.trim().toLowerCase()) && <span className="tw-paste__doubled">{copy(`Already in ${elsewhere.get(line.title.trim().toLowerCase())}`, `უკვე არის: ${elsewhere.get(line.title.trim().toLowerCase())}`)}</span>}
            </li>)}</ol>
            {doubled.length > 0 && <p className="gk-notice gk-notice--warning" role="status">{copy(`${doubled.length === 1 ? '1 new task has' : `${doubled.length} new tasks have`} the name of a task in another plan. Applying makes a second copy; to update the existing one, paste into its plan instead.`, `${doubled.length} ახალ საქმეს სხვა გეგმის საქმის სახელი აქვს. გამოყენება მეორე ასლს შექმნის; არსებულის განსაახლებლად ჩასვით მის გეგმაში.`)}</p>}
            {preview.problems.length > 0 && <ul className="gk-notice gk-notice--warning tw-paste__problems">{preview.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        </div> : <div className="tw-details">
            <label htmlFor={id} className="gk-visually-hidden">{copy('The work, as text', 'საქმეები ტექსტად')}</label>
            <textarea id={id} className="gk-input tw-paste__text" rows={10} maxLength={20000} value={text} placeholder={PASTE_EXAMPLE} onChange={event => setText(event.target.value)} />
            <p className="tw-paste__tools"><button type="button" className="tw-link-button" onClick={() => setText(PASTE_EXAMPLE)}>{copy('Use the example', 'მაგალითის ჩასმა')}</button></p>
            <details className="tw-fold tw-paste__format">
                <summary className="tw-section__title">{copy('Format', 'ფორმატი')}</summary>
                <p className="gk-faint tw-paste__help">{copy('- [status, priority] GK-12 Name | started 20 Oct | ends ~2 weeks | Beqa | 70%. The key is optional and finds the task even after a rename; [delete] removes one. Status: planned, in progress, needs your look, accepted, live, blocked (the old “on hold” and “finished” still read). Priority: now, next, later; “small” marks a small fix. After the name: started DATE, ends ~N days/weeks/months, possibly November, don’t know, N%, desc:, done:, requested by NAME, blocked by GK-1, related GK-3, and people’s names. A first line “plan: Name” is optional.',
                    '- [სტატუსი, პრიორიტეტი] GK-12 სახელი | started 20 Oct | ends ~2 weeks | ბექა | 70%. გასაღები არასავალდებულოა და საქმეს სახელის შეცვლის შემდეგაც პოულობს; [delete] შლის. სტატუსი: planned, in progress, needs your look, accepted, live, blocked (ძველი „on hold“ და „finished“ კვლავ იკითხება). პრიორიტეტი: now, next, later; „small“ პატარა შესწორებაა. სახელის შემდეგ: started DATE, ends ~N days/weeks/months, possibly November, don’t know, N%, desc:, done:, requested by სახელი, blocked by GK-1, related GK-3 და ხალხის სახელები. პირველი ხაზი „plan: სახელი“ არასავალდებულოა.')}</p>
            </details>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
