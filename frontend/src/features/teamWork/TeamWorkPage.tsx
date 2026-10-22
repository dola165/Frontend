import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { RouteRecoveryPage } from '../../pages/RouteRecoveryPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeRoadmap, createRoadmap, createWork, fetchBoard, fetchRoadmap, fetchRoadmaps, STARTER_WORK, STATUSES, type Person, type WorkStatus, type PlanStatus, type Roadmap, type RoadmapView, type WorkItem, type WorkNode } from './api';
import { AddWorkDialog } from './WorkDetails';
import { AddToPlans } from './AddToPlans';
import { INTAKE, isHidden, isNewFor, isReservedName, PENDING, useFindingDetails } from './findings';
import { Overview, WeekPage, type Period, type TaskListProps } from './Overview';
import { PasteDialog } from './PasteDialog';
import { PendingPage } from './PendingPage';
import { PlanView, type PlanDialog } from './PlanView';
import { TeamPanel } from './TeamPanel';
import { TeamWorkNav, type TeamWorkPlace } from './TeamWorkNav';
import { UpdatesView } from './UpdatesView';
import { CopyForAiDialog, NameFilter, PlanHistoryDialog } from './PlanBits';
import { nodeMatches, whoOf } from './planPeople';
import './team-work.css';
import './team-work-layout.css';

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
const PLACES: TeamWorkPlace[] = ['add', 'pending', 'updates', 'team'];
const placeOf = (value: string | null): TeamWorkPlace => PLACES.find(place => place === value) ?? 'overview';
const periodOf = (value: string | null): Period | null => value === 'week' || value === 'last' || value === 'earlier' ? value : null;
const PROJECT_ORDER = { NOW: 0, LATER: 1, FINISHED: 2 } as const;

