import { ChevronRight } from 'lucide-react';
import { Panel } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Person, Plan, WorkItem } from './api';
import { needsYou } from './needsYou';
import { statusName } from './teamWorkWords';
import { KeyChip, StatusDot } from './WorkBits';

/**
 * "What Cotne is doing": the person's responsibility line, then in one place what waits on Beqa among their tasks,
 * what they are on now and what is blocked. Their recent activity is the agenda under it, already filtered to them.
 */
export function PersonView({ person, line, items, planOf, onOpen }: { person: Person; line?: string; items: WorkItem[]; planOf: Map<number, Plan>; onOpen: (taskId: number, stepId: number | null) => void }) {
    const copy = useJourneyCopy();
    const mine = items.filter(item => item.people.some(who => who.id === person.id));
    const parentOf = new Map(items.map(item => [item.id, item]));
    const name = person.name ?? '—';
    const lists: [string, WorkItem[], string][] = [
        [copy('Needs you', 'გელოდებათ'), needsYou(mine), copy('Nothing waits on you here.', 'აქ არაფერი გელოდებათ.')],
        [copy('In progress', 'მიმდინარე'), mine.filter(item => item.status === 'IN_PROGRESS'), copy('Nothing in progress.', 'არაფერი არ მიმდინარეობს.')],
        [copy('Blocked', 'დაბლოკილი'), mine.filter(item => item.status === 'BLOCKED'), copy('Nothing blocked.', 'არაფერი არ არის დაბლოკილი.')],
    ];
    return <section className="tw-person" aria-labelledby="tw-person-title">
        <h2 id="tw-person-title" className="tw-heading">{copy(`What ${name} is doing`, `რას აკეთებს ${name}`)}{line && <span className="tw-person__line">{line}</span>}
            <span className="gk-faint gk-num">{copy(`${mine.length} tasks`, `${mine.length} საქმე`)}</span></h2>
        <div className="tw-person__cols">{lists.map(([title, list, nothing]) => <Panel key={title} flush className="tw-person__col">
            <h3 className="tw-person__col-title">{title} <span className="gk-faint gk-num">{list.length || ''}</span></h3>
            {list.length === 0 ? <p className="gk-faint tw-person__nothing">{nothing}</p> : <ul className="tw-person__list">{list.map(item => {
                const parent = item.parentId != null ? parentOf.get(item.parentId) : undefined;
                const plan = planOf.get(parent?.id ?? item.id);
                return <li key={item.id}><button type="button" className="tw-person__row" onClick={() => onOpen(parent?.id ?? item.id, parent ? item.id : null)}>
                    <StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-person__name" title={item.title}>{item.description ?? item.title}</span>
                    <span className="tw-person__meta">{[item.openQuestions > 0 && copy(item.openQuestions === 1 ? '1 question' : `${item.openQuestions} questions`, `${item.openQuestions} კითხვა`), item.status === 'NEEDS_LOOK' && statusName(copy, item.status), plan?.name].filter(Boolean).join(' · ')}</span>
                    <ChevronRight className="tw-needs__arrow" aria-hidden="true" />
                </button></li>;
            })}</ul>}
        </Panel>)}</div>
    </section>;
}
