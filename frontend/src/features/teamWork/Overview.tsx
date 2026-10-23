import type { ReactNode } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Folder, Layers, ListChecks, Plus } from 'lucide-react';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { isDone, type Person, type Plan, type PlanView, type WorkItem, type WorkNode, type WorkStatus } from './api';
import { TaskView, type PlaceOnPlan } from './TaskView';
import { progressWords, statusName } from './teamWorkWords';
import { planMatches, type Who } from './planPeople';
import { KeyChip, SmallChip, StatusDot, StatusFilter } from './WorkBits';

export type Period = 'week' | 'last' | 'earlier';
const DAY = 24 * 3600 * 1000;
const PLAN_ORDER = { NOW: 0, LATER: 1, FINISHED: 2 } as const;
const PERIODS: [Period, string, string][] = [['week', 'This week', 'ეს კვირა'], ['last', 'Last week', 'გასული კვირა'], ['earlier', 'Earlier', 'ადრე']];
const ADDED: Record<Period, [string, string]> = { week: ['Added this week', 'ამ კვირაში დამატებული'], last: ['Added last week', 'გასულ კვირაში დამატებული'], earlier: ['Added earlier', 'ადრე დამატებული'] };

/** Monday 00:00 of this week, local time. */
const weekStart = () => { const today = new Date(); today.setHours(0, 0, 0, 0); return today.getTime() - ((today.getDay() + 6) % 7) * DAY; };
const periodOf = (item: WorkItem, start: number): Period => { const at = Date.parse(item.createdAt); return at >= start ? 'week' : at >= start - 7 * DAY ? 'last' : 'earlier'; };
const inPeriod = (tasks: WorkNode[], period: Period) => { const start = weekStart(); return tasks.filter(node => periodOf(node.item, start) === period); };
const names = (people: Person[]) => people.map(person => person.name).filter(Boolean).join(', ');
const tally = (items: WorkItem[]) => ({ total: items.length, done: items.filter(item => isDone(item.status)).length });

/** A group as a small box that opens its own page: a week or a plan, and how many tasks are done and open. */
function GroupBox({ kind, name, tag, total, done, onClick }: { kind: 'period' | 'plan'; name: string; tag?: string; total: number; done: number; onClick: () => void }) {
    const copy = useJourneyCopy();
    const Icon = kind === 'period' ? CalendarDays : Folder;
    return <li><button type="button" className="tw-group" data-kind={kind} onClick={onClick}>
        <span className="tw-group__top"><Icon aria-hidden="true" /><span className="tw-group__name">{name}</span>{tag && <span className="tw-chip">{tag}</span>}<ChevronRight className="tw-group__go" aria-hidden="true" /></span>
        <span className="tw-group__counts gk-num">{total === 0 ? copy('Nothing yet', 'ჯერ არაფერი')
            : <>{kind === 'period' ? copy(`${total} added`, `${total} დაემატა`) : copy(total === 1 ? '1 task' : `${total} tasks`, `${total} საქმე`)} · <strong data-done={done > 0 || undefined}>{copy(`${done} done`, `${done} დასრულდა`)}</strong> · {copy(`${total - done} open`, `${total - done} ღია`)}</>}</span>
    </button></li>;
}

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

/**
 * A task as one card: its dot, key and name, percent and bar (or its status when nobody estimates a percent), how
 * many questions wait on Beqa, what it waits on, its plan, steps and people. Pressed, it opens across the
 * row to its details; a big task lists its steps there, and a step opens below it.
 */
