import { useId, useState } from 'react';
import { CircleHelp, Eye } from 'lucide-react';
import { Button, Panel } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { answerQuestion, type Plan, type WorkItem, type WorkQuestion } from './api';
import { needsYou } from './needsYou';
import type { OpenQuestion } from './overviewApi';
import { ago } from './teamWorkWords';
import { KeyChip, StatusDot } from './WorkBits';

/** A question with its quick answers (yes and no when it names none) and a free one, answered right here. */
function Question({ question, onAnswered }: { question: WorkQuestion; onAnswered: () => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [free, setFree] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const options: [string, string][] = question.options.length ? question.options.map(option => [option, option]) : [['Yes', copy('Yes', 'კი')], ['No', copy('No', 'არა')]];
    const answer = async (value: string) => {
        setBusy(true); setError('');
        try { await answerQuestion(question.id, value); onAnswered(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That answer couldn’t be saved.', 'პასუხი ვერ შეინახა.'))); setBusy(false); }
    };
    return <div className="tw-needs__question">
        <p className="tw-needs__ask"><CircleHelp aria-hidden="true" /><span>{question.text}</span>
            <span className="gk-faint">{[question.askedBy?.name, ago(copy, question.at)].filter(Boolean).join(' · ')}</span></p>
        <div className="tw-needs__answers" role="group" aria-label={copy(`Answer: ${question.text}`, `პასუხი: ${question.text}`)}>
            {options.map(([value, label]) => <Button key={value} size="sm" disabled={busy} onClick={() => void answer(value)}>{label}</Button>)}
            {free === null ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => setFree('')}>{copy('Other…', 'სხვა…')}</Button>
                : <form className="tw-needs__free" onSubmit={event => { event.preventDefault(); if (free.trim()) void answer(free.trim()); }}>
                    <label htmlFor={id} className="gk-visually-hidden">{copy('Your answer', 'თქვენი პასუხი')}</label>
                    <input id={id} className="gk-input" autoFocus maxLength={2000} value={free} onChange={event => setFree(event.target.value)} />
                    <Button size="sm" variant="primary" type="submit" disabled={busy || !free.trim()}>{copy('Answer', 'პასუხი')}</Button>
                </form>}
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}

/**
 * What waits on Beqa, on top of the Overview: tasks that need his look, and the questions nobody has answered,
 * each with its quick answers working in place. Shown only when there is something.
 */
export function NeedsYou({ items, questions, planOf, onOpen, onAnswered }: {
    items: WorkItem[]; questions: OpenQuestion[]; planOf: Map<number, Plan>; onOpen: (taskId: number, stepId: number | null) => void; onAnswered: () => void;
}) {
    const copy = useJourneyCopy();
    const asked = new Map<number, WorkQuestion[]>();
    questions.forEach(open => asked.set(open.task.id, [...asked.get(open.task.id) ?? [], open.question]));
    // Questions first (they hold a worker up), then the newest to look at.
    const waiting = needsYou(items).sort((a, b) => Number(asked.has(b.id)) - Number(asked.has(a.id)) || b.updatedAt.localeCompare(a.updatedAt));
    if (!waiting.length) return null;
    const parentOf = new Map(items.map(item => [item.id, item]));
    const count = waiting.reduce((total, item) => total + (item.status === 'NEEDS_LOOK' ? 1 : 0) + (asked.get(item.id)?.length ?? item.openQuestions), 0);
    return <section className="tw-needs" aria-labelledby="tw-needs-title">
        <h2 id="tw-needs-title" className="tw-heading">{copy('Needs you', 'გელოდებათ')} <span className="gk-count">{count}</span></h2>
        <Panel flush><ul className="tw-needs__list">{waiting.map(item => {
            const parent = item.parentId != null ? parentOf.get(item.parentId) : undefined;
            const plan = planOf.get(parent?.id ?? item.id);
            const meta = [item.status === 'NEEDS_LOOK' && copy('Needs your look', 'სანახავია'), parent && copy(`step of ${parent.key}`, `${parent.key}-ის ნაბიჯი`), plan?.name].filter(Boolean).join(' · ');
            return <li key={item.id} className="tw-needs__item" data-status={item.status}>
                <button type="button" className="tw-needs__task" onClick={() => onOpen(parent?.id ?? item.id, parent ? item.id : null)}>
                    <StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-needs__name">{item.title}</span>
                    <span className="tw-needs__meta">{meta}</span>
                    {item.status === 'NEEDS_LOOK' && <span className="tw-needs__look"><Eye aria-hidden="true" />{copy('Look', 'ნახვა')}</span>}
                </button>
                {(asked.get(item.id) ?? []).map(question => <Question key={question.id} question={question} onAnswered={onAnswered} />)}
            </li>;
        })}</ul></Panel>
    </section>;
}
