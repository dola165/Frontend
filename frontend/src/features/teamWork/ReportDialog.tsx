import { useId, useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { pasteReport, REPORT_EXAMPLE, type Detail, type ReportLine, type ReportResult } from './api';
import '../../components/work/work.css';

const FIELDS: Record<ReportLine['field'], [string, string]> = {
    status: ['Status', 'სტატუსი'], branch: ['Branch', 'ბრენჩი'], pr: ['Pull request', 'შერწყმის მოთხოვნა (PR)'], commits: ['Commits', 'კომიტები'], percent: ['Percent', 'პროცენტი'],
    tested: ['Tested', 'შემოწმდა'], question: ['Question', 'კითხვა'], summary: ['History line', 'ისტორიის ხაზი'],
};
const ACTIONS: Record<ReportLine['action'], [string, string]> = { SET: ['Sets', 'დაყენდება'], SAME: ['Same', 'იგივე'], ADDED: ['Adds', 'დაემატება'] };

/**
 * Paste report: a worker's report as plain text, one marker per line, turned into the task's status, branch, commits,
 * tested and questions. A preview says what would change first; then apply.
 */
export function ReportDialog({ item, onClose, onApplied }: { item: { id: number; key: string; title: string }; onClose: () => void; onApplied: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [text, setText] = useState('');
    const [preview, setPreview] = useState<ReportResult | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const send = async (apply: boolean) => {
        setBusy(true); setError('');
        try {
            const result = await pasteReport(item.id, text, apply);
            if (apply && result.detail) onApplied(result.detail); else setPreview(result);
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be read.', 'ვერ წავიკითხეთ.'))); }
        finally { setBusy(false); }
    };
    const changes = preview?.lines.filter(line => line.action !== 'SAME').length ?? 0;
    return <Dialog open size="lg" className="tw-dialog" title={copy(`Paste report · ${item.key}`, `ანგარიშის ჩასმა · ${item.key}`)} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy(`The worker’s report for “${item.title}”. You see what changes before anything is saved.`, `მუშაკის ანგარიში „${item.title}“-ზე. შენახვამდე ნახავთ, რა შეიცვლება.`)}
        footer={<>
            <Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            {preview ? <><Button onClick={() => setPreview(null)}>{copy('Back to the text', 'ტექსტზე დაბრუნება')}</Button>
                <Button variant="primary" disabled={busy || changes === 0} onClick={() => void send(true)}>{busy ? copy('Applying…', 'სრულდება…') : copy('Apply', 'გამოყენება')}</Button></>
                : <Button variant="primary" disabled={busy || !text.trim()} onClick={() => void send(false)}>{busy ? copy('Reading…', 'იკითხება…') : copy('Preview', 'გადახედვა')}</Button>}
        </>}>
        {preview ? <div className="tw-details">
            <p className="work-paste__summary"><strong>{changes ? copy(`${changes} ${changes === 1 ? 'thing' : 'things'} to set`, `${changes} დასაყენებელი`) : copy('Nothing to change', 'შესაცვლელი არაფერია')}</strong></p>
            <ol className="work-paste__lines">{preview.lines.map((line, index) => <li key={index} data-action={line.action === 'SAME' ? 'UNCHANGED' : line.action === 'ADDED' ? 'NEW' : 'UPDATED'}>
                <span className="work-paste__action">{copy(...ACTIONS[line.action])}</span>
                <span className="work-paste__title">{copy(...FIELDS[line.field])}</span>
                <span className="gk-faint work-paste__detail">{line.detail}</span>
            </li>)}</ol>
            {preview.problems.length > 0 && <ul className="gk-notice gk-notice--warning work-paste__problems">{preview.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        </div> : <div className="tw-details">
            <label htmlFor={id} className="gk-visually-hidden">{copy('The report, as text', 'ანგარიში ტექსტად')}</label>
            <textarea id={id} className="gk-input work-paste__text" rows={12} maxLength={20000} value={text} placeholder={REPORT_EXAMPLE} onChange={event => setText(event.target.value)} />
            <p className="work-paste__tools"><button type="button" className="work-link-button" onClick={() => setText(REPORT_EXAMPLE.replace('GK-12', item.key))}>{copy('Use the example', 'მაგალითის ჩასმა')}</button></p>
            <details className="tw-fold work-paste__format">
                <summary className="tw-section__title">{copy('Format', 'ფორმატი')}</summary>
                <p className="gk-faint work-paste__help">{copy('One marker per line: status:, branch:, pr:, commits:, percent:, summary:, tested:, question:. A line without one continues the line above. Status: planned, in progress, needs your look, accepted, live, blocked. A question’s quick answers come after “|”; none means yes or no. “summary:” becomes the history line.',
                    'თითო მარკერი თითო ხაზზე: status:, branch:, pr:, commits:, percent:, summary:, tested:, question:. უმარკერო ხაზი ზემოთას აგრძელებს. სტატუსი: planned, in progress, needs your look, accepted, live, blocked. კითხვის სწრაფი პასუხები „|“-ის შემდეგ; თუ არ არის, კი ან არა. „summary:“ ისტორიის ხაზი ხდება.')}</p>
            </details>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}
