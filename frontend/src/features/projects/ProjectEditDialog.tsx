import { useId, useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button, Chip } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeProject, type Currency, type ProjectChange, type ProjectDetail, type ProjectStatus } from './api';
import { statusWords } from './projectWords';

const CURRENCIES: Currency[] = ['GEL', 'EUR', 'GBP', 'USD'];
const PLACES: ProjectStatus[] = ['NOW', 'LATER', 'IDEA', 'DONE'];

/** change_project: the goal, what it is for, its squad, the day it should be done by, its money target and its place. */
export function ProjectEditDialog({ project, onClose, onSaved }: { project: ProjectDetail; onClose: () => void; onSaved: (next: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const ids = { goal: useId(), purpose: useId(), due: useId(), target: useId() };
    const { summary } = project;
    const [goal, setGoal] = useState(summary.goal);
    const [purpose, setPurpose] = useState(project.purpose ?? '');
    const [squad, setSquad] = useState<number | null>(summary.squad?.id ?? null);
    const [due, setDue] = useState(summary.dueOn ?? '');
    const [target, setTarget] = useState(summary.target ? String(summary.target.amount) : '');
    const [currency, setCurrency] = useState<Currency>(summary.target?.currency ?? 'GEL');
    const [status, setStatus] = useState<ProjectStatus>(summary.status);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const amount = Number(target);
    const ready = goal.trim() !== '' && (target.trim() === '' || (Number.isFinite(amount) && amount > 0));
    const save = async () => {
        const change: ProjectChange = { version: project.version, goal: goal.trim(), purpose: purpose.trim(), status };
        if (squad === null) change.clearSquad = true; else change.squadId = squad;
        if (due) change.dueOn = due; else change.clearDueOn = true;
        if (target.trim()) change.target = { amount, currency }; else change.clearTarget = true;
        setBusy(true); setError('');
        try { onSaved(await changeProject(project.club!.id, summary.id, change)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The project couldn’t be saved.', 'პროექტი ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="md" className="pj-dialog" title={copy('Edit project', 'პროექტის რედაქტირება')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy || !ready} onClick={() => void save()}>{busy ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</Button></>}>
        <form className="pj-form" onSubmit={event => { event.preventDefault(); if (ready && !busy) void save(); }}>
            <div className="pj-field"><label className="pj-label" htmlFor={ids.goal}>{copy('Goal', 'მიზანი')}</label>
                <input id={ids.goal} className="gk-input" maxLength={120} value={goal} onChange={event => setGoal(event.target.value)} /></div>
            <div className="pj-field"><label className="pj-label" htmlFor={ids.purpose}>{copy('What it is for (optional)', 'რისთვისაა (არასავალდებულო)')}</label>
                <input id={ids.purpose} className="gk-input" maxLength={400} value={purpose} onChange={event => setPurpose(event.target.value)} /></div>
            {project.choices && project.choices.squads.length > 0 && <div className="pj-field"><span className="pj-label">{copy('For a squad', 'გუნდისთვის')}</span>
                <div className="pj-chips"><Chip pressed={squad === null} onClick={() => setSquad(null)}>{copy('Whole club', 'მთელი კლუბი')}</Chip>
                    {project.choices.squads.map(option => <Chip key={option.id} pressed={squad === option.id} onClick={() => setSquad(option.id)}>{option.name}</Chip>)}</div></div>}
            <div className="pj-field-row">
                <div className="pj-field"><label className="pj-label" htmlFor={ids.due}>{copy('Done by (optional)', 'დასრულების თარიღი (არასავალდებულო)')}</label>
                    <input id={ids.due} type="date" className="gk-input" value={due} onChange={event => setDue(event.target.value)} /></div>
                <div className="pj-field"><label className="pj-label" htmlFor={ids.target}>{copy('Money target (optional)', 'თანხის მიზანი (არასავალდებულო)')}</label>
                    <span className="pj-money-input"><input id={ids.target} className="gk-input" inputMode="decimal" value={target} onChange={event => setTarget(event.target.value)} />
                        <select className="gk-input" aria-label={copy('Currency', 'ვალუტა')} value={currency} onChange={event => setCurrency(event.target.value as Currency)}>{CURRENCIES.map(code => <option key={code}>{code}</option>)}</select></span></div>
            </div>
            <div className="pj-field"><span className="pj-label">{copy('Where it is', 'სად არის')}</span>
                <div className="pj-chips">{PLACES.map(place => <Chip key={place} pressed={status === place} onClick={() => setStatus(place)}>{copy(...statusWords[place])}</Chip>)}</div></div>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </form>
    </Dialog>;
}
