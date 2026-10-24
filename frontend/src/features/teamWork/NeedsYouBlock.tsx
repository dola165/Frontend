import { ChevronRight } from 'lucide-react';
import { Panel } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Plan, WorkItem, WorkQuestion } from './api';
import { needsYou } from './needsYou';
import type { OpenQuestion } from './overviewApi';
import { QuestionRow } from './QuestionRow';
import { statusName } from './teamWorkWords';
import { useFresh } from './useFresh';
import { KeyChip, StatusDot } from './WorkBits';

/**
 * What waits on Beqa, on top of the Overview: tasks that need his look and tasks with questions nobody has answered.
 * Each row is a dot, the task, what it waits for in words and an arrow; its questions answer right under it, with
 * the same row as the task page. Shown only when there is something; a row that just arrived is marked for a moment.
 */
export function NeedsYou({ items, questions, planOf, onOpen, onAnswered }: {
    items: WorkItem[]; questions: OpenQuestion[]; planOf: Map<number, Plan>; onOpen: (taskId: number, stepId: number | null) => void; onAnswered: () => void;
}) {
    const copy = useJourneyCopy();
    const asked = new Map<number, WorkQuestion[]>();
    questions.forEach(open => asked.set(open.task.id, [...asked.get(open.task.id) ?? [], open.question]));
    // Questions first (they hold a worker up), then the newest to look at.
    const waiting = needsYou(items).sort((a, b) => Number(asked.has(b.id)) - Number(asked.has(a.id)) || b.updatedAt.localeCompare(a.updatedAt));
    const fresh = useFresh(waiting.map(item => `${item.id}:${item.status}:${item.openQuestions}`));
    if (!waiting.length) return null;
    const parentOf = new Map(items.map(item => [item.id, item]));
    const count = waiting.reduce((total, item) => total + (item.status === 'NEEDS_LOOK' ? 1 : 0) + (asked.get(item.id)?.length ?? item.openQuestions), 0);
    return <section className="tw-needs" aria-labelledby="tw-needs-title">
        <h2 id="tw-needs-title" className="tw-heading">{copy('Needs you', 'გელოდებათ')} <span className="gk-count">{count}</span></h2>
        <Panel flush><ul className="tw-needs__list">{waiting.map(item => {
            const parent = item.parentId != null ? parentOf.get(item.parentId) : undefined;
            const plan = planOf.get(parent?.id ?? item.id);
            const open = asked.get(item.id)?.length ?? item.openQuestions;
            const meta = [parent && copy(`step of ${parent.key}`, `${parent.key}-ის ნაბიჯი`), plan?.name].filter(Boolean).join(' · ');
            const state = [item.status === 'NEEDS_LOOK' && statusName(copy, item.status),
                open > 0 && copy(open === 1 ? '1 question' : `${open} questions`, `${open} კითხვა`)].filter(Boolean).join(' · ');
            return <li key={item.id} className="tw-needs__item" data-status={item.status} data-fresh={fresh.has(`${item.id}:${item.status}:${item.openQuestions}`) || undefined}>
                <button type="button" className="tw-needs__task" onClick={() => onOpen(parent?.id ?? item.id, parent ? item.id : null)}>
                    <StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-needs__name" title={item.description ?? item.title}>{item.title}</span>
                    <span className="tw-needs__meta">{meta}</span>
                    <span className="tw-needs__state">{state}</span>
                    <ChevronRight className="tw-needs__arrow" aria-hidden="true" />
                </button>
                {asked.has(item.id) && <ul className="tw-questions__list tw-needs__questions">
                    {(asked.get(item.id) ?? []).map(question => <QuestionRow key={question.id} question={question} onDone={onAnswered} />)}
                </ul>}
            </li>;
        })}</ul></Panel>
    </section>;
}
