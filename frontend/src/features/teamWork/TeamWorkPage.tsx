import { useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Dialog } from '../../design/Dialog';
import { Button, GkRoot, PageFrame, Panel, Skeleton } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { RouteRecoveryPage } from '../../pages/RouteRecoveryPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changePlan, createPlan, createWork, fetchBoard, fetchPlan, fetchPlans, removePlanStep, LIST_ORDER, STARTER_WORK, type Member, type Person, type PlanStatus, type Plan, type PlanView, type WorkItem } from './api';
import { AddTaskDialog } from './TaskView';
import { IdeasPage } from './IdeasPage';
import { IDEAS, isHidden, isNewFor, isReservedName, WAITING, useFindingDetails } from './findings';
import { Overview } from './Overview';
import { PasteDialog } from './PasteDialog';
import { WaitingPage } from './WaitingPage';
import { PlanPage, type PlanDialog } from './PlanPage';
import { TeamPanel } from './TeamPanel';
import { TeamWorkDola } from './TeamWorkDola';
import { TeamSearch } from '../search/TeamSearch';
import { TaskMenuProvider } from './TaskMenuProvider';
import { TeamWorkNav, type TeamWorkPlace } from './TeamWorkNav';
import { WhatChangedPage } from './WhatChangedPage';
import { AddPlanStepDialog, CopyForAiDialog, PlanHistoryDialog } from './PlanBits';
import { needsYouCount } from './needsYou';
import { NameField } from './WorkBits';
import './team-work.css';
import './team-work-layout.css';

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
const PLACES: TeamWorkPlace[] = ['ideas', 'waiting', 'changes', 'team'];
// Old links keep working: ?view=add|pending|updates, ?roadmap=, ?open= and ?project= are read as the new keys.
const OLD_PLACES: Record<string, TeamWorkPlace> = { add: 'ideas', pending: 'waiting', updates: 'changes' };
const OLD_KEYS: Record<string, string> = { roadmap: 'plan', open: 'step', project: 'in' };
const placeOf = (value: string | null): TeamWorkPlace => PLACES.find(place => place === value) ?? (value ? OLD_PLACES[value] : undefined) ?? 'overview';
const PLAN_ORDER = { NOW: 0, LATER: 1, FINISHED: 2 } as const;