function NameDialog({ mode, current, onClose, onDone }: { mode: 'new' | 'copy' | 'rename'; current: Roadmap | null; onClose: () => void; onDone: (view: RoadmapView) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [name, setName] = useState(mode === 'rename' ? current?.name ?? '' : mode === 'copy' ? `${current?.name ?? ''} v2` : '');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const title = mode === 'copy' ? copy('Copy as new version', 'ასლი ახალ ვერსიად') : mode === 'rename' ? copy('Rename the project', 'პროექტის სახელის შეცვლა') : copy('New project', 'ახალი პროექტი');
    const save = async () => {
        if (!name.trim()) return;
        if (isReservedName(name)) { setError(copy('That name is kept for the team’s own lists.', 'ეს სახელი გუნდის სიებისთვისაა დაცული.')); return; }
        setBusy(true); setError('');
        try { onDone(mode === 'rename' && current ? await changeRoadmap(current.id, { version: current.version, name: name.trim() }) : await createRoadmap(name.trim(), mode === 'copy' ? current?.id : undefined)); }
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
 * projects, then every task), Add to plans (what people found), Pending (findings waiting for a decision), staying
 * up to date, and the team. Team accounts only; for anyone else the page does not exist.
 */
export function TeamWorkPage() {
    const copy = useJourneyCopy();
    const me = useAuth().user?.id ?? null;
    const [params, setParams] = useSearchParams();
    const [plans, setPlans] = useState<Roadmap[] | null>(null);
    const [views, setViews] = useState<Map<number, RoadmapView>>(new Map());
    const [items, setItems] = useState<WorkItem[]>([]);
    const [canManageTeam, setCanManageTeam] = useState(false);
    const [error, setError] = useState('');
    const [missing, setMissing] = useState(false);
    const [revision, setRevision] = useState(0);
    const [adding, setAdding] = useState<{ view?: RoadmapView; parent?: WorkItem; others: WorkItem[] } | null>(null);
    const [dialog, setDialog] = useState<PlanDialog | 'new' | null>(null);
    const [starting, setStarting] = useState(false);
    const place = placeOf(params.get('view'));
    const wanted = Number(params.get('roadmap')) || null;
    const open = Number(params.get('open')) || null;
    const task = Number(params.get('task')) || null;
    const who = whoOf(params.get('who'));
    const reload = () => setRevision(value => value + 1);
    const set = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
        setParams(next, { replace: true });
    };

    useEffect(() => {
        const controller = new AbortController();
        const live = () => !controller.signal.aborted;
        // Every task comes with the board; the plans say which project each is in and hold the findings.
        Promise.all([fetchRoadmaps(controller.signal), fetchBoard(controller.signal)]).then(([list, board]) => Promise.all(list.map(plan => fetchRoadmap(plan.id, controller.signal))).then(all => {
            if (!live()) return;
            setPlans(list); setViews(new Map(all.map(next => [next.roadmap.id, next]))); setItems(board.items); setCanManageTeam(board.canManageTeam); setError('');
        })).catch(failure => {
            if (!live()) return;
            if (statusOf(failure) === 404) setMissing(true);
            else setError(extractApiErrorMessage(failure, copy('Team work could not load.', 'გუნდის სამუშაო ვერ ჩაიტვირთა.')));
        });
        return () => controller.abort();
    }, [revision, copy]);

    const viewNamed = (name: string) => { const plan = plans?.find(candidate => candidate.name === name); return plan && views.get(plan.id); };
    const intake = viewNamed(INTAKE), pending = viewNamed(PENDING);
    const { details, put } = useFindingDetails([intake, pending]);
    const projects = (plans ?? []).filter(plan => !isHidden(plan));
    const view = wanted ? views.get(wanted) ?? null : null;
    const team: Person[] = view?.team ?? [...views.values()][0]?.team ?? [];
    const findings = new Set([intake, pending].flatMap(found => found?.pieces.map(node => node.item.id) ?? []));
    const stages = new Map<number, WorkItem[]>();
    items.filter(item => item.parentId != null).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach(item => stages.set(item.parentId!, [...stages.get(item.parentId!) ?? [], item]));
    const allTasks = items.filter(item => item.parentId == null && !findings.has(item.id))
        .sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt));
    const tasks: WorkNode[] = allTasks.map(item => ({ item, parts: stages.get(item.id) ?? [] })).filter(node => nodeMatches(node, who, team));
    const projectOf = new Map<number, Roadmap>();
    [...projects].sort((a, b) => PROJECT_ORDER[a.status] - PROJECT_ORDER[b.status]).forEach(project => views.get(project.id)?.pieces.forEach(node => { if (!projectOf.has(node.item.id)) projectOf.set(node.item.id, project); }));

    const keep = (next: RoadmapView) => { setViews(current => new Map(current).set(next.roadmap.id, next)); setPlans(current => current && [next.roadmap, ...current.filter(plan => plan.id !== next.roadmap.id)]); };
    const show = (next: RoadmapView) => { keep(next); set({ view: null, roadmap: String(next.roadmap.id), task: null }); };
    const refresh = (id: number) => fetchRoadmap(id).then(next => setViews(current => new Map(current).set(id, next))).catch(() => undefined);
    const changePlan = async (target: RoadmapView, change: { order?: number[]; status?: PlanStatus }) => {
        setError('');
        try { keep(await changeRoadmap(target.roadmap.id, { version: target.roadmap.version, ...change })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The project couldn’t be changed.', 'პროექტი ვერ შეიცვალა.'))); if (statusOf(failure) === 409) reload(); }
    };
    const startAdding = (target?: RoadmapView, parent?: WorkItem) => {
        const here = new Set(target?.pieces.map(node => node.item.id) ?? []);
        setAdding({ view: target, parent, others: target && !parent ? allTasks.filter(item => !here.has(item.id)) : [] });
    };
    const loadStarter = async () => {
        setStarting(true);
        try { for (const starter of STARTER_WORK) await createWork(starter); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Some work could not be added.', 'ზოგიერთი საქმე ვერ დაემატა.'))); }
        finally { setStarting(false); reload(); }
    };
    const openProject = (id: number) => set({ view: null, roadmap: String(id), open: null, task: null, when: null });
    const setOpen = (id: number | null) => set({ open: id == null ? null : String(id) });
    const statuses = (params.get('status') ?? '').split(',').filter((value): value is WorkStatus => (STATUSES as readonly string[]).includes(value));
    const setStatuses = (next: WorkStatus[]) => set({ status: next.length ? next.join(',') : null, task: null, open: null });
    const go = (next: TeamWorkPlace) => set({ view: next === 'overview' ? null : next, roadmap: null, open: null, task: null, when: null });

    if (missing) return <RouteRecoveryPage />;
    const filter = (allLabel: string) => <NameFilter team={team} who={who} allLabel={allLabel} onChange={next => set({ who: next === null ? null : String(next), open: null, task: null })} />;
    const loading = <Panel flush><div className="gk-panel--pad" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div></Panel>;
    const findingProps = { details, team, me, open, onOpen: setOpen, onPut: put, onChanged: reload };
    const week = periodOf(params.get('when'));
    const taskList: TaskListProps = { tasks, projectOf, task, statuses, showFinished: params.get('finished') === 'show', onStatuses: setStatuses, onAddTask: () => startAdding(),
        onShowFinished: showFinished => set({ finished: showFinished ? 'show' : null }),
        actions: { open, team, me, onOpen: setOpen, onSaved: reload, onAddStage: parent => startAdding(undefined, parent), onToggle: id => set({ task: task === id ? null : String(id), open: null }) } };
    let main: ReactNode;
    if (!plans) main = !error && loading;
    else if (place === 'updates') main = <UpdatesView />;
    else if (place === 'team') main = <TeamPanel canManage={canManageTeam} />;
    else if (place === 'add') main = <AddToPlans intake={intake} pending={pending} {...findingProps} />;
    else if (place === 'pending') main = <PendingPage pending={pending} projects={projects} views={views} {...findingProps} />;
    else if (view) main = <PlanView view={view} who={who} open={open} me={me} filter={filter(copy('Everything', 'ყველაფერი'))} statuses={statuses} onStatuses={setStatuses} onBack={() => set({ roadmap: null, open: null })} onOpen={setOpen}
        onChangePlan={change => void changePlan(view, change)} onAdd={parent => startAdding(view, parent)} onDialog={setDialog} onRefresh={() => void refresh(view.roadmap.id)} />;
    else if (week) main = <WeekPage period={week} filter={filter(copy('Everyone', 'ყველა'))} onBack={() => set({ when: null, task: null, open: null })} {...taskList} />;
    else main = <>
        <PageHeader title={copy('Progress', 'პროგრესი')} subtitle={copy('What we’re building and fixing', 'რას ვაშენებთ და ვასწორებთ')} />
        {projects.length === 0 && allTasks.length === 0 ? <Panel flush><EmptyNote title={copy('Nothing here yet', 'აქ ჯერ არაფერია')}
            action={<div className="tw-empty-actions">
                <Button variant="primary" size="sm" onClick={() => startAdding()}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
                <Button size="sm" onClick={() => setDialog('new')}>{copy('New project', 'ახალი პროექტი')}</Button>
                <Button size="sm" disabled={starting} onClick={() => void loadStarter()}>{starting ? copy('Loading…', 'იტვირთება…') : copy('Load this week’s work', 'ამ კვირის საქმეების ჩატვირთვა')}</Button>
            </div>}>
            {copy('Tasks are what we have to do, small fixes next to big work with stages. A project keeps related tasks together.', 'საქმეები არის ის, რაც უნდა გავაკეთოთ: პატარა შესწორებები და ეტაპებიანი დიდი საქმეები. პროექტი დაკავშირებულ საქმეებს აერთიანებს.')}
        </EmptyNote></Panel>
            : <>
                {filter(copy('Everyone', 'ყველა'))}
                <Overview projects={projects} views={views} who={who} onWeek={period => set({ when: period, task: null, open: null })} onOpenProject={openProject} onNewProject={() => setDialog('new')} {...taskList} />
            </>}
    </>;

    return <GkRoot className="gk-page"><PageFrame className="tw-page">
        <div className="tw-shell">
            <TeamWorkNav current={place} fresh={intake?.pieces.filter(node => { const detail = details.get(node.item.id); return detail != null && isNewFor(detail, me); }).length ?? 0}
                waiting={pending?.pieces.length ?? 0} onGo={go} />
            <div className="tw-main" key={`${place}-${wanted ?? ''}-${week ?? ''}`}>
                {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span><Button size="sm" onClick={reload}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
                {main}
            </div>
        </div>
        {adding && <AddWorkDialog roadmapId={adding.view?.roadmap.id} parent={adding.parent} team={adding.view?.team ?? team} others={adding.others} onClose={() => setAdding(null)}
            onCreated={detail => { const parent = adding.parent; setAdding(null); set(view || parent ? { open: String(detail.item.id) } : { task: String(detail.item.id), open: null }); reload(); }}
            onPlace={itemId => { const target = adding.view; setAdding(null); if (target) void changePlan(target, { order: [...target.pieces.map(node => node.item.id), itemId] }); }} />}
        {dialog === 'paste' && view && <PasteDialog roadmapId={view.roadmap.id} onClose={() => setDialog(null)} onApplied={next => { setDialog(null); show(next); reload(); }} />}
        {dialog === 'ai' && view && <CopyForAiDialog view={view} onClose={() => setDialog(null)} />}
        {dialog === 'history' && view && <PlanHistoryDialog view={view} onClose={() => setDialog(null)} />}
        {(dialog === 'new' || dialog === 'copy' || dialog === 'rename') && <NameDialog mode={dialog} current={view?.roadmap ?? null} onClose={() => setDialog(null)} onDone={next => { setDialog(null); show(next); }} />}
    </PageFrame></GkRoot>;
}
