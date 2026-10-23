import { useEffect, useState } from 'react';
import { Folder, Pin, Plus } from 'lucide-react';
import { Button, EmptyNote, PageHeader, Panel } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Person, Plan, PlanView, WorkItem, WorkNode } from './api';
import { Agenda, AgendaToolbar } from './Agenda';
import { useAgendaFilter } from './useAgendaFilter';
import { nodesOf } from './agendaRows';
import { NeedsYou } from './NeedsYouBlock';
import { fetchOpenQuestions, type OpenQuestion } from './overviewApi';
import { UnpinButton } from './pins';
import { usePins, type Pins } from './usePins';
import { TaskDialog } from './TaskDialog';
import type { TaskActions } from './TaskBox';
import { statusName } from './teamWorkWords';
import { KeyChip, StatusDot } from './WorkBits';
import './team-work-agenda.css';

const PLAN_ORDER = { NOW: 0, LATER: 1, FINISHED: 2 } as const;

/** Your pins, plans first in the order you pinned them, each opening its plan or task. */
function Pinned({ pins, plans, nodes, planOf, onOpenPlan, onOpen }: { pins: Pins; plans: Plan[]; nodes: Map<number, WorkNode>; planOf: Map<number, Plan>; onOpenPlan: (id: number) => void; onOpen: (taskId: number, stepId: number | null) => void }) {
    const copy = useJourneyCopy();
    const rows = pins.pins.flatMap(pin => {
        const plan = pin.planId != null ? plans.find(candidate => candidate.id === pin.planId) : undefined;
        if (plan) return [<li key={`p${pin.id}`} className="tw-pinned__row">
            <button type="button" className="tw-pinned__open" onClick={() => onOpenPlan(plan.id)}>
                <Folder className="tw-pinned__plan" aria-hidden="true" /><span className="tw-pinned__name">{plan.name}</span>
                <span className="tw-pinned__meta gk-num">{[copy(`${plan.inProgress} in progress · ${plan.toDo} to do · ${plan.done} done`, `${plan.inProgress} მიმდინარე · ${plan.toDo} გასაკეთებელი · ${plan.done} მზადაა`),
                    plan.needsYou > 0 && copy(`${plan.needsYou} need you`, `${plan.needsYou} გელოდებათ`)].filter(Boolean).join(' · ')}</span>
            </button>
            <UnpinButton pins={pins} target={{ planId: plan.id }} name={plan.name} />
        </li>];
        const node = pin.itemId != null ? nodes.get(pin.itemId) : undefined;
        if (!node) return [];
        const { item } = node;
        return [<li key={`t${pin.id}`} className="tw-pinned__row">
            <button type="button" className="tw-pinned__open" onClick={() => onOpen(item.id, null)}>
                <StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-pinned__name">{item.title}</span>
                <span className="tw-pinned__meta">{[statusName(copy, item.status), planOf.get(item.id)?.name].filter(Boolean).join(' · ')}</span>
            </button>
            <UnpinButton pins={pins} target={{ itemId: item.id }} name={item.title} />
        </li>];
    });
    if (!rows.length) return null;
    return <section className="tw-pinned" aria-labelledby="tw-pinned-title">
        <h2 id="tw-pinned-title" className="tw-heading"><Pin aria-hidden="true" />{copy('Pinned', 'მიმაგრებული')}</h2>
        <Panel flush><ul className="tw-pinned__list">{rows}</ul></Panel>
    </section>;
}

/** The plans as one quiet row of links, each with what is still open; finished plans last. */
function PlanLinks({ plans, onOpenPlan, onNewPlan }: { plans: Plan[]; onOpenPlan: (id: number) => void; onNewPlan: () => void }) {
    const copy = useJourneyCopy();
    const sorted = [...plans].sort((a, b) => PLAN_ORDER[a.status] - PLAN_ORDER[b.status]);
    return <nav className="tw-plan-links" aria-label={copy('Plans', 'გეგმები')}>
        <ul>
            {sorted.map(plan => <li key={plan.id}><button type="button" data-status={plan.status} onClick={() => onOpenPlan(plan.id)}>
                <Folder aria-hidden="true" /><span className="tw-plan-links__name">{plan.name}</span>
                <span className="tw-plan-links__open gk-num">{plan.status === 'FINISHED' ? copy('finished', 'დასრულდა') : copy(`${plan.taskCount - plan.done} open`, `${plan.taskCount - plan.done} ღია`)}</span>
            </button></li>)}
            <li><button type="button" className="tw-plan-links__new" onClick={onNewPlan}><Plus aria-hidden="true" />{copy('New plan', 'ახალი გეგმა')}</button></li>
        </ul>
    </nav>;
}

