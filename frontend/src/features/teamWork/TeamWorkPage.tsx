import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, ClipboardPaste, Plus } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { RouteRecoveryPage } from '../../pages/RouteRecoveryPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeRoadmap, createRoadmap, createWork, fetchBoard, fetchRoadmap, fetchRoadmaps, STARTER_WORK, type PlanStatus, type Roadmap, type RoadmapView, type WorkItem, type WorkNode } from './api';
import { AddWorkDialog, WorkPiece } from './WorkDetails';
import { PasteDialog } from './PasteDialog';
import { TeamPanel } from './TeamPanel';
import { TimeAxis, TimeBar, TimeWords } from './TimeStrip';
import { ColourKey, SmallChip, StatusDot } from './WorkBits';
import { ago, spanOf, type Span } from './teamWorkWords';
import './team-work.css';

type Copy = ReturnType<typeof useJourneyCopy>;
const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
const PLAN_STATUSES: [PlanStatus, string, string][] = [['NOW', 'Now', 'ახლა'], ['LATER', 'Later', 'მოგვიანებით'], ['FINISHED', 'Finished', 'დასრულებული']];

/** Who changed a plan last and when: "changed by Beqa · 2 h ago". */
function changedLine(copy: Copy, plan: Roadmap) {
    return plan.updatedBy?.name ? copy(`changed by ${plan.updatedBy.name} · ${ago(copy, plan.updatedAt)}`, `შეცვალა ${plan.updatedBy.name} · ${ago(copy, plan.updatedAt)}`) : ago(copy, plan.updatedAt);
}
const counts = (copy: Copy, plan: Roadmap) => [
    plan.inProgress > 0 && copy(`${plan.inProgress} in progress`, `${plan.inProgress} მიმდინარე`),
    plan.toDo > 0 && copy(`${plan.toDo} to do`, `${plan.toDo} გასაკეთებელი`),
    plan.finished > 0 && copy(`${plan.finished} done`, `${plan.finished} დასრულდა`),
].filter(Boolean).join(' · ') || copy('Nothing in it yet', 'ჯერ ცარიელია');

