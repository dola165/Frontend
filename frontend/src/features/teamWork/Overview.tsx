import { useEffect, useState } from 'react';
import { CornerDownRight, Folder, Pin, Plus, Rocket } from 'lucide-react';
import { Button, EmptyNote, PageHeader, Panel } from '../../design/primitives';
import { TurnOnNotificationsPrompt } from '../../components/notifications/TurnOnNotificationsPrompt';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { openCount, type Person, type Plan, type PlanView, type WorkItem, type WorkNode } from './api';
import { Agenda, AgendaToolbar } from './Agenda';
import { useAgendaFilter } from './useAgendaFilter';
import { nodesOf, taskMatches } from './agendaRows';
import { NeedsYou } from './NeedsYouBlock';
import { GoneRows, LayoutSwitch, LiveDialog, NowSection, TaskList } from './NowLists';
import { fetchOpenQuestions, type OpenQuestion } from './overviewApi';
import { PersonView } from './PersonView';
import { sortPlans } from './planSteps';
import { UnpinButton } from './pins';
import { usePins, type Pins } from './usePins';
import { TaskDialog, type TaskActions } from './TaskDialog';
import { statusName } from './teamWorkWords';
import { KeyChip, StatusDot } from './WorkBits';
import './team-work-agenda.css';
import './team-work-now.css';

