import { useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, ClipboardPaste, Plus } from 'lucide-react';
import { Badge, Button, EmptyNote, Panel } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { PlanStatus, RoadmapView, WorkItem, WorkNode, WorkStatus } from './api';
import { WorkPiece } from './WorkDetails';
import { PlanMenu, StepStrip } from './PlanBits';
import { nodeMatches, peopleLine, type Who } from './planPeople';
import { SmallChip, StatusDot, StatusFilter } from './WorkBits';

const PLAN_STATUS: Record<PlanStatus, [string, string]> = { NOW: ['Now', 'ახლა'], LATER: ['Later', 'მოგვიანებით'], FINISHED: ['Finished', 'დასრულებული'] };
export type PlanDialog = 'paste' | 'ai' | 'history' | 'copy' | 'rename';

/** One line of the list: the dot, the name, a "small" tag, then "3 stages · 70%" or the percent, and who is on it. */
function WorkRow({ item, parts, open, folded, onOpen, onFold }: { item: WorkItem; parts?: WorkItem[]; open: boolean; folded?: boolean; onOpen: () => void; onFold?: () => void }) {
    const copy = useJourneyCopy();
    const names = item.people.map(person => person.name).filter(Boolean).join(', ');
    const meta = [parts?.length ? copy(`${parts.length} stages · ${item.percent}%`, `${parts.length} ეტაპი · ${item.percent}%`) : `${item.percent}%`, names].filter(Boolean).join(' · ');
    return <div className="tw-row" data-status={item.status} data-depth={item.parentId != null ? 1 : 0} data-open={open || undefined}>
        <span className="tw-row__fold">{onFold && <button type="button" className="tw-icon-button" aria-expanded={!folded} aria-label={folded ? copy(`Show the stages of ${item.title}`, `${item.title} — ეტაპების ჩვენება`) : copy(`Hide the stages of ${item.title}`, `${item.title} — ეტაპების დამალვა`)}
            onClick={onFold}>{folded ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button>}</span>
        <button type="button" className="tw-row__main" aria-expanded={open} onClick={onOpen}>
            <StatusDot status={item.status} />
            <span className="tw-row__text"><span className="tw-row__name">{item.title}</span>{item.small && <SmallChip />}<span className="tw-row__meta gk-num">{meta}</span></span>
        </button>
    </div>;
}

/**
 * A project opened: its tasks as a list with their stages (a task opens in place under its row), then the same
 * tasks step by step. Paste from AI and Add task up front; the rest behind "…".
 */
export function PlanView({ view, who, open, me, filter, statuses, onStatuses, onBack, onOpen, onChangePlan, onAdd, onDialog, onRefresh }: {
    view: RoadmapView; who: Who; open: number | null; me: number | null; filter: ReactNode; statuses: WorkStatus[]; onStatuses: (statuses: WorkStatus[]) => void; onBack: () => void; onOpen: (id: number | null) => void;
    onChangePlan: (change: { order?: number[]; status?: PlanStatus }) => void; onAdd: (parent?: WorkItem) => void; onDialog: (dialog: PlanDialog) => void; onRefresh: () => void;
}) {
    const copy = useJourneyCopy();
    const [folded, setFolded] = useState<number[]>([]);
    const ids = view.pieces.map(node => node.item.id);
    const numbers = new Map(ids.map((id, index) => [id, index + 1]));
    const shown = view.pieces.filter(node => nodeMatches(node, who, view.team) && (!statuses.length || statuses.includes(node.item.status)));
    const piece = (item: WorkItem, node?: WorkNode) => open === item.id && <WorkPiece key={`piece-${item.id}`} id={item.id} team={view.team} me={me}
        place={node && { first: ids[0] === item.id, last: ids[ids.length - 1] === item.id,
            onMove: by => { const at = ids.indexOf(item.id), next = [...ids]; next.splice(at, 1); next.splice(at + by, 0, item.id); onChangePlan({ order: next }); },
            onRemove: () => { onOpen(null); onChangePlan({ order: ids.filter(id => id !== item.id) }); } }}
        onAddPart={node ? () => onAdd(item) : undefined} onOpen={onOpen} onClose={() => onOpen(null)} onSaved={onRefresh} />;
    const openPiece = (id: number) => { onOpen(id); requestAnimationFrame(() => document.querySelector(`[data-piece="${id}"]`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })); };

    return <>
        <div className="tw-plan-head">
            <button type="button" className="tw-back" onClick={onBack}><ArrowLeft aria-hidden="true" />{copy('Back to progress', 'პროგრესზე დაბრუნება')}</button>
            <div className="tw-plan-head__row">
                <div className="tw-plan-head__title">
                    <h1>{view.roadmap.name}{view.roadmap.status !== 'NOW' && <Badge tone={view.roadmap.status === 'FINISHED' ? 'accent' : 'neutral'}>{copy(...PLAN_STATUS[view.roadmap.status])}</Badge>}</h1>
                    <span className="tw-plan-head__people">{peopleLine(copy, view)}</span>
                </div>
                <span className="tw-actions">
                    <Button size="sm" onClick={() => onDialog('paste')}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button>
                    <Button variant="primary" size="sm" onClick={() => onAdd()}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
                    <PlanMenu status={view.roadmap.status} onStatus={status => onChangePlan({ status })} onCopyForAi={() => onDialog('ai')} onCopy={() => onDialog('copy')} onRename={() => onDialog('rename')} onHistory={() => onDialog('history')} />
                </span>
            </div>
        </div>
        <div className="tw-bar-line">{filter}<StatusFilter chosen={statuses} onChange={onStatuses} /></div>
        {view.pieces.length === 0
            ? <Panel flush><EmptyNote title={copy('Nothing in this project yet', 'ამ პროექტში ჯერ არაფერია')}
                action={<div className="tw-empty-actions"><Button variant="primary" size="sm" onClick={() => onAdd()}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
                    <Button size="sm" onClick={() => onDialog('paste')}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button></div>}>
                {copy('Add tasks one by one, big or small, or paste a list.', 'დაამატეთ საქმეები სათითაოდ, დიდი თუ პატარა, ან ჩასვით სია.')}
            </EmptyNote></Panel>
            : shown.length === 0 ? <p className="gk-muted tw-quiet">{copy('Nothing in this project for this filter.', 'ამ ფილტრით ამ პროექტში არაფერია.')}</p>
            : <Panel flush className="tw-tree-panel">
                <ul className="tw-tree" aria-label={view.roadmap.name}>{shown.map(node => {
                    const isFolded = folded.includes(node.item.id);
                    return <li key={node.item.id} data-piece={node.item.id}>
                        <WorkRow item={node.item} parts={node.parts} open={open === node.item.id} folded={isFolded}
                            onOpen={() => onOpen(open === node.item.id ? null : node.item.id)}
                            onFold={node.parts.length ? () => setFolded(current => isFolded ? current.filter(id => id !== node.item.id) : [...current, node.item.id]) : undefined} />
                        {piece(node.item, node)}
                        {node.parts.length > 0 && (!isFolded || node.parts.some(part => part.id === open)) && <ul className="tw-tree__parts">{node.parts.map(part => <li key={part.id} data-piece={part.id}>
                            <WorkRow item={part} open={open === part.id} onOpen={() => onOpen(open === part.id ? null : part.id)} />
                            {piece(part)}
                        </li>)}</ul>}
                    </li>;
                })}</ul>
            </Panel>}
        <StepStrip nodes={shown} numbers={numbers} onOpen={openPiece} />
    </>;
}
