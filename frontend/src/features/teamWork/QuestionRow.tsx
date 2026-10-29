import { useId, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { answerQuestion, deleteQuestion, type Detail, type WorkQuestion } from './api';
import { ago } from './teamWorkWords';
import '../../components/work/work.css';

/**
 * One question for Beqa, the same on the task and in Needs you: the question, who asked and when, its quick answers
 * (yes and no when it names none) and "Other…", answered right here. Answered, it shows the answer and who gave it,
 * with Take back. On the task it can also be removed.
 */
export function QuestionRow({ question, removable = false, onDone }: { question: WorkQuestion; removable?: boolean; onDone: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [free, setFree] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const options: [string, string][] = question.options.length ? question.options.map(option => [option, option]) : [['Yes', copy('Yes', 'კი')], ['No', copy('No', 'არა')]];
    const run = async (action: () => Promise<Detail>) => {
        setBusy(true); setError('');
        try { onDone(await action()); setFree(null); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That answer couldn’t be saved.', 'პასუხი ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    const answer = (value: string) => void run(() => answerQuestion(question.id, value));
    const answered = question.answer != null;
    return <li className="tw-question" data-answered={answered || undefined}>
        <p className="tw-question__text"><CircleHelp aria-hidden="true" /><span className="tw-question__ask">{question.text}</span>
            <span className="tw-question__who">{[question.askedBy?.name, ago(copy, question.at)].filter(Boolean).join(' · ')}</span></p>
        {answered ? <div className="tw-question__answer">
            <strong>{question.answer}</strong>
            <span className="gk-faint">{[question.answeredBy?.name, question.answeredAt && ago(copy, question.answeredAt)].filter(Boolean).join(' · ')}</span>
            <button type="button" className="work-link-button" disabled={busy} onClick={() => answer('')}>{copy('Take back', 'უკან წაღება')}</button>
        </div> : <div className="tw-question__answers" role="group" aria-label={copy(`Answer: ${question.text}`, `პასუხი: ${question.text}`)}>
            {options.map(([value, label]) => <Button key={value} size="sm" disabled={busy} onClick={() => answer(value)}>{label}</Button>)}
            {free === null ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => setFree('')}>{copy('Other…', 'სხვა…')}</Button>
                : <form className="tw-question__free" onSubmit={event => { event.preventDefault(); if (free.trim()) answer(free.trim()); }}>
                    <label htmlFor={id} className="gk-visually-hidden">{copy('Your answer', 'თქვენი პასუხი')}</label>
                    <input id={id} className="gk-input" autoFocus maxLength={2000} value={free} onChange={event => setFree(event.target.value)} />
                    <Button size="sm" variant="primary" type="submit" disabled={busy || !free.trim()}>{copy('Answer', 'პასუხი')}</Button>
                </form>}
            {removable && <button type="button" className="work-icon-button tw-question__delete" aria-label={copy('Remove the question', 'კითხვის წაშლა')} disabled={busy} onClick={() => void run(() => deleteQuestion(question.id))}><X aria-hidden="true" /></button>}
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </li>;
}
