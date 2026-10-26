import { useEffect, useId, useState } from 'react';
import { ChevronDown, Plus, Rocket, SlidersHorizontal } from 'lucide-react';
import { Button, EmptyNote, PageHeader, Panel } from '../../design/primitives';
import { TurnOnNotificationsPrompt } from '../../components/notifications/TurnOnNotificationsPrompt';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Person, Plan, PlanView, WorkItem } from './api';
import { Agenda, AgendaToolbar } from './Agenda';
import { useAgendaFilter, type AgendaLayout } from './useAgendaFilter';
import { nodesOf, taskMatches, type AgendaFilter } from './agendaRows';
import { NeedsYou } from './NeedsYouBlock';
import { GoneRows, LayoutSwitch, LiveDialog, NowSection, TaskList } from './NowLists';
import { fetchOpenQuestions, type OpenQuestion } from './overviewApi';
import { PersonView } from './PersonView';
import { PlanRow } from './PlanRow';
import { usePins } from './usePins';
import { TaskMenuProvider } from './TaskMenuProvider';
import { TaskDialog, type TaskActions } from './TaskDialog';
import { statusName } from './teamWorkWords';
import './team-work-agenda.css';
import './team-work-now.css';

/**
 * The filters folded to one small line that says what they are set to ("All plans · Everyone · By day"); pressed, the
 * toolbar opens under it. See what's live sits beside it. The filters themselves stay in the link.
 */
function FilterLine({ plans, team, lines, filter, layout, onChange, onLayout, onSeeLive }: {
    plans: Plan[]; team: Person[]; lines: Map<number, string>; filter: AgendaFilter; layout: AgendaLayout;
    onChange: (change: Partial<AgendaFilter>) => void; onLayout: (layout: AgendaLayout) => void; onSeeLive: () => void;
}) {
    const copy = useJourneyCopy();
    const id = useId();
    const [open, setOpen] = useState(false);
    const plan = filter.plan === 'none' ? copy('No plan', 'გეგმის გარეშე') : typeof filter.plan === 'number' ? plans.find(candidate => candidate.id === filter.plan)?.name ?? copy('One plan', 'ერთი გეგმა') : copy('All plans', 'ყველა გეგმა');
    const who = filter.who === 'team' ? copy('Whole team', 'მთელი გუნდი') : typeof filter.who === 'number' ? team.find(person => person.id === filter.who)?.name ?? '—' : copy('Everyone', 'ყველა');
    const summary = [plan, who, ...filter.statuses.map(status => statusName(copy, status)), layout === 'list' ? copy('List', 'სია') : copy('By day', 'დღეებით')].join(' · ');
    return <div className="tw-filters">
        <div className="tw-filters__line">
            <button type="button" className="tw-filters__toggle" aria-expanded={open} aria-controls={id} aria-label={copy(`Filters: ${summary}`, `ფილტრები: ${summary}`)} onClick={() => setOpen(value => !value)}>
                <SlidersHorizontal aria-hidden="true" /><span>{summary}</span><ChevronDown aria-hidden="true" />
            </button>
            <button type="button" className="tw-link-button tw-work-bar__live" onClick={onSeeLive}><Rocket aria-hidden="true" />{copy('See what’s live', 'ნახეთ, რა არის ლაივზე')}</button>
        </div>
        {open && <div id={id} className="tw-work-bar">
            <LayoutSwitch layout={layout} onChange={onLayout} />
            <AgendaToolbar plans={plans} team={team} lines={lines} filter={filter} onChange={onChange} />
        </div>}
    </div>;
}

/**
 * Overview: the plans in one row (your pins first), what waits on you, then, filtered by one folded line, Now (every
 * task in progress or blocked, however old), what happened day by day as cards, and live and cancelled work as grey
 * rows at the very bottom. "List" shows the same tasks one per line instead. Filtered to one person, "What X is
 * doing" (their Now note and open tasks) takes the place of what waits on you. Tasks open in a panel over it;
 * findings (Ideas, Waiting) stay in their own places.
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

    return <TaskMenuProvider pins={pins}><div className="tw-overview">
        {header}
        <TurnOnNotificationsPrompt />
        {questionsError && <div className="gk-notice gk-notice--danger" role="alert"><span>{questionsError}</span><Button size="sm" onClick={() => setRetry(value => value + 1)}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
        {pins.error && <p className="gk-notice gk-notice--danger" role="alert">{pins.error}</p>}
        {!person && <PlanRow pins={pins} plans={plans} nodes={nodes} onOpenPlan={onOpenPlan} onOpen={open} onNewPlan={onNewPlan} />}
        {person ? <PersonView person={person} line={person.id != null ? lines.get(person.id) : undefined} items={work} planOf={planOf} team={team} me={me} onOpen={open} />
            : <NeedsYou items={work} questions={questions} planOf={planOf} onOpen={open} onAnswered={onChanged} />}
        <FilterLine plans={plans} team={team} lines={lines} filter={filter} layout={layout} onChange={change} onLayout={setLayout} onSeeLive={() => setSeeLive(true)} />
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
    </div></TaskMenuProvider>;
}