/**
 * Overview: what waits on you, your pins and the plans on top, then what happened, day by day. Tasks open in a
 * dialog over it; findings (Ideas, Waiting) stay in their own places.
 */
export function Overview({ items, findings, plans, views, planOf, team, revision, task, actions, starting, onAddTask, onNewPlan, onOpenPlan, onLoadStarter, onChanged }: {
    items: WorkItem[]; findings: Set<number>; plans: Plan[]; views: Map<number, PlanView>; planOf: Map<number, Plan>; team: Person[]; revision: number;
    task: number | null; actions: TaskActions; starting: boolean;
    onAddTask: () => void; onNewPlan: () => void; onOpenPlan: (id: number) => void; onLoadStarter: () => void; onChanged: () => void;
}) {
    const copy = useJourneyCopy();
    const { filter, change, open } = useAgendaFilter();
    const pins = usePins(revision);
    const [questions, setQuestions] = useState<OpenQuestion[]>([]);
    useEffect(() => {
        const controller = new AbortController();
        fetchOpenQuestions(controller.signal).then(next => { if (!controller.signal.aborted) setQuestions(next); }).catch(() => undefined);
        return () => controller.abort();
    }, [revision]);

    const work = items.filter(item => !findings.has(item.id) && !(item.parentId != null && findings.has(item.parentId)));
    const nodes = nodesOf(work);
    const planItems = new Map(plans.map(plan => [plan.id, new Set(views.get(plan.id)?.tasks.map(node => node.item.id) ?? [])]));
    const opened = task != null ? nodes.get(task) : undefined;
    const header = <PageHeader title={copy('Overview', 'მიმოხილვა')} subtitle={copy('What we’re building and fixing', 'რას ვაშენებთ და ვასწორებთ')}
        actions={<><Button size="sm" onClick={onNewPlan}>{copy('New plan', 'ახალი გეგმა')}</Button><Button variant="primary" size="sm" onClick={onAddTask}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button></>} />;

    if (plans.length === 0 && nodes.size === 0) return <>{header}<Panel flush><EmptyNote title={copy('Nothing here yet', 'აქ ჯერ არაფერია')}
        action={<div className="tw-empty-actions">
            <Button variant="primary" size="sm" onClick={onAddTask}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
            <Button size="sm" onClick={onNewPlan}>{copy('New plan', 'ახალი გეგმა')}</Button>
            <Button size="sm" disabled={starting} onClick={onLoadStarter}>{starting ? copy('Loading…', 'იტვირთება…') : copy('Load this week’s work', 'ამ კვირის საქმეების ჩატვირთვა')}</Button>
        </div>}>
        {copy('Tasks are what we have to do, small fixes next to big work with steps. A plan keeps related tasks together.', 'საქმეები არის ის, რაც უნდა გავაკეთოთ: პატარა შესწორებები და ნაბიჯებიანი დიდი საქმეები. გეგმა დაკავშირებულ საქმეებს აერთიანებს.')}
    </EmptyNote></Panel></>;

    return <div className="tw-overview">
        {header}
        <NeedsYou items={work} questions={questions} planOf={planOf} onOpen={open} onAnswered={onChanged} />
        {pins.error && <p className="gk-notice gk-notice--danger" role="alert">{pins.error}</p>}
        <Pinned pins={pins} plans={plans} nodes={nodes} planOf={planOf} onOpenPlan={onOpenPlan} onOpen={open} />
        <PlanLinks plans={plans} onOpenPlan={onOpenPlan} onNewPlan={onNewPlan} />
        <section className="tw-block" aria-labelledby="tw-happened">
            <div className="tw-bar-line">
                <h2 id="tw-happened" className="tw-heading">{copy('What happened', 'რა მოხდა')}</h2>
                <AgendaToolbar plans={plans} team={team} filter={filter} onChange={change} />
            </div>
            <Agenda revision={revision} filter={filter} context={{ nodes, planOf, planItems, team }} exclude={findings} pinned={id => pins.pinned({ itemId: id })} onOpen={open} />
        </section>
        {opened && <TaskDialog node={opened} plan={planOf.get(opened.item.id)} actions={actions} pins={pins} onOpenPlan={onOpenPlan} />}
    </div>;
}