export function TaskBox({ node, plan, expanded, actions }: { node: WorkNode; plan?: Plan; expanded: boolean; actions: TaskActions }) {
    const copy = useJourneyCopy();
    const { item, steps } = node;
    const { open, team, me, onToggle, onOpen, onAddStep, onSaved, onDeleted, placeOf, planName, candidates } = actions;
    const step = steps.find(step => step.id === open);
    const meta = [
        item.waitingOn.length > 0 && copy(`waits on ${item.waitingOn.map(ref => ref.key).join(', ')}`, `ელოდება: ${item.waitingOn.map(ref => ref.key).join(', ')}`),
        plan?.name, steps.length > 0 && copy(steps.length === 1 ? '1 step' : `${steps.length} steps`, `${steps.length} ნაბიჯი`), names(item.people),
    ].filter(Boolean).join(' · ');
    return <li className="tw-task" data-status={item.status} data-open={expanded || undefined} data-task={item.id} data-waiting={item.waitingOn.length > 0 || undefined}>
        <button type="button" className="tw-task__box" aria-expanded={expanded} onClick={() => onToggle(item.id)}>
            <span className="tw-task__top"><StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-task__name">{item.title}</span>{item.small && <SmallChip />}
                {item.openQuestions > 0 && <span className="tw-task__ask gk-num" title={copy('Questions for Beqa', 'კითხვები ბექასთვის')}>?{item.openQuestions}</span>}
                <span className="gk-num tw-task__percent">{item.percent != null ? progressWords(copy, item.percent) : statusName(copy, item.status)}</span>{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</span>
            <span className="tw-task__bar"><span style={{ width: `${item.percent ?? (isDone(item.status) ? 100 : 0)}%` }} /></span>
            <span className="tw-task__meta">{meta}</span>
        </button>
        {expanded && <div className="tw-task__body">
            <TaskView id={item.id} team={team} me={me} plan={plan?.name ?? planName} place={placeOf?.(item)} candidates={candidates} onOpen={id => onOpen(open === id ? null : id)} onAddStep={() => onAddStep(item)} onClose={() => onToggle(item.id)} onSaved={onSaved} onDeleted={onDeleted} />
            {step && <div className="tw-task__step">
                <p className="tw-task__step-title"><StatusDot status={step.status} /><KeyChip value={step.key} /><span className="gk-faint">{copy('Step', 'ნაბიჯი')}:</span> {step.title}</p>
                <TaskView key={step.id} id={step.id} team={team} me={me} plan={plan?.name ?? planName} candidates={candidates} onOpen={onOpen} onClose={() => onOpen(null)} onSaved={onSaved} onDeleted={() => { onOpen(null); onSaved(); }} />
            </div>}
        </div>}
    </li>;
}

export type PlanFilter = number | 'none' | null;
export interface TaskListProps {
    tasks: WorkNode[]; planOf: Map<number, Plan>; task: number | null; statuses: WorkStatus[]; showFinished: boolean; actions: TaskActions;
    /** The plans to filter by, with the tasks on each. */
    plans: Plan[]; planItems: Map<number, Set<number>>; plan: PlanFilter;
    onStatuses: (statuses: WorkStatus[]) => void; onShowFinished: (show: boolean) => void; onAddTask: () => void; onPlanFilter: (plan: PlanFilter) => void;
}

/** Tasks as cards with the status filter; done ones (accepted or live) wait behind "Show done" unless their status is chosen. */
function TaskList({ title, tasks, planOf, task, statuses, showFinished, actions, plans, planItems, plan, onStatuses, onShowFinished, onAddTask, onPlanFilter }: TaskListProps & { title: string }) {
    const copy = useJourneyCopy();
    const inProject = plan === null ? tasks : plan === 'none' ? tasks.filter(node => !planOf.has(node.item.id)) : tasks.filter(node => planItems.get(plan)?.has(node.item.id));
    const filtered = statuses.length ? inProject.filter(node => statuses.includes(node.item.status)) : inProject;
    const finished = statuses.length ? [] : filtered.filter(node => isDone(node.item.status));
    const shown = statuses.length || showFinished ? filtered : filtered.filter(node => !isDone(node.item.status) || node.item.id === task);
    return <section className="tw-block" aria-labelledby="tw-tasks">
        <div className="tw-bar-line">
            <h2 id="tw-tasks" className="tw-heading"><ListChecks aria-hidden="true" />{title} <span className="gk-faint gk-num">{filtered.length}</span></h2>
            <span className="tw-actions"><label className="gk-visually-hidden" htmlFor="tw-plan-filter">{copy('Plan', 'გეგმა')}</label>
                <select id="tw-plan-filter" className="gk-input tw-plan-filter" value={plan ?? ''} onChange={event => onPlanFilter(event.target.value === '' ? null : event.target.value === 'none' ? 'none' : Number(event.target.value))}>
                    <option value="">{copy('All plans', 'ყველა გეგმა')}</option>
                    {plans.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                    <option value="none">{copy('No plan', 'გეგმის გარეშე')}</option>
                </select>
                <StatusFilter chosen={statuses} onChange={onStatuses} /><Button size="sm" variant="ghost" onClick={onAddTask}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button></span>
        </div>
        {shown.length ? <ul className="tw-tasks">{shown.map(node => <TaskBox key={node.item.id} node={node} plan={planOf.get(node.item.id)} expanded={task === node.item.id} actions={actions} />)}</ul>
            : <p className="gk-muted tw-quiet">{filtered.length ? copy('Everything here is done.', 'აქ ყველაფერი მზადაა.') : copy('No tasks here.', 'აქ საქმეები არ არის.')}</p>}
        {finished.length > 0 && <span><button type="button" className="tw-link-button" aria-pressed={showFinished} onClick={() => onShowFinished(!showFinished)}>
            {showFinished ? copy('Hide done', 'მზა საქმეების დამალვა') : copy(`Show done (${finished.length})`, `მზა საქმეების ჩვენება (${finished.length})`)}</button></span>}
    </section>;
}

/**
 * Progress. On top the groups: the weeks, made from when tasks were added, and the plans people made, each
 * opening its own page. Below, every task as a card.
 */
export function Overview({ views, who, onWeek, onOpenPlan, onNewPlan, ...list }: TaskListProps & {
    views: Map<number, PlanView>; who: Who; onWeek: (period: Period) => void; onOpenPlan: (id: number) => void; onNewPlan: () => void;
}) {
    const copy = useJourneyCopy();
    const listed = list.plans.filter(plan => { const view = views.get(plan.id); return !view || planMatches(view, who); })
        .sort((a, b) => PLAN_ORDER[a.status] - PLAN_ORDER[b.status]);
    const periods = PERIODS.filter(([period]) => period !== 'earlier' || inPeriod(list.tasks, period).length > 0);
    return <>
        <section className="tw-block" aria-labelledby="tw-groups">
            <h2 id="tw-groups" className="tw-heading"><Layers aria-hidden="true" />{copy('Groups', 'ჯგუფები')}</h2>
            <ul className="tw-groups">
                {periods.map(([period, en, ka]) => <GroupBox key={period} kind="period" name={copy(en, ka)} {...tally(inPeriod(list.tasks, period).map(node => node.item))} onClick={() => onWeek(period)} />)}
                {listed.map(plan => <GroupBox key={plan.id} kind="plan" name={plan.name} {...tally(views.get(plan.id)?.tasks.map(node => node.item) ?? [])}
                    tag={plan.status === 'LATER' ? copy('Later', 'მოგვიანებით') : plan.status === 'FINISHED' ? copy('Finished', 'დასრულებული') : undefined} onClick={() => onOpenPlan(plan.id)} />)}
                <li><button type="button" className="tw-group tw-group--new" onClick={onNewPlan}><Plus aria-hidden="true" />{copy('New plan', 'ახალი გეგმა')}</button></li>
            </ul>
        </section>
        <TaskList title={copy('All tasks', 'ყველა საქმე')} {...list} />
    </>;
}

/** A week's own page: what was added that week, done and open, as the same task cards. */
export function WeekPage({ period, filter, onBack, ...list }: TaskListProps & { period: Period; filter: ReactNode; onBack: () => void }) {
    const copy = useJourneyCopy();
    const [, en, ka] = PERIODS.find(([key]) => key === period)!;
    const tasks = inPeriod(list.tasks, period);
    const { total, done } = tally(tasks.map(node => node.item));
    return <>
        <div className="tw-plan-head">
            <button type="button" className="tw-back" onClick={onBack}><ArrowLeft aria-hidden="true" />{copy('Back to overview', 'მიმოხილვაზე დაბრუნება')}</button>
            <div className="tw-plan-head__title">
                <h1><CalendarDays className="tw-plan-head__icon" aria-hidden="true" />{copy(en, ka)}</h1>
                <span className="tw-plan-head__people gk-num">{copy(`${total} added · ${done} done · ${total - done} open`, `${total} დაემატა · ${done} დასრულდა · ${total - done} ღია`)}</span>
            </div>
        </div>
        {filter}
        <TaskList title={copy(...ADDED[period])} {...list} tasks={tasks} />
    </>;
}
