import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { RouteRecoveryPage } from '../../pages/RouteRecoveryPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changePlan, createPlan, createWork, fetchBoard, fetchPlan, fetchPlans, LIST_ORDER, STARTER_WORK, STATUSES, type Person, type WorkStatus, type PlanStatus, type Plan, type PlanView, type WorkItem, type WorkNode } from './api';
import { AddTaskDialog } from './TaskView';
import { IdeasPage } from './IdeasPage';
import { IDEAS, isHidden, isNewFor, isReservedName, WAITING, useFindingDetails } from './findings';
import { Overview, WeekPage, type Period, type TaskListProps } from './Overview';
import { PasteDialog } from './PasteDialog';
import { WaitingPage } from './WaitingPage';
import { PlanPage, type PlanDialog } from './PlanPage';
import { TeamPanel } from './TeamPanel';
import { TeamWorkDola } from './TeamWorkDola';
import { TeamWorkNav, type TeamWorkPlace } from './TeamWorkNav';
import { WhatChangedPage } from './WhatChangedPage';
import { CopyForAiDialog, NameFilter, PlanHistoryDialog } from './PlanBits';
import { nodeMatches, whoOf } from './planPeople';
import { needsYouCount } from './needsYou';
import './team-work.css';
import './team-work-layout.css';

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
const PLACES: TeamWorkPlace[] = ['ideas', 'waiting', 'changes', 'team'];
// Old links keep working: ?view=add|pending|updates, ?roadmap=, ?open= and ?project= are read as the new keys.
const OLD_PLACES: Record<string, TeamWorkPlace> = { add: 'ideas', pending: 'waiting', updates: 'changes' };
const OLD_KEYS: Record<string, string> = { roadmap: 'plan', open: 'step', project: 'in' };
const placeOf = (value: string | null): TeamWorkPlace => PLACES.find(place => place === value) ?? (value ? OLD_PLACES[value] : undefined) ?? 'overview';
const periodOf = (value: string | null): Period | null => value === 'week' || value === 'last' || value === 'earlier' ? value : null;
const PLAN_ORDER = { NOW: 0, LATER: 1, FINISHED: 2 } as const;

