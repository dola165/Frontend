import type { ReactNode } from 'react';
import { ArrowLeft, ClipboardPaste, Plus } from 'lucide-react';
import { Badge, Button, EmptyNote, Panel } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { PlanStatus, PlanView, WorkItem, WorkStatus } from './api';
import { TaskBox, type TaskActions } from './Overview';
import { PlanMenu, OrderStrip } from './PlanBits';
import { nodeMatches, peopleLine, type Who } from './planPeople';
import { StatusFilter } from './WorkBits';

const PLAN_STATUS: Record<PlanStatus, [string, string]> = { NOW: ['Now', 'ახლა'], LATER: ['Later', 'მოგვიანებით'], FINISHED: ['Finished', 'დასრულებული'] };
export type PlanDialog = 'paste' | 'ai' | 'history' | 'copy' | 'rename';

/**
 * A plan opened: its tasks as cards in the plan's order (a task opens to its details, its steps as lines),
 * then the same tasks in order. Paste from AI and Add task up front; the rest behind "…".
 */
export function PlanPage({ view, who, task, filter, statuses, actions, onStatuses, onBack, onChangePlan, onAdd, onDialog }: {
    view: PlanView; who: Who; task: number | null; filter: ReactNode; statuses: WorkStatus[]; actions: Omit<TaskActions, 'placeOf'>; onStatuses: (statuses: WorkStatus[]) => void;
    onBack: () => void; onChangePlan: (change: { order?: number[]; status?: PlanStatus }) => void; onAdd: (parent?: WorkItem) => void; onDialog: (dialog: PlanDialog) => void;
}) {
    const copy = useJourneyCopy();
    const ids = view.tasks.map(node => node.item.id);
    const numbers = new Map(ids.map((id, index) => [id, index + 1]));
    const shown = view.tasks.filter(node => nodeMatches(node, who, view.team) && (!statuses.length || statuses.includes(node.item.status)));
    const placed: TaskActions = {
        ...actions, planName: view.plan.name, onAddStep: parent => onAdd(parent),
        placeOf: item => ({ first: ids[0] === item.id, last: ids[ids.length - 1] === item.id,
            onMove: by => { const at = ids.indexOf(item.id), next = [...ids]; next.splice(at, 1); next.splice(at + by, 0, item.id); onChangePlan({ order: next }); },
            onRemove: () => { actions.onToggle(item.id); onChangePlan({ order: ids.filter(id => id !== item.id) }); } }),
    };
    const openTask = (id: number) => { if (task !== id) actions.onToggle(id); requestAnimationFrame(() => document.querySelector(`[data-task="${id}"]`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })); };

    return <>
        <div className="tw-plan-head">
            <button type="button" className="tw-back" onClick={onBack}><ArrowLeft aria-hidden="true" />{copy('Back to overview', 'მიმოხილვაზე დაბრუნება')}</button>
            <div className="tw-plan-head__row">
                <div className="tw-plan-head__title">
                    <h1>{view.plan.name}{view.plan.status !== 'NOW' && <Badge tone={view.plan.status === 'FINISHED' ? 'accent' : 'neutral'}>{copy(...PLAN_STATUS[view.plan.status])}</Badge>}</h1>
                    <span className="tw-plan-head__people">{peopleLine(copy, view)}</span>
                </div>
                <span className="tw-actions">
                    <Button size="sm" onClick={() => onDialog('paste')}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button>
                    <Button variant="primary" size="sm" onClick={() => onAdd()}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
                    <PlanMenu status={view.plan.status} onStatus={status => onChangePlan({ status })} onCopyForAi={() => onDialog('ai')} onCopy={() => onDialog('copy')} onRename={() => onDialog('rename')} onHistory={() => onDialog('history')} />
                </span>
            </div>
        </div>
        <div className="tw-bar-line">{filter}<StatusFilter chosen={statuses} onChange={onStatuses} /></div>
        {view.tasks.length === 0
            ? <Panel flush><EmptyNote title={copy('Nothing in this plan yet', 'ამ გეგმაში ჯერ არაფერია')}
                action={<div className="tw-empty-actions"><Button variant="primary" size="sm" onClick={() => onAdd()}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
                    <Button size="sm" onClick={() => onDialog('paste')}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button></div>}>
                {copy('Add tasks one by one, big or small, or paste a list.', 'დაამატეთ საქმეები სათითაოდ, დიდი თუ პატარა, ან ჩასვით სია.')}
            </EmptyNote></Panel>
            : shown.length === 0 ? <p className="gk-muted tw-quiet">{copy('Nothing in this plan for this filter.', 'ამ ფილტრით ამ გეგმაში არაფერია.')}</p>
            : <ul className="tw-tasks" aria-label={view.plan.name}>{shown.map(node => <TaskBox key={node.item.id} node={node} expanded={task === node.item.id} actions={placed} />)}</ul>}
        <OrderStrip nodes={shown} numbers={numbers} onOpen={openTask} />
    </>;
}