/** A plan being worked on now: its name, overall progress, what is moving and what comes next. */
function PlanBox({ plan, onOpen }: { plan: Roadmap; onOpen: () => void }) {
    const copy = useJourneyCopy();
    return <li><button type="button" className="tw-plan-box" onClick={onOpen}>
        <span className="tw-plan-box__name">{plan.name}</span>
        <span className="tw-plan-box__progress">
            <span className="tw-plan-box__bar" role="progressbar" aria-label={copy('Done', 'შესრულებულია')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={plan.percent}><span style={{ width: `${plan.percent}%` }} /></span>
            <span className="gk-num">{plan.percent}%</span>
        </span>
        <span className="tw-plan-box__counts">{counts(copy, plan)}</span>
        <span className="tw-plan-box__next">{plan.nextPiece ? <><span className="gk-faint">{copy('Next', 'შემდეგი')}: </span>{plan.nextPiece}</> : plan.pieceCount > 0 ? copy('Everything is done', 'ყველაფერი დასრულდა') : ''}</span>
        <span className="tw-plan-box__changed">{changedLine(copy, plan)}</span>
    </button></li>;
}

/** Plans for later or already finished, as quiet rows. */
function PlanRows({ title, plans, onOpen }: { title: string; plans: Roadmap[]; onOpen: (id: number) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    if (plans.length === 0) return null;
    return <section className="tw-plan-rows" aria-labelledby={id}>
        <h2 id={id} className="tw-section__title">{title} <span className="gk-faint gk-num">{plans.length}</span></h2>
        <ul>{plans.map(plan => <li key={plan.id}><button type="button" onClick={() => onOpen(plan.id)}>
            <span className="tw-plan-rows__name">{plan.name}</span>
            <span className="gk-faint gk-num">{plan.percent}% · {counts(copy, plan)}</span>
            <span className="gk-faint tw-plan-rows__changed">{changedLine(copy, plan)}</span>
        </button></li>)}</ul>
    </section>;
}

/** Name a new plan, a copy of this one, or this one again. */
function NameDialog({ mode, current, onClose, onDone }: { mode: 'new' | 'copy' | 'rename'; current: Roadmap | null; onClose: () => void; onDone: (view: RoadmapView) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [name, setName] = useState(mode === 'rename' ? current?.name ?? '' : mode === 'copy' ? `${current?.name ?? ''} v2` : '');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const title = mode === 'copy' ? copy('Copy as new version', 'ასლი ახალ ვერსიად') : mode === 'rename' ? copy('Rename the plan', 'გეგმის სახელის შეცვლა') : copy('New plan', 'ახალი გეგმა');
    const save = async () => {
        if (!name.trim()) return;
        setBusy(true); setError('');
        try { onDone(mode === 'rename' && current ? await changeRoadmap(current.id, { version: current.version, name: name.trim() }) : await createRoadmap(name.trim(), mode === 'copy' ? current?.id : undefined)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="sm" className="tw-dialog" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={mode === 'copy' ? copy('The same pieces in the same order. This version stays as it is, and you can go back to it.', 'იგივე საქმეები იგივე რიგით. ეს ვერსია უცვლელი რჩება და შეგიძლიათ დაუბრუნდეთ.') : undefined}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy || !name.trim()} onClick={() => void save()}>{copy('Save', 'შენახვა')}</Button></>}>
        <form className="tw-field" onSubmit={event => { event.preventDefault(); void save(); }}>
            <label htmlFor={id}>{copy('Name', 'სახელი')}</label>
            <input id={id} className="gk-input" autoFocus maxLength={80} value={name} placeholder={copy('Registration and roles', 'რეგისტრაცია და როლები')} onChange={event => setName(event.target.value)} />
        </form>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}

/** One line of the tree: the dot, the name, "3 parts · 70%" or the percent and step, and its bar on the time strip. */
function WorkRow({ item, parts, span, open, folded, onOpen, onFold }: { item: WorkItem; parts?: WorkItem[]; span: Span; open: boolean; folded?: boolean; onOpen: () => void; onFold?: () => void }) {
    const copy = useJourneyCopy();
    const meta = parts?.length ? copy(`${parts.length} parts · ${item.percent}%`, `${parts.length} ნაწილი · ${item.percent}%`) : [`${item.percent}%`, item.step ?? item.area].filter(Boolean).join(' · ');
    return <div className="tw-row" data-status={item.status} data-depth={item.parentId != null ? 1 : 0} data-open={open || undefined}>
        <span className="tw-row__fold">{onFold && <button type="button" className="tw-icon-button" aria-expanded={!folded} aria-label={folded ? copy(`Show the parts of ${item.title}`, `${item.title} — ნაწილების ჩვენება`) : copy(`Hide the parts of ${item.title}`, `${item.title} — ნაწილების დამალვა`)}
            onClick={onFold}>{folded ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button>}</span>
        <button type="button" className="tw-row__main" aria-expanded={open} onClick={onOpen}>
            <StatusDot status={item.status} />
            <span className="tw-row__text"><span className="tw-row__name">{item.title}</span>{item.small && <SmallChip />}<span className="tw-row__meta gk-num">{meta}</span><TimeWords item={item} /></span>
        </button>
        <TimeBar item={item} span={span} />
    </div>;
}

/**
 * Team work: what the team is building and fixing, as plans. The page opens on the plans being worked on now,
 * as boxes, with the plans for later and the finished ones below; a box opens its plan as a tree of pieces and
 * parts with a time strip, and each piece opens in place. Team accounts only; for anyone else the page does not exist.
 */
export function TeamWorkPage() {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const [plans, setPlans] = useState<Roadmap[] | null>(null);
    const [view, setView] = useState<RoadmapView | null>(null);
    const [canManageTeam, setCanManageTeam] = useState(false);
    const [error, setError] = useState('');
    const [missing, setMissing] = useState(false);
    const [revision, setRevision] = useState(0);
    const [adding, setAdding] = useState<{ parent?: WorkItem; others: WorkItem[] } | null>(null);
    const [pasting, setPasting] = useState(false);
    const [naming, setNaming] = useState<'new' | 'copy' | 'rename' | null>(null);
    const [folded, setFolded] = useState<number[]>([]);
    const [starting, setStarting] = useState(false);
    const wanted = Number(params.get('roadmap')) || null;
    const open = Number(params.get('open')) || null;
    const reload = () => setRevision(value => value + 1);
    const set = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
        setParams(next, { replace: true });
    };

    useEffect(() => {
        const controller = new AbortController();
        const fail = (failure: unknown) => {
            if (controller.signal.aborted) return;
            if (statusOf(failure) === 404 && !plans) setMissing(true);
            else setError(extractApiErrorMessage(failure, copy('The plans could not load.', 'გეგმები ვერ ჩაიტვირთა.')));
        };
        fetchRoadmaps(controller.signal).then(list => {
            if (controller.signal.aborted) return;
            setPlans(list); setError('');
            const pick = list.find(plan => plan.id === wanted);
            if (!pick) {
                setView(null);
                return fetchBoard(controller.signal).then(board => { if (!controller.signal.aborted) setCanManageTeam(board.canManageTeam); });
            }
            return fetchRoadmap(pick.id, controller.signal).then(next => { if (!controller.signal.aborted) { setView(next); setCanManageTeam(next.canManageTeam); } });
        }).catch(fail);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `plans` only tells a first 404 from a later one
    }, [wanted, revision, copy]);

    const show = (next: RoadmapView) => { setView(next); set({ roadmap: String(next.roadmap.id) }); setPlans(current => current && [next.roadmap, ...current.filter(plan => plan.id !== next.roadmap.id)]); };
    const changePlan = async (change: { order?: number[]; status?: PlanStatus }) => {
        if (!view) return;
        setError('');
        try { show(await changeRoadmap(view.roadmap.id, { version: view.roadmap.version, ...change })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The plan couldn’t be changed.', 'გეგმა ვერ შეიცვალა.'))); if (statusOf(failure) === 409) reload(); }
    };
    const startAdding = (parent?: WorkItem) => {
        setAdding({ parent, others: [] });
        if (!parent && view) {
            const here = new Set(view.pieces.map(node => node.item.id));
            fetchBoard().then(board => setAdding(current => current && { ...current, others: board.items.filter(item => item.parentId == null && !here.has(item.id)) })).catch(() => undefined);
        }
    };
    const loadStarter = async () => {
        setStarting(true);
        try { const made = await createRoadmap(copy('This week’s work', 'ამ კვირის საქმეები')); for (const work of STARTER_WORK) await createWork({ ...work, roadmapId: made.roadmap.id }); set({ roadmap: String(made.roadmap.id) }); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('Some work could not be added.', 'ზოგიერთი საქმე ვერ დაემატა.'))); }
        finally { setStarting(false); reload(); }
    };

    if (missing) return <RouteRecoveryPage />;
    const ids = view?.pieces.map(node => node.item.id) ?? [];
    const span = spanOf(view?.pieces.flatMap(node => [node.item, ...node.parts]) ?? []);
    const piece = (item: WorkItem, node?: WorkNode) => open === item.id && view && <WorkPiece key={`piece-${item.id}`} id={item.id} team={view.team}
        place={node && { first: ids[0] === item.id, last: ids[ids.length - 1] === item.id,
            onMove: by => { const at = ids.indexOf(item.id), next = [...ids]; next.splice(at, 1); next.splice(at + by, 0, item.id); void changePlan({ order: next }); },
            onRemove: () => { set({ open: null }); void changePlan({ order: ids.filter(id => id !== item.id) }); } }}
        onAddPart={node ? () => startAdding(item) : undefined} onOpen={id => set({ open: String(id) })} onClose={() => set({ open: null })} onSaved={() => { if (view) fetchRoadmap(view.roadmap.id).then(setView).catch(() => undefined); }} />;
    const now = plans?.filter(plan => plan.status === 'NOW') ?? [];
    const openPlan = (id: number) => set({ roadmap: String(id), open: null });
    const loading = <Panel flush><div className="gk-panel--pad" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div></Panel>;

    return <GkRoot className="gk-page"><PageFrame className="tw-page">
        {!view ? <PageHeader title={copy('Team work', 'გუნდის სამუშაო')} subtitle={copy('What we’re building and fixing, plan by plan', 'რას ვაშენებთ და ვასწორებთ, გეგმა-გეგმა')}
            actions={plans && plans.length > 0 && <Button variant="primary" size="sm" onClick={() => setNaming('new')}><Plus aria-hidden="true" />{copy('New plan', 'ახალი გეგმა')}</Button>} />
            : <div className="tw-plan-head">
                <button type="button" className="tw-back" onClick={() => set({ roadmap: null, open: null })}><ArrowLeft aria-hidden="true" />{copy('All plans', 'ყველა გეგმა')}</button>
                <div className="tw-plan-head__row">
                    <div className="tw-plan-head__title">
                        <h1>{view.roadmap.name}</h1>
                        <span className="tw-switcher__changed">{changedLine(copy, view.roadmap)}{view.roadmap.copiedFromName && <> · {copy(`copied from ${view.roadmap.copiedFromName}`, `ასლი: ${view.roadmap.copiedFromName}`)}</>}</span>
                    </div>
                    <span className="tw-actions">
                        <Button size="sm" onClick={() => setPasting(true)}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button>
                        <Button variant="primary" size="sm" onClick={() => startAdding()}><Plus aria-hidden="true" />{copy('Add work', 'საქმის დამატება')}</Button>
                    </span>
                </div>
                <div className="tw-bar-line">
                    <span className="tw-plan-head__tools">
                        <span className="tw-plan-status" role="radiogroup" aria-label={copy('This plan is', 'ეს გეგმა')}>
                            {PLAN_STATUSES.map(([status, en, ka]) => <button key={status} type="button" role="radio" aria-checked={view.roadmap.status === status} onClick={() => { if (view.roadmap.status !== status) void changePlan({ status }); }}>{copy(en, ka)}</button>)}
                        </span>
                        <button type="button" className="tw-link-button" onClick={() => setNaming('copy')}>{copy('Copy as new version', 'ასლი ახალ ვერსიად')}</button>
                        <button type="button" className="tw-link-button" onClick={() => setNaming('rename')}>{copy('Rename', 'სახელის შეცვლა')}</button>
                    </span>
                    <ColourKey />
                </div>
            </div>}
        {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span><Button size="sm" onClick={reload}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
        {!plans ? !error && loading
            : !view ? wanted && plans.some(plan => plan.id === wanted) ? loading : <>
                {plans.length === 0 ? <Panel flush><EmptyNote title={copy('No plan yet', 'გეგმა ჯერ არ არის')}
                    action={<div className="tw-empty-actions">
                        <Button variant="primary" size="sm" onClick={() => setNaming('new')}><Plus aria-hidden="true" />{copy('New plan', 'ახალი გეგმა')}</Button>
                        <Button size="sm" disabled={starting} onClick={() => void loadStarter()}>{starting ? copy('Loading…', 'იტვირთება…') : copy('Load this week’s work', 'ამ კვირის საქმეების ჩატვირთვა')}</Button>
                    </div>}>
                    {copy('A plan is a list of what we have to do: small fixes and complaints next to bigger work like a flow or business logic.', 'გეგმა არის სია, რაც უნდა გავაკეთოთ: პატარა შესწორებები და საჩივრები დიდ საქმეებთან ერთად, როგორიცაა ნაკადი ან ბიზნეს-ლოგიკა.')}
                </EmptyNote></Panel>
                    : <>
                        <section aria-labelledby="tw-now">
                            <h2 id="tw-now" className="tw-section__title">{copy('Working on now', 'ახლა ვმუშაობთ')}</h2>
                            {now.length ? <ul className="tw-plan-boxes">{now.map(plan => <PlanBox key={plan.id} plan={plan} onOpen={() => openPlan(plan.id)} />)}</ul>
                                : <p className="gk-muted tw-quiet">{copy('Nothing right now. Open a plan below and mark it “Now”.', 'ახლა არაფერი. გახსენით გეგმა ქვემოთ და მონიშნეთ „ახლა“.')}</p>}
                        </section>
                        <PlanRows title={copy('Later', 'მოგვიანებით')} plans={plans.filter(plan => plan.status === 'LATER')} onOpen={openPlan} />
                        <PlanRows title={copy('Finished', 'დასრულებული')} plans={plans.filter(plan => plan.status === 'FINISHED')} onOpen={openPlan} />
                    </>}
                <TeamPanel canManage={canManageTeam} />
            </>
                : <>
                    {view.trail.length > 0 && <p className="tw-trail" aria-label={copy('Latest switches', 'ბოლო გადართვები')}>
                        {view.trail.map((step, index) => <span key={`${step.itemId}:${step.at}`} className="tw-trail__step">
                            {index > 0 && <span className="tw-trail__arrow" aria-hidden="true">→</span>}
                            <button type="button" onClick={() => set({ open: String(step.itemId) })}>{step.title}</button><span className="gk-faint"> · {ago(copy, step.at)}</span>
                        </span>)}
                    </p>}
                    {view.pieces.length === 0
                        ? <Panel flush><EmptyNote title={copy('Nothing in this plan yet', 'ამ გეგმაში ჯერ არაფერია')}
                            action={<div className="tw-empty-actions"><Button variant="primary" size="sm" onClick={() => startAdding()}><Plus aria-hidden="true" />{copy('Add work', 'საქმის დამატება')}</Button>
                                <Button size="sm" onClick={() => setPasting(true)}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button></div>}>
                            {copy('Add pieces one by one, big or small, or paste a list.', 'დაამატეთ სათითაოდ, დიდი თუ პატარა, ან ჩასვით სია.')}
                        </EmptyNote></Panel>
                        : <Panel flush className="tw-tree-panel">
                            <div className="tw-tree__head" aria-hidden="true"><span>{copy('Work', 'საქმე')}</span><TimeAxis span={span} /></div>
                            <ul className="tw-tree" aria-label={view.roadmap.name}>{view.pieces.map(node => {
                                const isFolded = folded.includes(node.item.id);
                                return <li key={node.item.id}>
                                    <WorkRow item={node.item} parts={node.parts} span={span} open={open === node.item.id} folded={isFolded}
                                        onOpen={() => set({ open: open === node.item.id ? null : String(node.item.id) })}
                                        onFold={node.parts.length ? () => setFolded(current => isFolded ? current.filter(id => id !== node.item.id) : [...current, node.item.id]) : undefined} />
                                    {piece(node.item, node)}
                                    {node.parts.length > 0 && (!isFolded || node.parts.some(part => part.id === open)) && <ul className="tw-tree__parts">{node.parts.map(part => <li key={part.id}>
                                        <WorkRow item={part} span={span} open={open === part.id} onOpen={() => set({ open: open === part.id ? null : String(part.id) })} />
                                        {piece(part)}
                                    </li>)}</ul>}
                                </li>;
                            })}</ul>
                        </Panel>}
                    {view.changes.length > 0 && <details className="tw-roadmap-history">
                        <summary>{copy('Plan history', 'გეგმის ისტორია')} <span className="gk-faint gk-num">{view.changes.length}</span></summary>
                        <ol className="tw-history">{view.changes.map(change => <li key={change.id} className="tw-history__line">
                            <span className="tw-history__who">{change.author?.name ?? copy('Someone', 'ვიღაც')} · {ago(copy, change.at)}</span>
                            <span className="tw-history__message">{change.message}</span>
                        </li>)}</ol>
                    </details>}
                    <TeamPanel canManage={view.canManageTeam} />
                </>}
        {adding && view && <AddWorkDialog roadmapId={view.roadmap.id} parent={adding.parent} team={view.team} others={adding.others} onClose={() => setAdding(null)}
            onCreated={detail => { setAdding(null); set({ open: String(detail.item.id) }); reload(); }}
            onPlace={itemId => { setAdding(null); void changePlan({ order: [...ids, itemId] }); }} />}
        {pasting && view && <PasteDialog roadmapId={view.roadmap.id} onClose={() => setPasting(false)} onApplied={next => { setPasting(false); show(next); }} />}
        {naming && <NameDialog mode={naming} current={view?.roadmap ?? null} onClose={() => setNaming(null)} onDone={next => { setNaming(null); show(next); }} />}
    </PageFrame></GkRoot>;
}
