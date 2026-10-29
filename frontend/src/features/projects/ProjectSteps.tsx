import { useId, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Avatar, Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addStep, changeStep, removeStep, type ProjectDetail, type ProjectStep } from './api';
import { dayWord } from './projectWords';

/**
 * The project's steps, each waiting on one person and maybe a day. The person a step waits on ticks it off; whoever
 * runs the project also adds, gives, dates and removes steps.
 */
export function ProjectSteps({ project, onChanged }: { project: ProjectDetail; onChanged: (next: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const clubId = project.club?.id ?? 0, id = project.summary.id;
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<number | null>(null);
    const run = async (stepId: number | null, action: () => Promise<ProjectDetail>) => {
        setBusy(stepId ?? -1); setError('');
        try { onChanged(await action()); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(null); }
    };
    const runs = project.can.change;
    return <section className="pj-block" aria-labelledby="pj-steps">
        <div className="pj-block__head"><h2 className="pj-label" id="pj-steps">{copy('Steps', 'ნაბიჯები')}</h2>
            {project.summary.stepsTotal > 0 && <span className="pj-quiet">{copy(`${project.summary.stepsDone} of ${project.summary.stepsTotal} done`, `${project.summary.stepsDone} / ${project.summary.stepsTotal} შესრულებულია`)}</span>}</div>
        {project.steps.length === 0 && <p className="pj-quiet">{runs ? copy('Add the first step, or paste a plan.', 'დაამატეთ პირველი ნაბიჯი ან ჩასვით გეგმა.') : copy('No steps yet.', 'ნაბიჯები ჯერ არ არის.')}</p>}
        {project.steps.length > 0 && <ul className="pj-steps-list">{project.steps.map(step => <StepRow key={step.id} step={step} runs={runs} busy={busy === step.id}
            people={project.choices?.people ?? []}
            onTick={() => void run(step.id, () => changeStep(clubId, id, step.id, { version: step.version, done: !step.done }))}
            onGive={personId => void run(step.id, () => changeStep(clubId, id, step.id, personId ? { version: step.version, personId } : { version: step.version, clearPerson: true }))}
            onDay={value => void run(step.id, () => changeStep(clubId, id, step.id, value ? { version: step.version, day: value } : { version: step.version, clearDay: true }))}
            onRemove={() => void run(step.id, () => removeStep(clubId, id, step.id))} />)}</ul>}
        {runs && <AddStep people={project.choices?.people ?? []} busy={busy === -1} onAdd={(title, personId, day) => run(null, () => addStep(clubId, id, { title, personId, day }))} />}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </section>;
}

function StepRow({ step, runs, busy, people, onTick, onGive, onDay, onRemove }: {
    step: ProjectStep; runs: boolean; busy: boolean; people: { id: number; name: string }[];
    onTick: () => void; onGive: (personId: number | null) => void; onDay: (day: string | null) => void; onRemove: () => void;
}) {
    const copy = useJourneyCopy();
    const [editing, setEditing] = useState(false);
    const when = dayWord(copy, step.day);
    return <li className="pj-step" data-done={step.done || undefined} data-mine={step.mine && !step.done || undefined}>
        <button type="button" className="pj-tick" aria-pressed={step.done} disabled={!step.canChange || busy} onClick={onTick}
            aria-label={copy(`Done: ${step.title}`, `შესრულებულია: ${step.title}`)}>
            {step.done && <Check aria-hidden="true" />}
        </button>
        <span className="pj-step__title">{step.title}{step.mine && !step.done && <span className="pj-wait"><span className="pj-dot" data-tone="amber" aria-hidden="true" />{copy('Your step', 'თქვენი ნაბიჯი')}</span>}</span>
        {editing ? <span className="pj-step__edit">
            <select className="gk-input pj-step__who" aria-label={copy(`Who does ${step.title}`, `ვინ აკეთებს: ${step.title}`)} value={step.person?.id ?? ''} disabled={busy}
                onChange={event => onGive(event.target.value ? Number(event.target.value) : null)}>
                <option value="">{copy('Nobody yet', 'ჯერ არავინ')}</option>
                {step.person && !people.some(p => p.id === step.person!.id) && <option value={step.person.id}>{step.person.name}</option>}
                {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <input type="date" className="gk-input pj-step__day" aria-label={copy(`Day for ${step.title}`, `დღე: ${step.title}`)} value={step.day ?? ''} disabled={busy} onChange={event => onDay(event.target.value || null)} />
            <button type="button" className="work-icon-button" aria-label={copy(`Remove ${step.title}`, `წაშლა: ${step.title}`)} disabled={busy} onClick={onRemove}><Trash2 aria-hidden="true" /></button>
            <button type="button" className="work-icon-button" aria-label={copy('Done changing', 'ცვლილება დასრულდა')} onClick={() => setEditing(false)}><X aria-hidden="true" /></button>
        </span> : <span className="pj-step__who-read">
            {step.person ? <><Avatar src={step.person.avatarUrl} name={step.person.name} size={20} /><span>{step.person.name.split(' ')[0]}</span></> : runs && <span className="pj-quiet">{copy('Nobody yet', 'ჯერ არავინ')}</span>}
            {when && <span className="pj-quiet">{when}</span>}
            {runs && <button type="button" className="work-icon-button pj-step__open" aria-label={copy(`Change ${step.title}`, `შეცვლა: ${step.title}`)} onClick={() => setEditing(true)}><Pencil aria-hidden="true" /></button>}
        </span>}
    </li>;
}

function AddStep({ people, busy, onAdd }: { people: { id: number; name: string }[]; busy: boolean; onAdd: (title: string, personId: number | null, day: string | null) => Promise<void> }) {
    const copy = useJourneyCopy();
    const titleId = useId();
    const [title, setTitle] = useState('');
    const [person, setPerson] = useState('');
    const [day, setDay] = useState('');
    const add = async () => { await onAdd(title.trim(), person ? Number(person) : null, day || null); setTitle(''); setPerson(''); setDay(''); };
    return <form className="pj-add-step" onSubmit={event => { event.preventDefault(); if (title.trim() && !busy) void add(); }}>
        <label className="gk-visually-hidden" htmlFor={titleId}>{copy('New step', 'ახალი ნაბიჯი')}</label>
        <input id={titleId} className="gk-input" maxLength={120} value={title} placeholder={copy('Add a step', 'ნაბიჯის დამატება')} onChange={event => setTitle(event.target.value)} />
        <select className="gk-input" aria-label={copy('Who does it', 'ვინ აკეთებს')} value={person} onChange={event => setPerson(event.target.value)}>
            <option value="">{copy('Nobody yet', 'ჯერ არავინ')}</option>
            {people.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        <input type="date" className="gk-input" aria-label={copy('Day', 'დღე')} value={day} onChange={event => setDay(event.target.value)} />
        <Button size="sm" type="submit" disabled={busy || !title.trim()}><Plus aria-hidden="true" />{copy('Add', 'დამატება')}</Button>
    </form>;
}
