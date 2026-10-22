import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, ClipboardPaste, Plus } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { RouteRecoveryPage } from '../../pages/RouteRecoveryPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeRoadmap, createRoadmap, createWork, fetchBoard, fetchRoadmap, fetchRoadmaps, STARTER_WORK, type Roadmap, type RoadmapView, type WorkItem, type WorkNode } from './api';
import { AddWorkDialog, WorkPiece } from './WorkDetails';
import { PasteDialog } from './PasteDialog';
import { TeamPanel } from './TeamPanel';
import { TimeAxis, TimeBar, TimeWords } from './TimeStrip';
import { ColourKey, StatusDot } from './WorkBits';
import { ago, spanOf, type Span } from './teamWorkWords';
import './team-work.css';

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;

/** Who changed a roadmap last and when: "changed by Beqa · 2 h ago". */
function changedLine(copy: ReturnType<typeof useJourneyCopy>, roadmap: Roadmap) {
    return roadmap.updatedBy?.name ? copy(`changed by ${roadmap.updatedBy.name} · ${ago(copy, roadmap.updatedAt)}`, `შეცვალა ${roadmap.updatedBy.name} · ${ago(copy, roadmap.updatedAt)}`) : ago(copy, roadmap.updatedAt);
}

/** The roadmap switcher: every roadmap, newest change first, and the ways to start another. */
function RoadmapSwitcher({ roadmaps, current, onPick, onName }: { roadmaps: Roadmap[]; current: Roadmap; onPick: (id: number) => void; onName: (mode: 'new' | 'copy' | 'rename') => void }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const listId = useId();
    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
    }, [open]);
    const choose = (action: () => void) => { setOpen(false); action(); };
    return <div className="tw-switcher" ref={box}>
        <button type="button" className="tw-switcher__button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(value => !value)}>
            <span className="gk-faint">{copy('Roadmap', 'გეგმა')}</span><strong>{current.name}</strong><ChevronDown aria-hidden="true" />
        </button>
        <span className="tw-switcher__changed">{changedLine(copy, current)}{current.copiedFromName && <> · {copy(`copied from ${current.copiedFromName}`, `ასლი: ${current.copiedFromName}`)}</>}</span>
        {open && <div className="tw-switcher__menu" id={listId}>
            <ul aria-label={copy('Roadmaps', 'გეგმები')}>{roadmaps.map(roadmap => <li key={roadmap.id}>
                <button type="button" aria-current={roadmap.id === current.id || undefined} onClick={() => choose(() => onPick(roadmap.id))}>
                    <strong>{roadmap.name}</strong>
                    <span className="gk-faint">{copy(`${roadmap.pieceCount} pieces`, `${roadmap.pieceCount} საქმე`)} · {changedLine(copy, roadmap)}{roadmap.copiedFromName && ` · ${copy(`from ${roadmap.copiedFromName}`, `ასლი: ${roadmap.copiedFromName}`)}`}</span>
                </button>
            </li>)}</ul>
            <div className="tw-switcher__actions">
                <button type="button" onClick={() => choose(() => onName('copy'))}>{copy('Copy as new version', 'ასლი ახალ ვერსიად')}</button>
                <button type="button" onClick={() => choose(() => onName('rename'))}>{copy('Rename', 'სახელის შეცვლა')}</button>
                <button type="button" onClick={() => choose(() => onName('new'))}>{copy('New roadmap', 'ახალი გეგმა')}</button>
            </div>
        </div>}
    </div>;
}

