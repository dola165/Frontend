import { useId, useState } from 'react';
import { Dialog } from '../../design/Dialog';
import { Button, Chip } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { startProject, type ProjectChoices, type ProjectClub, type ProjectDetail, type ProjectKind } from './api';
import { KINDS } from './projectWords';

/**
 * start_project: a kind and a name start it, nothing else is asked first. The kind only fills in the first steps.
 * Opened from a squad, the squad is chosen; from the club page's fundraising box, Raise money is.
 */
export function NewProjectDialog({ club, choices, kind: chosenKind, idea = false, squadId, onClose, onStarted }: {
    club: ProjectClub; choices: ProjectChoices | null; kind: ProjectKind | null; idea?: boolean; squadId: number | null; onClose: () => void; onStarted: (detail: ProjectDetail) => void;
}) {
    const copy = useJourneyCopy();
    const nameId = useId();
    const [kind, setKind] = useState<ProjectKind | null>(chosenKind ?? (idea ? null : 'RAISE_MONEY'));
    const [goal, setGoal] = useState('');
    const [squad, setSquad] = useState<number | null>(squadId && choices?.squads.some(s => s.id === squadId) ? squadId : null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const start = async () => {
        setBusy(true); setError('');
        try {
            onStarted(await startProject(club.id, { goal: goal.trim(), kind: kind ?? undefined, squadId: squad, status: idea ? 'IDEA' : 'NOW', language: copy('en', 'ka') as 'en' | 'ka' }));
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('The project couldn’t start.', 'პროექტი ვერ დაიწყო.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="lg" className="pj-dialog" title={idea ? copy('New idea', 'ახალი იდეა') : copy('New project', 'ახალი პროექტი')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant="primary" disabled={busy || !goal.trim()} onClick={() => void start()}>{busy ? copy('Starting…', 'იწყება…') : idea ? copy('Keep the idea', 'იდეის შენახვა') : copy('Start project', 'პროექტის დაწყება')}</Button></>}>
        <form className="pj-form" onSubmit={event => { event.preventDefault(); if (goal.trim() && !busy) void start(); }}>
            <div className="pj-kinds" role="radiogroup" aria-label={copy('What it is for', 'რისთვისაა')}>
                {KINDS.map(entry => <button key={entry.kind} type="button" role="radio" aria-checked={kind === entry.kind} className="pj-kind"
                    onClick={() => setKind(current => current === entry.kind && idea ? null : entry.kind)}>
                    <span className="pj-kind__head"><entry.icon aria-hidden="true" /><strong>{copy(...entry.name)}</strong></span>
                    <span className="pj-kind__line">{copy(...entry.line)}</span>
                    <span className="pj-steps" aria-hidden="true">{entry.steps.map(step => <span key={step[0]}>{copy(...step)}</span>)}</span>
                </button>)}
            </div>
            <div className="pj-field">
                <label className="pj-label" htmlFor={nameId}>{copy('Name', 'სახელი')}</label>
                <input id={nameId} className="gk-input" maxLength={120} autoFocus value={goal} placeholder={copy('New kit for U12', 'ახალი ფორმა U12-ისთვის')} onChange={event => setGoal(event.target.value)} />
            </div>
            {choices && choices.squads.length > 0 && <div className="pj-field">
                <span className="pj-label">{copy('For a squad (optional)', 'გუნდისთვის (არასავალდებულო)')}</span>
                <div className="pj-chips">
                    <Chip pressed={squad === null} onClick={() => setSquad(null)}>{copy('Whole club', 'მთელი კლუბი')}</Chip>
                    {choices.squads.map(option => <Chip key={option.id} pressed={squad === option.id} onClick={() => setSquad(option.id)}>{option.name}</Chip>)}
                </div>
            </div>}
            <p className="pj-quiet">{copy('A target, a date and people can come later.', 'მიზნის თანხა, თარიღი და ხალხი შემდეგ დაემატება.')}</p>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </form>
    </Dialog>;
}
