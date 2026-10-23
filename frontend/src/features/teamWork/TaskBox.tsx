import { ChevronDown, ChevronUp, CircleHelp } from 'lucide-react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { isDone, type Person, type Plan, type WorkItem, type WorkNode } from './api';
import { TaskView, type PlaceOnPlan } from './TaskView';
import { progressWords, statusName } from './teamWorkWords';
import { KeyChip, SmallChip, StatusDot } from './WorkBits';

const names = (people: Person[]) => people.map(person => person.name).filter(Boolean).join(', ');

export interface TaskActions {
    open: number | null; team: Person[]; me: number | null;
    onToggle: (id: number) => void; onOpen: (id: number | null) => void; onAddStep: (parent: WorkItem) => void; onSaved: () => void; onDeleted: () => void;
    /** Every top-level task, for links from one to another. */
    candidates: WorkItem[];
    /** On a plan page: move the task up or down, or take it off the plan. */
    placeOf?: (item: WorkItem) => PlaceOnPlan;
    /** The plan page the cards are on, for Copy for AI; the cards themselves do not repeat it. */
    planName?: string;
}

/** A task opened: its details, and the step chosen from them below. Inside a card and in the task dialog. */
export function TaskBody({ node, plan, actions, framed = false, onClose }: { node: WorkNode; plan?: Plan; actions: TaskActions; framed?: boolean; onClose: () => void }) {
    const copy = useJourneyCopy();
    const { item, steps } = node;
    const { open, team, me, onOpen, onAddStep, onSaved, onDeleted, placeOf, planName, candidates } = actions;
    const step = steps.find(candidate => candidate.id === open);
    return <>
        <TaskView id={item.id} team={team} me={me} plan={plan?.name ?? planName} place={placeOf?.(item)} candidates={candidates} framed={framed} onOpen={id => onOpen(open === id ? null : id)} onAddStep={() => onAddStep(item)} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />
        {step && <div className="tw-task__step">
            <p className="tw-task__step-title"><StatusDot status={step.status} /><KeyChip value={step.key} /><span className="gk-faint">{copy('Step', 'ნაბიჯი')}:</span> {step.title}</p>
            <TaskView key={step.id} id={step.id} team={team} me={me} plan={plan?.name ?? planName} candidates={candidates} onOpen={onOpen} onClose={() => onOpen(null)} onSaved={onSaved} onDeleted={() => { onOpen(null); onSaved(); }} />
        </div>}
    </>;
}

/**
 * A task as one card: its dot, key and name (up to two lines, the whole name on hover), the bar, then one quiet line:
 * where it stands in words (or its progress), how many questions wait on Beqa, what it waits on, its plan, steps and
 * people. Pressed, it opens across the row to its details; a big task lists its steps there, and a step opens below.
 */
export function TaskBox({ node, plan, expanded, fresh = false, actions }: { node: WorkNode; plan?: Plan; expanded: boolean; fresh?: boolean; actions: TaskActions }) {
    const copy = useJourneyCopy();
    const { item, steps } = node;
    const meta = [
        item.waitingOn.length > 0 && copy(`waits on ${item.waitingOn.map(ref => ref.key).join(', ')}`, `ელოდება: ${item.waitingOn.map(ref => ref.key).join(', ')}`),
        plan?.name, steps.length > 0 && copy(steps.length === 1 ? '1 step' : `${steps.length} steps`, `${steps.length} ნაბიჯი`), names(item.people),
    ].filter(Boolean).join(' · ');
    return <li className="tw-task" data-status={item.status} data-open={expanded || undefined} data-task={item.id} data-waiting={item.waitingOn.length > 0 || undefined} data-fresh={fresh || undefined}>
        <button type="button" className="tw-task__box" aria-expanded={expanded} onClick={() => actions.onToggle(item.id)}>
            <span className="tw-task__top"><StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-task__name" title={item.title}>{item.title}</span>
                {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</span>
            <span className="tw-task__bar"><span style={{ width: `${item.percent ?? (isDone(item.status) ? 100 : 0)}%` }} /></span>
            <span className="tw-task__line">
                <span className="gk-num tw-task__percent">{item.percent != null && !isDone(item.status) ? progressWords(copy, item.percent) : statusName(copy, item.status)}</span>
                {item.small && <SmallChip />}
                {item.openQuestions > 0 && <span className="tw-task__ask gk-num" title={copy('Questions for Beqa', 'კითხვები ბექასთვის')}><CircleHelp aria-hidden="true" />{item.openQuestions}</span>}
                {meta && <span className="tw-task__meta">{meta}</span>}
            </span>
        </button>
        {expanded && <div className="tw-task__body"><TaskBody node={node} plan={plan} actions={actions} onClose={() => actions.onToggle(item.id)} /></div>}
    </li>;
}