function NameDialog({ mode, current, onClose, onDone }: { mode: 'new' | 'copy' | 'rename'; current: Plan | null; onClose: () => void; onDone: (view: PlanView) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [name, setName] = useState(mode === 'rename' ? current?.name ?? '' : mode === 'copy' ? `${current?.name ?? ''} v2` : '');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const title = mode === 'copy' ? copy('Copy as new version', 'ასლი ახალ ვერსიად') : mode === 'rename' ? copy('Rename the plan', 'გეგმის სახელის შეცვლა') : copy('New plan', 'ახალი გეგმა');
    const save = async () => {
        if (!name.trim()) return;
        if (isReservedName(name)) { setError(copy('That name is kept for the team’s own lists.', 'ეს სახელი გუნდის სიებისთვისაა დაცული.')); return; }
        setBusy(true); setError('');
        try { onDone(mode === 'rename' && current ? await changePlan(current.id, { version: current.version, name: name.trim() }) : await createPlan(name.trim(), mode === 'copy' ? current?.id : undefined)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="sm" className="tw-dialog" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={mode === 'copy' ? copy('The same tasks in the same order. This version stays as it is, and you can go back to it.', 'იგივე საქმეები იგივე რიგით. ეს ვერსია უცვლელი რჩება და შეგიძლიათ დაუბრუნდეთ.') : undefined}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy || !name.trim()} onClick={() => void save()}>{copy('Save', 'შენახვა')}</Button></>}>
        <form className="tw-field" onSubmit={event => { event.preventDefault(); void save(); }}>
            <label htmlFor={id}>{copy('Name', 'სახელი')}</label>
            <input id={id} className="gk-input" autoFocus maxLength={80} value={name} placeholder={copy('Registration', 'რეგისტრაცია')} onChange={event => setName(event.target.value)} />
        </form>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}

/**
 * Team work: what the team is building and fixing. A small side bar holds the places: the overview (weeks and
 * plans, then every task), Add to listed (what people found), Waiting (findings waiting for a decision), staying
 * up to date, and the team. Team accounts only; for anyone else the page does not exist.
 */
export function TeamWorkPage() {
    const copy = useJourneyCopy();
    const me = useAuth().user?.id ?? null;
    const [params, setParams] = useSearchParams();
    const [listed, setListed] = useState<Plan[] | null>(null);
    const [views, setViews] = useState<Map<number, PlanView>>(new Map());
    const [items, setItems] = useState<WorkItem[]>([]);
    const [canManageTeam, setCanManageTeam] = useState(false);
    const [error, setError] = useState('');
    const [missing, setMissing] = useState(false);
    const [revision, setRevision] = useState(0);
    const [adding, setAdding] = useState<{ view?: PlanView; parent?: WorkItem; others: WorkItem[] } | null>(null);
    const [dialog, setDialog] = useState<PlanDialog | 'new' | null>(null);
    const [starting, setStarting] = useState(false);
    const place = placeOf(params.get('view'));
    const wanted = Number(params.get('plan') ?? params.get('roadmap')) || null;
    const open = Number(params.get('step') ?? params.get('open')) || null;
    const task = Number(params.get('task')) || null;
    const who = whoOf(params.get('who'));
    const reload = () => setRevision(value => value + 1);
    const set = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [old, key] of Object.entries(OLD_KEYS)) { const value = next.get(old); if (value !== null) { next.delete(old); if (!next.has(key)) next.set(key, value); } }
        for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
        setParams(next, { replace: true });
    };

    useEffect(() => {
        const controller = new AbortController();
        const live = () => !controller.signal.aborted;
        // Every task comes with the board; the plans say which plan each task is in and hold the ideas.
        Promise.all([fetchPlans(controller.signal), fetchBoard(controller.signal)]).then(([list, board]) => Promise.all(list.map(plan => fetchPlan(plan.id, controller.signal))).then(all => {
            if (!live()) return;
            setListed(list); setViews(new Map(all.map(next => [next.plan.id, next]))); setItems(board.items); setCanManageTeam(board.canManageTeam); setError('');
        })).catch(failure => {
            if (!live()) return;
            if (statusOf(failure) === 404) setMissing(true);
            else setError(extractApiErrorMessage(failure, copy('Team work could not load.', 'გუნდის სამუშაო ვერ ჩაიტვირთა.')));
        });
        return () => controller.abort();
    }, [revision, copy]);

    const viewNamed = (name: string) => { const plan = listed?.find(candidate => candidate.name === name); return plan && views.get(plan.id); };
    const ideas = viewNamed(IDEAS), waiting = viewNamed(WAITING);
    const { details, put } = useFindingDetails([ideas, waiting]);
    const plans = (listed ?? []).filter(plan => !isHidden(plan));
    const view = wanted ? views.get(wanted) ?? null : null;
    const team: Person[] = view?.team ?? [...views.values()][0]?.team ?? [];
    const findings = new Set([ideas, waiting].flatMap(found => found?.tasks.map(node => node.item.id) ?? []));
    const steps = new Map<number, WorkItem[]>();
    items.filter(item => item.parentId != null).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach(item => steps.set(item.parentId!, [...steps.get(item.parentId!) ?? [], item]));
    const allTasks = items.filter(item => item.parentId == null && !findings.has(item.id))
        .sort((a, b) => LIST_ORDER.indexOf(a.status) - LIST_ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt));
    const tasks: WorkNode[] = allTasks.map(item => ({ item, steps: steps.get(item.id) ?? [] })).filter(node => nodeMatches(node, who, team));
    const planOf = new Map<number, Plan>();
    [...plans].sort((a, b) => PLAN_ORDER[a.status] - PLAN_ORDER[b.status]).forEach(plan => views.get(plan.id)?.tasks.forEach(node => { if (!planOf.has(node.item.id)) planOf.set(node.item.id, plan); }));
    const planItems = new Map(plans.map(plan => [plan.id, new Set(views.get(plan.id)?.tasks.map(node => node.item.id) ?? [])]));
    // Task names in other plans, so Paste from AI can flag a plan pasted twice.
    const elsewhere = new Map(allTasks.filter(item => !view?.tasks.some(node => node.item.id === item.id)).map(item => [item.title.trim().toLowerCase(), planOf.get(item.id)?.name ?? copy('no plan', 'გეგმის გარეშე')]));

    const keep = (next: PlanView) => { setViews(current => new Map(current).set(next.plan.id, next)); setListed(current => current && [next.plan, ...current.filter(plan => plan.id !== next.plan.id)]); };
    const show = (next: PlanView) => { keep(next); set({ view: null, plan: String(next.plan.id), task: null }); };
    const savePlan = async (target: PlanView, change: { order?: number[]; status?: PlanStatus }) => {
        setError('');
        try { keep(await changePlan(target.plan.id, { version: target.plan.version, ...change })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The plan couldn’t be changed.', 'გეგმა ვერ შეიცვალა.'))); if (statusOf(failure) === 409) reload(); }
    };
    const startAdding = (target?: PlanView, parent?: WorkItem) => {
        const here = new Set(target?.tasks.map(node => node.item.id) ?? []);
        setAdding({ view: target, parent, others: target && !parent ? allTasks.filter(item => !here.has(item.id)) : [] });
    };
    const loadStarter = async () => {
        setStarting(true);
        try { for (const starter of STARTER_WORK) await createWork(starter); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Some work could not be added.', 'ზოგიერთი საქმე ვერ დაემატა.'))); }
        finally { setStarting(false); reload(); }
    };
    const openPlan = (id: number) => set({ view: null, plan: String(id), step: null, task: null, when: null });
    const setOpen = (id: number | null) => set({ step: id == null ? null : String(id) });
    const statuses = (params.get('status') ?? '').split(',').filter((value): value is WorkStatus => (STATUSES as readonly string[]).includes(value));
    const setStatuses = (next: WorkStatus[]) => set({ status: next.length ? next.join(',') : null, task: null, step: null });
    const go = (next: TeamWorkPlace) => set({ view: next === 'overview' ? null : next, plan: null, step: null, task: null, when: null });

    if (missing) return <RouteRecoveryPage />;
    const filter = (allLabel: string) => <NameFilter team={team} who={who} allLabel={allLabel} onChange={next => set({ who: next === null ? null : String(next), step: null, task: null })} />;
    const loading = <Panel flush><div className="gk-panel--pad" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div></Panel>;
    const findingProps = { details, team, me, open, onOpen: setOpen, onPut: put, onChanged: reload };
    const week = periodOf(params.get('when'));
    const inParam = params.get('in') ?? params.get('project');
    const actions = { open, team, me, candidates: allTasks, onOpen: setOpen, onSaved: reload, onDeleted: () => { set({ task: null, step: null }); reload(); },
        onAddStep: (parent: WorkItem) => startAdding(undefined, parent), onToggle: (id: number) => set({ task: task === id ? null : String(id), step: null }) };
    const taskList: TaskListProps = { tasks, planOf, task, statuses, showFinished: params.get('finished') === 'show', onStatuses: setStatuses, onAddTask: () => startAdding(),
        plans, planItems, plan: inParam === 'none' ? 'none' : Number(inParam) || null, onPlanFilter: next => set({ in: next === null ? null : String(next), task: null, step: null }),
        onShowFinished: showFinished => set({ finished: showFinished ? 'show' : null }), actions };
    let main: ReactNode;
    if (!listed) main = !error && loading;
    else if (place === 'changes') main = <WhatChangedPage />;
    else if (place === 'team') main = <TeamPanel canManage={canManageTeam} />;
    else if (place === 'ideas') main = <IdeasPage ideas={ideas} waiting={waiting} {...findingProps} />;
    else if (place === 'waiting') main = <WaitingPage waiting={waiting} plans={plans} views={views} {...findingProps} />;
    else if (view) main = <PlanPage view={view} who={who} task={task} filter={filter(copy('Everything', 'ყველაფერი'))} statuses={statuses} actions={actions} onStatuses={setStatuses} onBack={() => set({ plan: null, step: null, task: null })}
        onChangePlan={change => void savePlan(view, change)} onAdd={parent => startAdding(view, parent)} onDialog={setDialog} />;
    else if (week) main = <WeekPage period={week} filter={filter(copy('Everyone', 'ყველა'))} onBack={() => set({ when: null, task: null, step: null })} {...taskList} />;
    else main = <>
        <PageHeader title={copy('Overview', 'მიმოხილვა')} subtitle={copy('What we’re building and fixing', 'რას ვაშენებთ და ვასწორებთ')} />
        {plans.length === 0 && allTasks.length === 0 ? <Panel flush><EmptyNote title={copy('Nothing here yet', 'აქ ჯერ არაფერია')}
            action={<div className="tw-empty-actions">
                <Button variant="primary" size="sm" onClick={() => startAdding()}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
                <Button size="sm" onClick={() => setDialog('new')}>{copy('New plan', 'ახალი გეგმა')}</Button>
                <Button size="sm" disabled={starting} onClick={() => void loadStarter()}>{starting ? copy('Loading…', 'იტვირთება…') : copy('Load this week’s work', 'ამ კვირის საქმეების ჩატვირთვა')}</Button>
            </div>}>
            {copy('Tasks are what we have to do, small fixes next to big work with steps. A plan keeps related tasks together.', 'საქმეები არის ის, რაც უნდა გავაკეთოთ: პატარა შესწორებები და ნაბიჯებიანი დიდი საქმეები. გეგმა დაკავშირებულ საქმეებს აერთიანებს.')}
        </EmptyNote></Panel>
            : <>
                {filter(copy('Everyone', 'ყველა'))}
                <Overview views={views} who={who} onWeek={period => set({ when: period, task: null, step: null })} onOpenPlan={openPlan} onNewPlan={() => setDialog('new')} {...taskList} />
            </>}
    </>;

    return <GkRoot className="gk-page"><PageFrame className="tw-page">
        <div className="tw-shell">
            <TeamWorkNav current={place} needsYou={needsYouCount(items.filter(item => !findings.has(item.id)))} fresh={ideas?.tasks.filter(node => { const detail = details.get(node.item.id); return detail != null && isNewFor(detail, me); }).length ?? 0}
                waiting={waiting?.tasks.length ?? 0} onGo={go} />
            <div className="tw-main" key={`${place}-${wanted ?? ''}-${week ?? ''}`}>
                {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span><Button size="sm" onClick={reload}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
                {main}
            </div>
        </div>
        {adding && <AddTaskDialog planId={adding.view?.plan.id} parent={adding.parent} team={adding.view?.team ?? team} others={adding.others} onClose={() => setAdding(null)}
            onCreated={detail => { const parent = adding.parent; setAdding(null); set(parent ? { step: String(detail.item.id) } : { task: String(detail.item.id), step: null }); reload(); }}
            onPlace={itemId => { const target = adding.view; setAdding(null); if (target) void savePlan(target, { order: [...target.tasks.map(node => node.item.id), itemId] }); }} />}
        {dialog === 'paste' && view && <PasteDialog planId={view.plan.id} elsewhere={elsewhere} onClose={() => setDialog(null)} onApplied={next => { setDialog(null); show(next); reload(); }} />}
        {dialog === 'ai' && view && <CopyForAiDialog view={view} onClose={() => setDialog(null)} />}
        {dialog === 'history' && view && <PlanHistoryDialog view={view} onClose={() => setDialog(null)} />}
        <TeamWorkDola onChanged={reload} />
        {(dialog === 'new' || dialog === 'copy' || dialog === 'rename') && <NameDialog mode={dialog} current={view?.plan ?? null} onClose={() => setDialog(null)} onDone={next => { setDialog(null); show(next); }} />}
    </PageFrame></GkRoot>;
}