/** Your pins, plans first in the order you pinned them, each opening its plan or task: its name in bold, what it is for beside it. */
function Pinned({ pins, plans, nodes, planOf, onOpenPlan, onOpen }: { pins: Pins; plans: Plan[]; nodes: Map<number, WorkNode>; planOf: Map<number, Plan>; onOpenPlan: (id: number) => void; onOpen: (taskId: number, stepId: number | null) => void }) {
    const copy = useJourneyCopy();
    const rows = pins.pins.flatMap(pin => {
        const plan = pin.planId != null ? plans.find(candidate => candidate.id === pin.planId) : undefined;
        if (plan) return [<li key={`p${pin.id}`} className="tw-pinned__row">
            <button type="button" className="tw-pinned__open" onClick={() => onOpenPlan(plan.id)}>
                <Folder className="tw-pinned__plan" aria-hidden="true" /><span className="tw-pinned__name">{plan.name}</span>{plan.purpose && <span className="tw-pinned__sub">{plan.purpose}</span>}
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
                <StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-pinned__name">{item.title}</span>{item.description && <span className="tw-pinned__sub">{item.description}</span>}
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

/** The plans, each by its name in bold, then what it is for and what is still open; a plan inside a plan sits under its parent. */
function PlanLinks({ plans, onOpenPlan, onNewPlan }: { plans: Plan[]; onOpenPlan: (id: number) => void; onNewPlan: () => void }) {
    const copy = useJourneyCopy();
    const ids = new Set(plans.map(plan => plan.id));
    return <nav className="tw-plan-links" aria-label={copy('Plans', 'გეგმები')}>
        <ul>
            {sortPlans(plans).map(plan => <li key={plan.id} data-child={plan.partOf && ids.has(plan.partOf.id) ? '' : undefined}><button type="button" data-status={plan.status} onClick={() => onOpenPlan(plan.id)}>
                <span className="tw-plan-links__title">{plan.partOf && ids.has(plan.partOf.id) ? <CornerDownRight aria-hidden="true" /> : <Folder aria-hidden="true" />}<span>{plan.name}</span></span>
                <span className="tw-plan-links__line"><span className="tw-plan-links__purpose" data-missing={plan.purpose ? undefined : ''}>{plan.purpose ?? copy('Write what this plan is for', 'დაწერეთ, რისთვისაა ეს გეგმა')}</span>
                    <span className="tw-plan-links__open gk-num">{plan.status === 'FINISHED' ? copy('finished', 'დასრულდა') : plan.live ? copy('live', 'ლაივზეა') : plan.taskCount === 0 ? `${plan.percent}%` : copy(`${openCount(plan)} open`, `${openCount(plan)} ღია`)}</span></span>
            </button></li>)}
            <li><button type="button" className="tw-plan-links__new" onClick={onNewPlan}><Plus aria-hidden="true" />{copy('New plan', 'ახალი გეგმა')}</button></li>
        </ul>
    </nav>;
}

/**
 * Overview: what waits on you, your pins and the plans on top; then, filtered by one toolbar, Now (every open task,
 * however old), what happened day by day as cards, and live and cancelled work as grey rows at the very bottom. "List"
 * shows the same tasks one per line instead. Filtered to one person, "What X is doing" (their Now note and open
 * tasks) comes first. Tasks open in a panel over it; findings (Ideas, Waiting) stay in their own places.
 */
export function Overview({ items, findings, plans, views, planOf, team, lines, me, revision, task, actions, starting, onAddTask, onNewPlan, onOpenPlan, onLoadStarter, onChanged }: {
    items: WorkItem[]; findings: Set<number>; plans: Plan[]; views: Map<number, PlanView>; planOf: Map<number, Plan>; team: Person[]; lines: Map<number, string>; me: number | null; revision: number;
    task: number | null; actions: TaskActions; starting: boolean;
    onAddTask: () => void; onNewPlan: () => void; onOpenPlan: (id: number) => void; onLoadStarter: () => void; onChanged: () => void;
}) {
    const copy = useJourneyCopy();
    const { filter, change, open, layout, setLayout } = useAgendaFilter();
    const pins = usePins(revision);
    const [seeLive, setSeeLive] = useState(false);
    const [questions, setQuestions] = useState<OpenQuestion[]>([]);
    const [questionsError, setQuestionsError] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        fetchOpenQuestions(controller.signal).then(next => { if (!controller.signal.aborted) { setQuestions(next); setQuestionsError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setQuestionsError(extractApiErrorMessage(failure, copy('The open questions could not load.', 'ღია კითხვები ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [revision, retry, copy]);

    const work = items.filter(item => !findings.has(item.id) && !(item.parentId != null && findings.has(item.parentId)));
    const nodes = nodesOf(work);
    const planItems = new Map(plans.map(plan => [plan.id, new Set(views.get(plan.id)?.tasks.map(node => node.item.id) ?? [])]));
    const tasks = [...nodes.values()].filter(node => taskMatches(node, filter, { planOf, planItems, team })).map(node => node.item);
    const opened = task != null ? nodes.get(task) : undefined;
    const person = typeof filter.who === 'number' ? team.find(candidate => candidate.id === filter.who) : undefined;
    const header = <PageHeader title={copy('Overview', 'მიმოხილვა')} subtitle={copy('What we’re building and fixing', 'რას ვაშენებთ და ვასწორებთ')}
        actions={<><Button size="sm" onClick={onNewPlan}>{copy('New plan', 'ახალი გეგმა')}</Button><Button variant="primary" size="sm" onClick={onAddTask}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button></>} />;

    if (plans.length === 0 && nodes.size === 0) return <>{header}<Panel flush><EmptyNote title={copy('No tasks yet', 'საქმეები ჯერ არ არის')}
        action={<div className="tw-empty-actions">
            <Button variant="primary" size="sm" onClick={onAddTask}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
            <button type="button" className="tw-link-button" disabled={starting} onClick={onLoadStarter}>{starting ? copy('Loading…', 'იტვირთება…') : copy('or load this week’s work', 'ან ამ კვირის საქმეების ჩატვირთვა')}</button>
        </div>} />
    </Panel></>;

    return <div className="tw-overview">
        {header}
        <TurnOnNotificationsPrompt />
        {questionsError && <div className="gk-notice gk-notice--danger" role="alert"><span>{questionsError}</span><Button size="sm" onClick={() => setRetry(value => value + 1)}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
        {person ? <PersonView person={person} line={person.id != null ? lines.get(person.id) : undefined} items={work} planOf={planOf} team={team} me={me} onOpen={open} />
            : <NeedsYou items={work} questions={questions} planOf={planOf} onOpen={open} onAnswered={onChanged} />}
        {pins.error && <p className="gk-notice gk-notice--danger" role="alert">{pins.error}</p>}
        {!person && <Pinned pins={pins} plans={plans} nodes={nodes} planOf={planOf} onOpenPlan={onOpenPlan} onOpen={open} />}
        {!person && <PlanLinks plans={plans} onOpenPlan={onOpenPlan} onNewPlan={onNewPlan} />}
        <div className="tw-work-bar">
            <LayoutSwitch layout={layout} onChange={setLayout} />
            <AgendaToolbar plans={plans} team={team} lines={lines} filter={filter} onChange={change} />
            <button type="button" className="tw-link-button tw-work-bar__live" onClick={() => setSeeLive(true)}><Rocket aria-hidden="true" />{copy('See what’s live', 'ნახეთ, რა არის ლაივზე')}</button>
        </div>
        {layout === 'list' ? <TaskList tasks={tasks} planOf={planOf} onOpen={open} /> : <>
            {!person && <NowSection tasks={tasks} planOf={planOf} onOpen={open} />}
            <section className="tw-block" aria-labelledby="tw-happened">
                <h2 id="tw-happened" className="tw-heading">{person ? copy('Recent activity', 'ბოლო აქტივობა') : copy('What happened', 'რა მოხდა')}</h2>
                <Agenda revision={revision} filter={filter} context={{ nodes, planOf, planItems, team }} exclude={findings} pinned={id => pins.pinned({ itemId: id })} onOpen={open}
                    onClear={() => change({ plan: null, who: null, statuses: [] })} />
            </section>
            <GoneRows tasks={tasks} planOf={planOf} onOpen={open} />
        </>}
        {seeLive && <LiveDialog tasks={work.filter(item => item.parentId == null)} plans={plans} planOf={planOf} onOpen={open} onOpenPlan={onOpenPlan} onClose={() => setSeeLive(false)} />}
        {opened && <TaskDialog node={opened} plan={planOf.get(opened.item.id)} actions={actions} pins={pins} onOpenPlan={onOpenPlan} />}
    </div>;
}
