import { useId, useState, type ReactNode } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeFundraiser, postFundraiserUpdate, reportAmount, startFundraiser, type ProjectDetail } from './api';

const CATEGORIES: [string, string, string][] = [
    ['EQUIPMENT', 'Equipment and kit', 'აღჭურვილობა და ფორმა'], ['FACILITIES', 'Pitches and facilities', 'მოედნები და ინფრასტრუქტურა'],
    ['TRAVEL', 'Travel and competitions', 'მოგზაურობა და ტურნირები'], ['YOUTH', 'Youth football', 'ახალგაზრდული ფეხბურთი'],
    ['COMMUNITY', 'Community', 'საზოგადოება'], ['OTHER', 'Something else', 'სხვა'],
];

/** One field of a small form: its label over the input, and a quiet hint under it when it needs one. */
function Line({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
    const id = useId();
    return <div className="pj-field"><label className="pj-label" htmlFor={id}>{label}</label>{children(id)}{hint && <span className="pj-quiet">{hint}</span>}</div>;
}

function Frame({ title, busy, ready, saveLabel, error, onClose, onSave, children }: {
    title: string; busy: boolean; ready: boolean; saveLabel: string; error: string; onClose: () => void; onSave: () => void; children: ReactNode;
}) {
    const copy = useJourneyCopy();
    return <Dialog open size="md" className="pj-dialog" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy || !ready} onClick={onSave}>{busy ? copy('Saving…', 'ინახება…') : saveLabel}</Button></>}>
        <form className="pj-form" onSubmit={event => { event.preventDefault(); if (ready && !busy) onSave(); }}>{children}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}</form>
    </Dialog>;
}

