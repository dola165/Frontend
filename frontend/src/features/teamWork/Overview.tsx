import type { ReactNode } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Folder, Layers, ListChecks, Plus } from 'lucide-react';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Person, Roadmap, RoadmapView, WorkItem, WorkNode, WorkStatus } from './api';
import { WorkPiece } from './WorkDetails';
import { planMatches, type Who } from './planPeople';
import { SmallChip, StatusDot, StatusFilter } from './WorkBits';

export type Period = 'week' | 'last' | 'earlier';
const DAY = 24 * 3600 * 1000;
const PROJECT_ORDER = { NOW: 0, LATER: 1, FINISHED: 2 } as const;
const PERIODS: [Period, string, string][] = [['week', 'This week', 'ეს კვირა'], ['last', 'Last week', 'გასული კვირა'], ['earlier', 'Earlier', 'ადრე']];
const ADDED: Record<Period, [string, string]> = { week: ['Added this week', 'ამ კვირაში დამატებული'], last: ['Added last week', 'გასულ კვირაში დამატებული'], earlier: ['Added earlier', 'ადრე დამატებული'] };

/** Monday 00:00 of this week, local time. */
const weekStart = () => { const today = new Date(); today.setHours(0, 0, 0, 0); return today.getTime() - ((today.getDay() + 6) % 7) * DAY; };
const periodOf = (item: WorkItem, start: number): Period => { const at = Date.parse(item.createdAt); return at >= start ? 'week' : at >= start - 7 * DAY ? 'last' : 'earlier'; };
const inPeriod = (tasks: WorkNode[], period: Period) => { const start = weekStart(); return tasks.filter(node => periodOf(node.item, start) === period); };
const names = (people: Person[]) => people.map(person => person.name).filter(Boolean).join(', ');
const tally = (items: WorkItem[]) => ({ total: items.length, done: items.filter(item => item.status === 'FINISHED').length });

/** A group as a small box that opens its own page: a week or a project, and how many tasks are done and open. */
function GroupBox({ kind, name, tag, total, done, onClick }: { kind: 'period' | 'project'; name: string; tag?: string; total: number; done: number; onClick: () => void }) {
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
    onToggle: (id: number) => void; onOpen: (id: number | null) => void; onAddStage: (parent: WorkItem) => void; onSaved: () => void;
}

/**
 * A task as one card: its dot, name, percent and bar, its project, stages and people. Pressed, it opens across the
 * row to its details; a big task lists its stages there, and a stage opens below it.
 */
