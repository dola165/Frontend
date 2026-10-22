import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { DataTable, PrimaryCell, ViewTabs, type Column } from '../../design/DataTable';
import { nextSort, sortRows, type TableSort } from '../../design/tableSort';
import { extractApiErrorMessage } from '../../utils/apiError';
import { RouteRecoveryPage } from '../../pages/RouteRecoveryPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { createWork, fetchBoard, STARTER_WORK, STATUSES, type Board, type WorkItem, type WorkStatus } from './api';
import { AddWorkDialog, WorkDetails } from './WorkDetails';
import { TeamPanel } from './TeamPanel';
import { ago, statusName } from './teamWorkWords';
import { WorkProgress, WorkStatusLabel } from './WorkBits';
import './team-work.css';

const isMissing = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 404;
const sortValue = (item: WorkItem, by: string) => by === 'status' ? STATUSES.indexOf(item.status) : by === 'progress' ? item.percent : by === 'updated' ? -Date.parse(item.updatedAt) : item.title.toLowerCase();

/**
 * Team work: what the team is building, where each piece stands and who touched it when. Team accounts only; for
 * anyone else the page does not exist. The trail shows the latest switches between pieces of work.
 */
export function TeamWorkPage() {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const [state, setState] = useState<{ board: Board | null; error: string; missing: boolean }>({ board: null, error: '', missing: false });
    const [revision, setRevision] = useState(0);
    const [adding, setAdding] = useState(false);
    const [starting, setStarting] = useState(false);
    const status = STATUSES.find(value => value === params.get('status')) ?? 'ALL';
    const open = Number(params.get('item')) || null;
    const sort: TableSort | null = params.get('sort') ? { by: params.get('sort')!, descending: params.get('dir') === 'desc' } : null;
    const reload = () => setRevision(value => value + 1);

    useEffect(() => {
        const controller = new AbortController();
        fetchBoard(controller.signal)
            .then(board => { if (!controller.signal.aborted) setState({ board, error: '', missing: false }); })
            .catch(error => { if (!controller.signal.aborted) setState(current => ({ ...current, error: isMissing(error) ? '' : extractApiErrorMessage(error, copy('The board could not load.', 'დაფა ვერ ჩაიტვირთა.')), missing: isMissing(error) })); });
        return () => controller.abort();
    }, [revision, copy]);

    const set = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
        setParams(next, { replace: true });
    };
    const loadStarter = async () => {
        setStarting(true);
        try { for (const work of STARTER_WORK) await createWork(work); }
        catch (error) { setState(current => ({ ...current, error: extractApiErrorMessage(error, copy('Some work could not be added.', 'ზოგიერთი საქმე ვერ დაემატა.')) })); }
        finally { setStarting(false); reload(); }
    };

    if (state.missing) return <RouteRecoveryPage />;
    const board = state.board;
    const items = board?.items ?? [];
    const shown = sortRows(status === 'ALL' ? items : items.filter(item => item.status === status), sort, sortValue);
    const count = (value: WorkStatus) => items.filter(item => item.status === value).length;
    const columns: Column<WorkItem>[] = [
        { id: 'title', label: copy('Work', 'საქმე'), width: 'minmax(0, 2fr)', sortable: true, render: item => <PrimaryCell title={item.title} subtitle={item.area ?? undefined} /> },
        { id: 'status', label: copy('Status', 'სტატუსი'), width: '128px', sortable: true, render: item => <WorkStatusLabel status={item.status} /> },
        { id: 'progress', label: copy('Where it stands', 'სად ვართ'), width: 'minmax(0, 2fr)', sortable: true, render: item => <WorkProgress item={item} /> },
        { id: 'updated', label: copy('Last touched', 'ბოლოს'), width: '150px', sortable: true, narrowLabel: copy('Last touched', 'ბოლოს'),
            render: item => <span className="tw-who">{[item.updatedBy?.name, ago(copy, item.updatedAt)].filter(Boolean).join(' · ')}</span> },
    ];

    return <GkRoot className="gk-page"><PageFrame className="tw-page">
        <PageHeader title={copy('Team work', 'გუნდის სამუშაო')} subtitle={copy('What we’re building, where it stands', 'რას ვაშენებთ და სად ვართ')}
            actions={board && <Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{copy('Add work', 'საქმის დამატება')}</Button>} />
        {state.error && <div className="gk-notice gk-notice--danger" role="alert"><span>{state.error}</span><Button size="sm" onClick={reload}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
        {!board ? !state.error && <Panel flush><div className="gk-panel--pad" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div></Panel>
            : <>
                {board.trail.length > 0 && <p className="tw-trail" aria-label={copy('Latest switches', 'ბოლო გადართვები')}>
                    {board.trail.map((step, index) => <span key={`${step.itemId}:${step.at}`} className="tw-trail__step">
                        {index > 0 && <span className="tw-trail__arrow" aria-hidden="true">→</span>}
                        <button type="button" onClick={() => set({ item: String(step.itemId) })}>{step.title}</button><span className="gk-faint"> · {ago(copy, step.at)}</span>
                    </span>)}
                </p>}
                {items.length > 0 && <ViewTabs label={copy('Show', 'ჩვენება')} value={status} onChange={value => set({ status: value === 'ALL' ? null : value })}
                    views={[{ id: 'ALL', label: copy('All', 'ყველა'), count: items.length }, ...STATUSES.map(value => ({ id: value, label: statusName(copy, value), count: count(value) }))]} />}
                {items.length === 0
                    ? <Panel flush><EmptyNote title={copy('Nothing on the board yet', 'დაფაზე ჯერ არაფერია')}
                        action={<div className="tw-empty-actions">
                            {board.canManageTeam && <Button variant="primary" size="sm" disabled={starting} onClick={() => void loadStarter()}>{starting ? copy('Loading…', 'იტვირთება…') : copy('Load this week’s work', 'ამ კვირის საქმეების ჩატვირთვა')}</Button>}
                            <Button size="sm" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{copy('Add work', 'საქმის დამატება')}</Button>
                        </div>}>
                        {copy('Add what the team is working on: where it stands, how far it is and who touched it last.', 'დაამატეთ, რაზეც გუნდი მუშაობს: სად არის, რამდენი გაკეთდა და ვინ შეეხო ბოლოს.')}
                    </EmptyNote></Panel>
                    : shown.length === 0
                        ? <p className="gk-muted tw-quiet">{copy('Nothing here right now.', 'აქ ახლა არაფერია.')}</p>
                        : <DataTable label={copy('Team work', 'გუნდის სამუშაო')} columns={columns} rows={shown} rowKey={item => item.id} onOpen={item => set({ item: String(item.id) })}
                            sort={sort} onSort={by => { const next = nextSort(sort, by); set({ sort: next?.by ?? null, dir: next?.descending ? 'desc' : null }); }} />}
                <TeamPanel canManage={board.canManageTeam} />
            </>}
        {open && <WorkDetails id={open} onClose={() => set({ item: null })} onSaved={reload} />}
        {adding && <AddWorkDialog onClose={() => setAdding(false)} onCreated={detail => { setAdding(false); reload(); set({ item: String(detail.item.id) }); }} />}
    </PageFrame></GkRoot>;
}