function useSave(onSaved: (next: ProjectDetail) => void) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const save = async (action: () => Promise<ProjectDetail>) => {
        setBusy(true); setError('');
        try { onSaved(await action()); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    return { busy, error, save };
}

/** report_amount: what came in so far, on GoFundMe and elsewhere; shown as reported by the club. */
export function AmountDialog({ project, onClose, onSaved }: { project: ProjectDetail; onClose: () => void; onSaved: (next: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const f = project.fundraiser!;
    const [amount, setAmount] = useState(f.reportedAmount?.toString() ?? '');
    const [note, setNote] = useState('');
    const { busy, error, save } = useSave(onSaved);
    const value = Number(amount), ready = amount.trim() !== '' && Number.isFinite(value) && value >= 0;
    return <Frame title={copy('Update amount', 'თანხის განახლება')} busy={busy} ready={ready} saveLabel={copy('Save', 'შენახვა')} error={error} onClose={onClose}
        onSave={() => void save(() => reportAmount(project.club!.id, project.summary.id, f.version, value, note.trim() || undefined))}>
        <Line label={copy('Raised so far', 'შეგროვდა ჯერჯერობით')} hint={copy('Supporters see it as reported by the club.', 'მხარდამჭერები ხედავენ, როგორც კლუბის ცნობას.')}>
            {id => <input id={id} className="gk-input" inputMode="decimal" autoFocus value={amount} onChange={event => setAmount(event.target.value)} />}</Line>
        <Line label={copy('Note (optional)', 'შენიშვნა (არასავალდებულო)')}>{id => <input id={id} className="gk-input" maxLength={1000} value={note} placeholder={copy('Counted on GoFundMe on Friday', 'დათვლილია GoFundMe-ზე პარასკევს')} onChange={event => setNote(event.target.value)} />}</Line>
    </Frame>;
}

/** start_fundraiser and change_fundraiser: its words and its GoFundMe page; its name and goal are the project's. */
export function FundraiserDialog({ project, onClose, onSaved }: { project: ProjectDetail; onClose: () => void; onSaved: (next: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const f = project.fundraiser;
    const [words, setWords] = useState({ summary: '', description: '', beneficiary: '', useOfFunds: '', category: f ? '' : 'OTHER', donateUrl: f?.donateUrl ?? '' });
    const { busy, error, save } = useSave(onSaved);
    const set = (key: keyof typeof words) => (value: string) => setWords(current => ({ ...current, [key]: value }));
    // Only what was typed is sent: the rest of the fundraiser's words stay as they are.
    const sent = Object.fromEntries(Object.entries(words).filter(([key, value]) => value.trim() !== '' || (key === 'donateUrl' && f?.donateUrl)).map(([key, value]) => [key, value.trim()]));
    const action = () => f ? changeFundraiser(project.club!.id, project.summary.id, { ...sent, version: f.version }) : startFundraiser(project.club!.id, project.summary.id, sent);
    return <Frame title={f ? copy('Edit fundraiser', 'შეგროვების რედაქტირება') : copy('Start a fundraiser', 'შეგროვების დაწყება')} busy={busy} ready
        saveLabel={f ? copy('Save', 'შენახვა') : copy('Start as a draft', 'მონახაზად დაწყება')} error={error} onClose={onClose} onSave={() => void save(action)}>
        <p className="pj-quiet">{copy(`Named “${project.summary.goal}”, its goal the project’s target. Publishing needs a summary, what it is for and who it helps.`, `სახელი „${project.summary.goal}“, მიზანი — პროექტის თანხა. გამოსაქვეყნებლად საჭიროა მოკლე აღწერა, რისთვისაა და ვის ეხმარება.`)}</p>
        <Line label={copy('GoFundMe page', 'GoFundMe გვერდი')} hint={copy('The money is given there: https://www.gofundme.com/…', 'თანხა იქ გაიცემა: https://www.gofundme.com/…')}>
            {id => <input id={id} className="gk-input" type="url" maxLength={500} value={words.donateUrl} placeholder="https://www.gofundme.com/f/…" onChange={event => set('donateUrl')(event.target.value)} />}</Line>
        <Line label={copy('In one line', 'ერთი წინადადებით')}>{id => <input id={id} className="gk-input" maxLength={240} value={words.summary} placeholder={f ? copy('Keep as it is', 'დატოვეთ როგორც არის') : ''} onChange={event => set('summary')(event.target.value)} />}</Line>
        <Line label={copy('What it is for', 'რისთვისაა')}>{id => <textarea id={id} className="gk-input" rows={3} maxLength={5000} value={words.description} placeholder={f ? copy('Keep as it is', 'დატოვეთ როგორც არის') : ''} onChange={event => set('description')(event.target.value)} />}</Line>
        <Line label={copy('Who it helps', 'ვის ეხმარება')}>{id => <input id={id} className="gk-input" maxLength={240} value={words.beneficiary} placeholder={f ? copy('Keep as it is', 'დატოვეთ როგორც არის') : ''} onChange={event => set('beneficiary')(event.target.value)} />}</Line>
        <Line label={copy('How the money is used', 'როგორ დაიხარჯება')}>{id => <input id={id} className="gk-input" maxLength={2000} value={words.useOfFunds} placeholder={f ? copy('Keep as it is', 'დატოვეთ როგორც არის') : ''} onChange={event => set('useOfFunds')(event.target.value)} />}</Line>
        <Line label={copy('Kind', 'სახეობა')}>{id => <select id={id} className="gk-input" value={words.category} onChange={event => set('category')(event.target.value)}>
            {f && <option value="">{copy('Keep as it is', 'დატოვეთ როგორც არის')}</option>}{CATEGORIES.map(([value, en, ka]) => <option key={value} value={value}>{copy(en, ka)}</option>)}</select>}</Line>
    </Frame>;
}

/** post_fundraiser_update: news for the supporters, on the public fundraiser page. */
export function UpdateDialog({ project, onClose, onSaved }: { project: ProjectDetail; onClose: () => void; onSaved: (next: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const { busy, error, save } = useSave(onSaved);
    return <Frame title={copy('Post an update', 'სიახლის გამოქვეყნება')} busy={busy} ready={Boolean(title.trim() && body.trim())} saveLabel={copy('Post', 'გამოქვეყნება')} error={error} onClose={onClose}
        onSave={() => void save(() => postFundraiserUpdate(project.club!.id, project.summary.id, project.fundraiser!.version, title.trim(), body.trim()))}>
        <Line label={copy('Title', 'სათაური')}>{id => <input id={id} className="gk-input" autoFocus maxLength={120} value={title} onChange={event => setTitle(event.target.value)} />}</Line>
        <Line label={copy('Message', 'შეტყობინება')} hint={copy('Everyone who opens the fundraiser sees it.', 'ყველა, ვინც შეგროვებას გახსნის, დაინახავს.')}>
            {id => <textarea id={id} className="gk-input" rows={4} maxLength={3000} value={body} onChange={event => setBody(event.target.value)} />}</Line>
    </Frame>;
}
