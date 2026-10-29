import { PasteFrame } from '../../components/work/PasteFrame';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { NAME_LIMIT, PASTE_EXAMPLE, pasteIntoPlan, type PasteLine, type PlanView } from './api';

const ACTIONS: Record<PasteLine['action'], [string, string]> = { NEW: ['New', 'ახალი'], UPDATED: ['Updated', 'განახლდა'], MOVED: ['Moved', 'გადავიდა'], UNCHANGED: ['Same', 'იგივე'], DELETED: ['Deleted', 'წაიშლება'] };

/**
 * Plain text from an AI (or anyone) turned into tasks of work, on the shared paste dialog. Tasks match by name in
 * this plan; only lines marked [delete] delete. A new task whose name is already in another plan is flagged, so a
 * plan pasted twice does not quietly double. A name over 30 characters still goes in, with a warning to shorten it.
 */
export function PasteDialog({ planId, elsewhere, onClose, onApplied }: { planId: number; elsewhere: Map<string, string>; onClose: () => void; onApplied: (view: PlanView) => void }) {
    const copy = useJourneyCopy();
    return <PasteFrame title={copy('Paste from AI', 'ჩასმა AI-დან')} example={PASTE_EXAMPLE} onClose={onClose}
        description={copy('One task per line; two spaces before the dash make it a step. You see what changes before anything is saved.', 'თითო საქმე თითო ხაზზე; ტირემდე ორი გამოტოვება ნაბიჯია. შენახვამდე ნახავთ, რა შეიცვლება.')}
        read={(text, apply) => pasteIntoPlan(planId, text, apply)}
        changes={preview => preview.created + preview.updated + preview.moved + (preview.deleted ?? 0)}
        applied={result => Boolean(result.view)}
        onApplied={result => { if (result.view) onApplied(result.view); }}
        format={<details className="tw-fold work-paste__format">
            <summary className="tw-section__title">{copy('Format', 'ფორმატი')}</summary>
            <p className="gk-faint work-paste__help">{copy('- [status, priority] GK-12 Name | started 20 Oct | ends ~2 weeks | Beqa | 70%. The key is optional and finds the task even after a rename; [delete] removes one. Status: planned, in progress, needs your look, accepted, live, blocked (the old “on hold” and “finished” still read). Priority: now, next, later; “small” marks a small fix. After the name: started DATE, ends ~N days/weeks/months, possibly November, don’t know, N%, desc:, done:, requested by NAME, blocked by GK-1, related GK-3, and people’s names. A first line “plan: Name” is optional.',
                '- [სტატუსი, პრიორიტეტი] GK-12 სახელი | started 20 Oct | ends ~2 weeks | ბექა | 70%. გასაღები არასავალდებულოა და საქმეს სახელის შეცვლის შემდეგაც პოულობს; [delete] შლის. სტატუსი: planned, in progress, needs your look, accepted, live, blocked (ძველი „on hold“ და „finished“ კვლავ იკითხება). პრიორიტეტი: now, next, later; „small“ პატარა შესწორებაა. სახელის შემდეგ: started DATE, ends ~N days/weeks/months, possibly November, don’t know, N%, desc:, done:, requested by სახელი, blocked by GK-1, related GK-3 და ხალხის სახელები. პირველი ხაზი „plan: სახელი“ არასავალდებულოა.')}</p>
        </details>}
        preview={preview => {
            const summary = [
                preview.created && copy(`${preview.created} new`, `${preview.created} ახალი`),
                preview.updated && copy(`${preview.updated} updated`, `${preview.updated} განახლდება`),
                preview.moved && copy(preview.moved === 1 ? '1 step moved' : `${preview.moved} steps moved`, `${preview.moved} ნაბიჯი გადავა`),
                preview.deleted && copy(`${preview.deleted} deleted`, `${preview.deleted} წაიშლება`),
                preview.unchanged && copy(`${preview.unchanged} the same`, `${preview.unchanged} იგივე`),
            ].filter(Boolean).join(', ');
            const doubled = preview.lines.filter(line => line.action === 'NEW' && !line.parent && elsewhere.has(line.title.trim().toLowerCase()));
            return <>
                <p className="work-paste__summary"><strong>{summary || copy('Nothing to change', 'შესაცვლელი არაფერია')}</strong></p>
                <ol className="work-paste__lines">{preview.lines.map(line => <li key={line.line} data-action={line.action}>
                    <span className="work-paste__action">{copy(...ACTIONS[line.action])}</span>
                    <span className="work-paste__title">{line.parent && <span className="gk-faint">{line.parent} › </span>}{line.title}</span>
                    {line.action !== 'DELETED' && line.title.trim().length > NAME_LIMIT && <span className="work-paste__long">{copy('Long name: shorten it', 'გრძელი სახელი: შეამოკლეთ')}</span>}
                    {line.detail && <span className="gk-faint">{line.detail}</span>}
                    {line.action === 'NEW' && !line.parent && elsewhere.has(line.title.trim().toLowerCase()) && <span className="work-paste__doubled">{copy(`Already in ${elsewhere.get(line.title.trim().toLowerCase())}`, `უკვე არის: ${elsewhere.get(line.title.trim().toLowerCase())}`)}</span>}
                </li>)}</ol>
                {doubled.length > 0 && <p className="gk-notice gk-notice--warning" role="status">{copy(`${doubled.length === 1 ? '1 new task has' : `${doubled.length} new tasks have`} the name of a task in another plan. Applying makes a second copy; to update the existing one, paste into its plan instead.`, `${doubled.length} ახალ საქმეს სხვა გეგმის საქმის სახელი აქვს. გამოყენება მეორე ასლს შექმნის; არსებულის განსაახლებლად ჩასვით მის გეგმაში.`)}</p>}
                {preview.problems.length > 0 && <ul className="gk-notice gk-notice--warning work-paste__problems">{preview.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
            </>;
        }} />;
}