function TaskBox({ node, project, expanded, actions }: { node: WorkNode; project?: Roadmap; expanded: boolean; actions: TaskActions }) {
    const copy = useJourneyCopy();
    const { item, parts } = node;
    const { open, team, me, onToggle, onOpen, onAddStage, onSaved } = actions;
    const stage = parts.find(part => part.id === open);
    const meta = [project?.name, parts.length > 0 && copy(parts.length === 1 ? '1 stage' : `${parts.length} stages`, `${parts.length} ეტაპი`), names(item.people)].filter(Boolean).join(' · ');
    return <li className="tw-task" data-status={item.status} data-open={expanded || undefined} data-task={item.id}>
        <button type="button" className="tw-task__box" aria-expanded={expanded} onClick={() => onToggle(item.id)}>
            <span className="tw-task__top"><StatusDot status={item.status} /><span className="tw-task__name">{item.title}</span>{item.small && <SmallChip />}
                <span className="gk-num tw-task__percent">{item.percent}%</span>{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</span>
            <span className="tw-task__bar"><span style={{ width: `${item.percent}%` }} /></span>
            <span className="tw-task__meta">{meta}</span>
        </button>
        {expanded && <div className="tw-task__body">
            <WorkPiece id={item.id} team={team} me={me} onOpen={id => onOpen(open === id ? null : id)} onAddPart={() => onAddStage(item)} onClose={() => onToggle(item.id)} onSaved={onSaved} />
            {stage && <div className="tw-task__stage">
                <p className="tw-task__stage-title"><StatusDot status={stage.status} /><span className="gk-faint">{copy('Stage', 'ეტაპი')}:</span> {stage.title}</p>
                <WorkPiece key={stage.id} id={stage.id} team={team} me={me} onOpen={onOpen} onClose={() => onOpen(null)} onSaved={onSaved} />
            </div>}
        </div>}
    </li>;
}

export interface TaskListProps {
    tasks: WorkNode[]; projectOf: Map<number, Roadmap>; task: number | null; statuses: WorkStatus[]; showFinished: boolean; actions: TaskActions;
    onStatuses: (statuses: WorkStatus[]) => void; onShowFinished: (show: boolean) => void; onAddTask: () => void;
}

/** Tasks as cards with the status filter; finished ones wait behind "Show finished" unless Finished is chosen. */
function TaskList({ title, tasks, projectOf, task, statuses, showFinished, actions, onStatuses, onShowFinished, onAddTask }: TaskListProps & { title: string }) {
    const copy = useJourneyCopy();
    const filtered = statuses.length ? tasks.filter(node => statuses.includes(node.item.status)) : tasks;
    const finished = statuses.length ? [] : filtered.filter(node => node.item.status === 'FINISHED');
    const shown = statuses.length || showFinished ? filtered : filtered.filter(node => node.item.status !== 'FINISHED' || node.item.id === task);
    return <section className="tw-block" aria-labelledby="tw-tasks">
        <div className="tw-bar-line">
            <h2 id="tw-tasks" className="tw-heading"><ListChecks aria-hidden="true" />{title} <span className="gk-faint gk-num">{filtered.length}</span></h2>
            <span className="tw-actions"><StatusFilter chosen={statuses} onChange={onStatuses} /><Button size="sm" variant="ghost" onClick={onAddTask}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button></span>
        </div>
        {shown.length ? <ul className="tw-tasks">{shown.map(node => <TaskBox key={node.item.id} node={node} project={projectOf.get(node.item.id)} expanded={task === node.item.id} actions={actions} />)}</ul>
            : <p className="gk-muted tw-quiet">{filtered.length ? copy('Everything here is finished.', 'აქ ყველაფერი დასრულებულია.') : copy('No tasks here.', 'აქ საქმეები არ არის.')}</p>}
        {finished.length > 0 && <span><button type="button" className="tw-link-button" aria-pressed={showFinished} onClick={() => onShowFinished(!showFinished)}>
            {showFinished ? copy('Hide finished', 'დასრულებულის დამალვა') : copy(`Show finished (${finished.length})`, `დასრულებულის ჩვენება (${finished.length})`)}</button></span>}
    </section>;
}

/**
 * Progress. On top the groups: the weeks, made from when tasks were added, and the projects people made, each
 * opening its own page. Below, every task as a card.
 */
export function Overview({ projects, views, who, onWeek, onOpenProject, onNewProject, ...list }: TaskListProps & {
    projects: Roadmap[]; views: Map<number, RoadmapView>; who: Who; onWeek: (period: Period) => void; onOpenProject: (id: number) => void; onNewProject: () => void;
}) {
    const copy = useJourneyCopy();
    const listed = projects.filter(project => { const view = views.get(project.id); return !view || planMatches(view, who); })
        .sort((a, b) => PROJECT_ORDER[a.status] - PROJECT_ORDER[b.status]);
    const periods = PERIODS.filter(([period]) => period !== 'earlier' || inPeriod(list.tasks, period).length > 0);
    return <>
        <section className="tw-block" aria-labelledby="tw-groups">
            <h2 id="tw-groups" className="tw-heading"><Layers aria-hidden="true" />{copy('Groups', 'ჯგუფები')}</h2>
            <ul className="tw-groups">
                {periods.map(([period, en, ka]) => <GroupBox key={period} kind="period" name={copy(en, ka)} {...tally(inPeriod(list.tasks, period).map(node => node.item))} onClick={() => onWeek(period)} />)}
                {listed.map(project => <GroupBox key={project.id} kind="project" name={project.name} {...tally(views.get(project.id)?.pieces.map(node => node.item) ?? [])}
                    tag={project.status === 'LATER' ? copy('Later', 'მოგვიანებით') : project.status === 'FINISHED' ? copy('Finished', 'დასრულებული') : undefined} onClick={() => onOpenProject(project.id)} />)}
                <li><button type="button" className="tw-group tw-group--new" onClick={onNewProject}><Plus aria-hidden="true" />{copy('New project', 'ახალი პროექტი')}</button></li>
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
            <button type="button" className="tw-back" onClick={onBack}><ArrowLeft aria-hidden="true" />{copy('Back to progress', 'პროგრესზე დაბრუნება')}</button>
            <div className="tw-plan-head__title">
                <h1><CalendarDays className="tw-plan-head__icon" aria-hidden="true" />{copy(en, ka)}</h1>
                <span className="tw-plan-head__people gk-num">{copy(`${total} added · ${done} done · ${total - done} open`, `${total} დაემატა · ${done} დასრულდა · ${total - done} ღია`)}</span>
            </div>
        </div>
        {filter}
        <TaskList title={copy(...ADDED[period])} {...list} tasks={tasks} />
    </>;
}