/** Name a new roadmap, a copy of this one, or this one again. */
function NameDialog({ mode, current, onClose, onDone }: { mode: 'new' | 'copy' | 'rename'; current: Roadmap | null; onClose: () => void; onDone: (view: RoadmapView) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [name, setName] = useState(mode === 'rename' ? current?.name ?? '' : mode === 'copy' ? `${current?.name ?? ''} v2` : '');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const title = mode === 'copy' ? copy('Copy as new version', 'ასლი ახალ ვერსიად') : mode === 'rename' ? copy('Rename the roadmap', 'გეგმის სახელის შეცვლა') : copy('New roadmap', 'ახალი გეგმა');
    const save = async () => {
        if (!name.trim()) return;
        setBusy(true); setError('');
        try { onDone(mode === 'rename' && current ? await changeRoadmap(current.id, { version: current.version, name: name.trim() }) : await createRoadmap(name.trim(), mode === 'copy' ? current?.id : undefined)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="sm" className="tw-dialog" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={mode === 'copy' ? copy('The same pieces in the same order. This version stays as it is, and you can switch back to it.', 'იგივე საქმეები იგივე რიგით. ეს ვერსია უცვლელი რჩება და შეგიძლიათ დაუბრუნდეთ.') : undefined}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy || !name.trim()} onClick={() => void save()}>{copy('Save', 'შენახვა')}</Button></>}>
        <form className="tw-field" onSubmit={event => { event.preventDefault(); void save(); }}>
            <label htmlFor={id}>{copy('Name', 'სახელი')}</label>
            <input id={id} className="gk-input" autoFocus maxLength={80} value={name} placeholder={copy('October work', 'ოქტომბრის საქმეები')} onChange={event => setName(event.target.value)} />
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
            <span className="tw-row__text"><span className="tw-row__name">{item.title}</span><span className="tw-row__meta gk-num">{meta}</span><TimeWords item={item} /></span>
        </button>
        <TimeBar item={item} span={span} />
    </div>;
}

/**
 * Team work: what the team is building, as roadmaps that share their pieces. Each piece sits on a tree with its
 * parts and a time strip, and opens in place. Team accounts only; for anyone else the page does not exist.
 */
export function TeamWorkPage() {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
    const [view, setView] = useState<RoadmapView | null>(null);
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
            if (statusOf(failure) === 404 && !roadmaps) setMissing(true);
            else setError(extractApiErrorMessage(failure, copy('The roadmap could not load.', 'გეგმა ვერ ჩაიტვირთა.')));
        };
        fetchRoadmaps(controller.signal).then(list => {
            if (controller.signal.aborted) return;
            setRoadmaps(list); setError('');
            const pick = list.find(roadmap => roadmap.id === wanted) ?? list[0];
            if (!pick) { setView(null); return; }
            return fetchRoadmap(pick.id, controller.signal).then(next => { if (!controller.signal.aborted) setView(next); });
        }).catch(fail);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `roadmaps` only tells a first 404 from a later one
    }, [wanted, revision, copy]);

    const show = (next: RoadmapView) => { setView(next); set({ roadmap: String(next.roadmap.id) }); setRoadmaps(current => current && [next.roadmap, ...current.filter(roadmap => roadmap.id !== next.roadmap.id)]); };
    const order = async (ids: number[]) => {
        if (!view) return;
        setError('');
        try { show(await changeRoadmap(view.roadmap.id, { version: view.roadmap.version, order: ids })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The roadmap couldn’t be changed.', 'გეგმა ვერ შეიცვალა.'))); if (statusOf(failure) === 409) reload(); }
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
            onMove: by => { const at = ids.indexOf(item.id), next = [...ids]; next.splice(at, 1); next.splice(at + by, 0, item.id); void order(next); },
            onRemove: () => { set({ open: null }); void order(ids.filter(id => id !== item.id)); } }}
        onAddPart={node ? () => startAdding(item) : undefined} onOpen={id => set({ open: String(id) })} onClose={() => set({ open: null })} onSaved={() => { if (view) fetchRoadmap(view.roadmap.id).then(setView).catch(() => undefined); }} />;

    return <GkRoot className="gk-page"><PageFrame className="tw-page">
        <PageHeader title={copy('Team work', 'გუნდის სამუშაო')} subtitle={copy('What we’re building, where it stands', 'რას ვაშენებთ და სად ვართ')}
            actions={view && <span className="tw-actions">
                <Button size="sm" onClick={() => setPasting(true)}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button>
                <Button variant="primary" size="sm" onClick={() => startAdding()}><Plus aria-hidden="true" />{copy('Add work', 'საქმის დამატება')}</Button>
            </span>} />
        {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span><Button size="sm" onClick={reload}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
        {!roadmaps ? !error && <Panel flush><div className="gk-panel--pad" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div></Panel>
            : !view ? <Panel flush><EmptyNote title={copy('No roadmap yet', 'გეგმა ჯერ არ არის')}
                action={<div className="tw-empty-actions">
                    <Button variant="primary" size="sm" disabled={starting} onClick={() => void loadStarter()}>{starting ? copy('Loading…', 'იტვირთება…') : copy('Load this week’s work', 'ამ კვირის საქმეების ჩატვირთვა')}</Button>
                    <Button size="sm" onClick={() => setNaming('new')}><Plus aria-hidden="true" />{copy('New roadmap', 'ახალი გეგმა')}</Button>
                </div>}>
                {copy('A roadmap holds what the team is working on: where each piece stands, how far it is and when it should end.', 'გეგმაში ჩანს, რაზე მუშაობს გუნდი: სად არის თითო საქმე, რამდენი გაკეთდა და როდის დასრულდება.')}
            </EmptyNote></Panel>
                : <>
                    <div className="tw-bar-line">
                        <RoadmapSwitcher roadmaps={roadmaps} current={view.roadmap} onPick={id => set({ roadmap: String(id), open: null })} onName={setNaming} />
                        <ColourKey />
                    </div>
                    {view.trail.length > 0 && <p className="tw-trail" aria-label={copy('Latest switches', 'ბოლო გადართვები')}>
                        {view.trail.map((step, index) => <span key={`${step.itemId}:${step.at}`} className="tw-trail__step">
                            {index > 0 && <span className="tw-trail__arrow" aria-hidden="true">→</span>}
                            <button type="button" onClick={() => set({ open: String(step.itemId) })}>{step.title}</button><span className="gk-faint"> · {ago(copy, step.at)}</span>
                        </span>)}
                    </p>}
                    {view.pieces.length === 0
                        ? <Panel flush><EmptyNote title={copy('Nothing on this roadmap yet', 'ამ გეგმაზე ჯერ არაფერია')}
                            action={<div className="tw-empty-actions"><Button variant="primary" size="sm" onClick={() => startAdding()}><Plus aria-hidden="true" />{copy('Add work', 'საქმის დამატება')}</Button>
                                <Button size="sm" onClick={() => setPasting(true)}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button></div>}>
                            {copy('Add pieces one by one, or paste a list.', 'დაამატეთ სათითაოდ ან ჩასვით სია.')}
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
                        <summary>{copy('Roadmap history', 'გეგმის ისტორია')} <span className="gk-faint gk-num">{view.changes.length}</span></summary>
                        <ol className="tw-history">{view.changes.map(change => <li key={change.id} className="tw-history__line">
                            <span className="tw-history__who">{change.author?.name ?? copy('Someone', 'ვიღაც')} · {ago(copy, change.at)}</span>
                            <span className="tw-history__message">{change.message}</span>
                        </li>)}</ol>
                    </details>}
                    <TeamPanel canManage={view.canManageTeam} />
                </>}
        {adding && view && <AddWorkDialog roadmapId={view.roadmap.id} parent={adding.parent} team={view.team} others={adding.others} onClose={() => setAdding(null)}
            onCreated={detail => { setAdding(null); set({ open: String(detail.item.id) }); reload(); }}
            onPlace={itemId => { setAdding(null); void order([...ids, itemId]); }} />}
        {pasting && view && <PasteDialog roadmapId={view.roadmap.id} onClose={() => setPasting(false)} onApplied={next => { setPasting(false); show(next); }} />}
        {naming && <NameDialog mode={naming} current={view?.roadmap ?? null} onClose={() => setNaming(null)} onDone={next => { setNaming(null); show(next); }} />}
    </PageFrame></GkRoot>;
}