/** A new plan (what it is for first, then its name), a copy under a new name, or a new name. */
function NameDialog({ mode, current, onClose, onDone }: { mode: 'new' | 'copy' | 'rename'; current: Plan | null; onClose: () => void; onDone: (view: PlanView) => void }) {
    const copy = useJourneyCopy();
    const purposeId = useId();
    const [name, setName] = useState(mode === 'rename' ? current?.name ?? '' : mode === 'copy' ? `${current?.name ?? ''} v2` : '');
    const [purpose, setPurpose] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const title = mode === 'copy' ? copy('Copy as new version', 'ასლი ახალ ვერსიად') : mode === 'rename' ? copy('Rename the plan', 'გეგმის სახელის შეცვლა') : copy('New plan', 'ახალი გეგმა');
    const save = async () => {
        if (!name.trim()) return;
        if (isReservedName(name)) { setError(copy('That name is kept for the team’s own lists.', 'ეს სახელი გუნდის სიებისთვისაა დაცული.')); return; }
        setBusy(true); setError('');
        try { onDone(mode === 'rename' && current ? await changePlan(current.id, { version: current.version, name: name.trim() }) : await createPlan(name.trim(), mode === 'copy' ? current?.id : undefined, mode === 'new' ? purpose.trim() || undefined : undefined)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="sm" className="tw-dialog" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={mode === 'copy' ? copy('The same tasks in the same order. This version stays as it is, and you can go back to it.', 'იგივე საქმეები იგივე რიგით. ეს ვერსია უცვლელი რჩება და შეგიძლიათ დაუბრუნდეთ.') : undefined}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy || !name.trim()} onClick={() => void save()}>{copy('Save', 'შენახვა')}</Button></>}>
        <form className="tw-details" onSubmit={event => { event.preventDefault(); void save(); }}>
            {mode === 'new' && <div className="tw-field">
                <label htmlFor={purposeId}>{copy('What this plan is for', 'რისთვისაა ეს გეგმა')}</label>
                <textarea id={purposeId} className="gk-input" autoFocus rows={2} maxLength={400} value={purpose} placeholder={copy('Parents and clubs find a pitch in one tap', 'მშობლები და კლუბები მოედანს ერთი შეხებით პოულობენ')} onChange={event => setPurpose(event.target.value)} />
            </div>}
            <NameField value={name} max={80} autoFocus={mode !== 'new'} placeholder={copy('Short name, e.g. Map v2', 'მოკლე სახელი, მაგ. რუკა v2')} onChange={setName} />
        </form>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}

/**
 * Team work: what the team is building and fixing. A small side bar holds the places: the Overview (what needs you,
 * pins, plans, then what happened day by day), Ideas (what people found), Waiting (what needs whom), What changed
 * and the Team. Team accounts only; for anyone else the page does not exist.
 */
export function TeamWorkPage() {
    const copy = useJourneyCopy();
    const me = useAuth().user?.id ?? null;
    const [params, setParams] = useSearchParams();
    const [listed, setListed] = useState<Plan[] | null>(null);
    const [views, setViews] = useState<Map<number, PlanView>>(new Map());
    const [items, setItems] = useState<WorkItem[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
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
        // Every task and the team come with the board; the plans say which plan each task is in and hold the ideas.
        Promise.all([fetchPlans(controller.signal), fetchBoard(controller.signal)]).then(([list, board]) => Promise.all(list.map(plan => fetchPlan(plan.id, controller.signal))).then(all => {
            if (!live()) return;
            setListed(list); setViews(new Map(all.map(next => [next.plan.id, next]))); setItems(board.items); setMembers(board.team ?? []); setCanManageTeam(board.canManageTeam); setError('');
        })).catch(failure => {
            if (!live()) return;
            if (statusOf(failure) === 404) setMissing(true);
            // A server failure says so in our words; a refusal keeps the server's own.
            else setError((statusOf(failure) ?? 500) >= 500 ? copy('Team work could not load.', 'გუნდის სამუშაო ვერ ჩაიტვირთა.') : extractApiErrorMessage(failure, copy('Team work could not load.', 'გუნდის სამუშაო ვერ ჩაიტვირთა.')));
        });
        return () => controller.abort();
    }, [revision, copy]);

    const viewNamed = (name: string) => { const plan = listed?.find(candidate => candidate.name === name); return plan && views.get(plan.id); };
    const ideas = viewNamed(IDEAS), waiting = viewNamed(WAITING);
    const { details, put } = useFindingDetails([ideas, waiting]);
    const plans = (listed ?? []).filter(plan => !isHidden(plan));
    const view = wanted ? views.get(wanted) ?? null : null;
    // The team as the board gives it (everyone, with their responsibility); the plans' team is the fallback.
    const team: Person[] = members.length ? members.map(member => ({ id: member.userId, name: member.name ?? member.email })) : view?.team ?? [...views.values()][0]?.team ?? [];
    const lines = new Map(members.flatMap(member => member.responsibility ? [[member.userId, member.responsibility] as const] : []));
    const findings = new Set([ideas, waiting].flatMap(found => found?.tasks.map(node => node.item.id) ?? []));
    const allTasks = items.filter(item => item.parentId == null && !findings.has(item.id))
        .sort((a, b) => LIST_ORDER.indexOf(a.status) - LIST_ORDER.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt));
    const planOf = new Map<number, Plan>();
    [...plans].sort((a, b) => PLAN_ORDER[a.status] - PLAN_ORDER[b.status]).forEach(plan => views.get(plan.id)?.tasks.forEach(node => { if (!planOf.has(node.item.id)) planOf.set(node.item.id, plan); }));
    // Task names in other plans, so Paste from AI can flag a plan pasted twice.
    const elsewhere = new Map(allTasks.filter(item => !view?.tasks.some(node => node.item.id === item.id)).map(item => [item.title.trim().toLowerCase(), planOf.get(item.id)?.name ?? copy('no plan', 'გეგმის გარეშე')]));

    const keep = (next: PlanView) => { setViews(current => new Map(current).set(next.plan.id, next)); setListed(current => current && [next.plan, ...current.filter(plan => plan.id !== next.plan.id)]); };
    const show = (next: PlanView) => { keep(next); set({ view: null, plan: String(next.plan.id), task: null }); };
    const savePlan = async (target: PlanView, change: { order?: number[]; status?: PlanStatus; purpose?: string }) => {
        setError('');
        try { keep(await changePlan(target.plan.id, { version: target.plan.version, ...change })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The plan couldn’t be changed.', 'გეგმა ვერ შეიცვალა.'))); if (statusOf(failure) === 409) reload(); }
    };
    // A plan taken out of another: both plans change, so everything loads again.
    const detach = async (target: PlanView, child: Plan) => {
        setError('');
        try { keep(await removePlanStep(target.plan.id, child.id)); reload(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The plan couldn’t be taken out.', 'გეგმა ვერ ამოიღო.'))); }
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
    // By day or List (`?show=`) stays as the person chose it, from page to page.
    const openPlan = (id: number) => set({ view: null, plan: String(id), step: null, task: null, day: null });
    const setOpen = (id: number | null) => set({ step: id == null ? null : String(id) });
    const go = (next: TeamWorkPlace) => set({ view: next === 'overview' ? null : next, plan: null, step: null, task: null, day: null });

    if (missing) return <RouteRecoveryPage />;
    const loading = <Panel flush><div className="gk-panel--pad" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div></Panel>;
    const findingProps = { details, team, me, open, onOpen: setOpen, onPut: put, onChanged: reload };
    const actions = { open, team, me, candidates: allTasks, onOpen: setOpen, onSaved: reload, onDeleted: () => { set({ task: null, step: null }); reload(); },
        onAddStep: (parent: WorkItem) => startAdding(undefined, parent), onToggle: (id: number) => set({ task: task === id ? null : String(id), step: null }) };
    let main: ReactNode;
    if (!listed) main = !error && loading;
    else if (place === 'changes') main = <WhatChangedPage />;
    else if (place === 'team') main = <TeamPanel canManage={canManageTeam} />;
    else if (place === 'ideas') main = <IdeasPage ideas={ideas} waiting={waiting} {...findingProps} />;
    else if (place === 'waiting') main = <WaitingPage waiting={waiting} plans={plans} views={views} {...findingProps} onIdeas={() => go('ideas')} />;
    else if (view) main = <PlanPage view={view} items={items} views={views} planOf={planOf} lines={lines} revision={revision} task={task} actions={actions} onBack={() => set({ plan: null, step: null, task: null })}
        onChangePlan={change => void savePlan(view, change)} onDetach={child => void detach(view, child)} onAdd={parent => startAdding(view, parent)} onDialog={setDialog} onOpenPlan={openPlan} />;
    else main = <Overview items={items} findings={findings} plans={plans} views={views} planOf={planOf} team={team} lines={lines} me={me} revision={revision} task={task} actions={actions} starting={starting}
        onAddTask={() => startAdding()} onNewPlan={() => setDialog('new')} onOpenPlan={openPlan} onLoadStarter={() => void loadStarter()} onChanged={reload} />;

    return <GkRoot className="gk-page"><PageFrame className="tw-page">
        <div className="tw-shell">
            <TeamSearch />
            <TeamWorkNav current={place} needsYou={needsYouCount(items.filter(item => !findings.has(item.id)))} fresh={ideas?.tasks.filter(node => { const detail = details.get(node.item.id); return detail != null && isNewFor(detail, me); }).length ?? 0}
                waiting={waiting?.tasks.length ?? 0} onGo={go} />
            <div className="tw-main" key={`${place}-${wanted ?? ''}`}>
                {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span><Button size="sm" onClick={reload}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
                <TaskMenuProvider onChanged={reload}>{main}</TaskMenuProvider>
            </div>
        </div>
        {adding && <AddTaskDialog planId={adding.view?.plan.id} parent={adding.parent} team={team} others={adding.others} onClose={() => setAdding(null)}
            onCreated={detail => { const parent = adding.parent; setAdding(null); set(parent ? { step: String(detail.item.id) } : { task: String(detail.item.id), step: null }); reload(); }}
            onPlace={itemId => { const target = adding.view; setAdding(null); if (target) void savePlan(target, { order: [...target.tasks.map(node => node.item.id), itemId] }); }} />}
        {dialog === 'paste' && view && <PasteDialog planId={view.plan.id} elsewhere={elsewhere} onClose={() => setDialog(null)} onApplied={next => { setDialog(null); show(next); reload(); }} />}
        {dialog === 'ai' && view && <CopyForAiDialog view={view} onClose={() => setDialog(null)} />}
        {dialog === 'history' && view && <PlanHistoryDialog view={view} onClose={() => setDialog(null)} />}
        {dialog === 'addStep' && view && <AddPlanStepDialog view={view} plans={plans} onClose={() => setDialog(null)} onDone={next => { setDialog(null); keep(next); reload(); }} />}
        <TeamWorkDola onChanged={reload} />
        {(dialog === 'new' || dialog === 'copy' || dialog === 'rename') && <NameDialog mode={dialog} current={view?.plan ?? null} onClose={() => setDialog(null)} onDone={next => { setDialog(null); show(next); }} />}
    </PageFrame></GkRoot>;
}
