import { ArrowLeft, ClipboardPaste, Folder, Paperclip, Plus } from 'lucide-react';
import { Badge, Button, EmptyNote, Panel } from '../../design/primitives';
import { useFileDrop } from '../../components/work/useFileDrop';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Plan, PlanStatus, PlanView, WorkItem } from './api';
import { Agenda, AgendaToolbar } from './Agenda';
import { LayoutSwitch, TaskList } from './NowLists';
import { useAgendaFilter } from './useAgendaFilter';
import { nodesOf } from './agendaRows';
import { PinButton } from './pins';
import { usePins } from './usePins';
import { TaskMenuProvider } from './TaskMenuProvider';
import { PlanMenu, OrderStrip } from './PlanBits';
import { nodeMatches, peopleLine } from './planPeople';
import { PlanMedia } from './PlanMedia';
import { PurposeChanged, PurposeLine } from './PurposeBits';
import { TaskDialog, type TaskActions } from './TaskDialog';
import { usePlanUploads } from './useUploads';
import './team-work-agenda.css';

const PLAN_STATUS: Record<PlanStatus, [string, string]> = { NOW: ['Now', 'ახლა'], LATER: ['Later', 'მოგვიანებით'], FINISHED: ['Finished', 'დასრულებული'] };
export type PlanDialog = 'paste' | 'ai' | 'history' | 'copy' | 'rename' | 'addStep';
const NO_FINDINGS = new Set<number>();

/**
 * A plan opened: its name, big and bold, what it is for under it (or a prompt to write it), "Was: … → now: …" when
 * the point of it changed, and the plan it is part of. Then the plan step by step (the plans that are its steps, then
 * its tasks in order) and, day by day, cards for what happened in it, or its tasks one per line ("List", `?show=`).
 * One toolbar filters by person and status (`?who=`, `?status=`). Pictures, videos and files sit after the steps, and a
 * file dropped anywhere on the page joins them. Paste from AI and Add task up front; the rest behind "…".
 */
export function PlanPage({ view, items, views, planOf, lines, revision, task, actions, onBack, onChangePlan, onViewChanged, onDetach, onAdd, onDialog, onOpenPlan }: {
    view: PlanView; items: WorkItem[]; views: Map<number, PlanView>; planOf: Map<number, Plan>; lines: Map<number, string>; revision: number; task: number | null; actions: Omit<TaskActions, 'placeOf'>;
    onBack: () => void; onChangePlan: (change: { order?: number[]; status?: PlanStatus; purpose?: string }) => void; onViewChanged: (next: PlanView) => void; onDetach: (plan: Plan) => void; onAdd: (parent?: WorkItem) => void; onDialog: (dialog: PlanDialog) => void; onOpenPlan: (id: number) => void;
}) {
    const copy = useJourneyCopy();
    const agenda = useAgendaFilter();
    const pins = usePins(revision);
    const uploads = usePlanUploads(view.plan.id, onViewChanged);
    const drop = useFileDrop(files => void uploads.upload(files));
    const media = <PlanMedia planId={view.plan.id} media={view.media ?? []} uploads={uploads} onChanged={onViewChanged} />;
    const ids = view.tasks.map(node => node.item.id);
    const numbers = new Map(ids.map((id, index) => [id, index + 1]));
    const { who, statuses } = agenda.filter;
    const shown = view.tasks.filter(node => nodeMatches(node, who, view.team) && (!statuses.length || statuses.includes(node.item.status)));
    const clear = () => agenda.change({ who: null, statuses: [] });
    const placed: TaskActions = {
        ...actions, planName: view.plan.name, onAddStep: parent => onAdd(parent),
        placeOf: item => ({ first: ids[0] === item.id, last: ids[ids.length - 1] === item.id,
            onMove: by => { const at = ids.indexOf(item.id), next = [...ids]; next.splice(at, 1); next.splice(at + by, 0, item.id); onChangePlan({ order: next }); },
            onRemove: () => { actions.onToggle(item.id); onChangePlan({ order: ids.filter(id => id !== item.id) }); } }),
    };
    const nodes = nodesOf(items);
    // What happened in this plan, and in the plans that are its steps.
    const scope = new Set([...ids, ...view.steps.flatMap(step => views.get(step.id)?.tasks.map(node => node.item.id) ?? [])]);
    const opened = task != null && scope.has(task) ? nodes.get(task) : undefined;
    const empty = view.tasks.length === 0 && view.steps.length === 0;
    const partOf = view.plan.partOf;
    const listed = [...scope].flatMap(id => { const node = nodes.get(id); return node && nodeMatches(node, who, view.team) && (!statuses.length || statuses.includes(node.item.status)) ? [node.item] : []; });

    // The open task keeps its own drop: its dialog sits outside this area, so a file dropped there lands once, on the task.
    return <TaskMenuProvider pins={pins}>
        <div className="tw-plan-body" data-dragging={drop.dragging || undefined} {...drop.bind}>
        {drop.dragging && <div className="tw-drop-overlay" aria-hidden="true"><span className="tw-drop-overlay__word"><Paperclip />{copy('Drop to add it to this plan', 'ჩააგდეთ, რომ ამ გეგმას მიემაგროს')}</span></div>}
        <div className="tw-plan-head">
            <div className="tw-plan-head__crumbs">
                <button type="button" className="tw-back" onClick={onBack}><ArrowLeft aria-hidden="true" />{copy('Back to overview', 'მიმოხილვაზე დაბრუნება')}</button>
                {partOf && <button type="button" className="tw-back tw-part-of" title={partOf.purpose ?? undefined} onClick={() => onOpenPlan(partOf.id)}><Folder aria-hidden="true" />{copy(`Part of ${partOf.name}`, `${partOf.name}-ის ნაწილი`)}</button>}
            </div>
            <div className="tw-plan-head__row">
                <div className="tw-plan-head__title">
                    <h1 className="tw-plan-head__name"><Folder aria-hidden="true" /><span>{view.plan.name}</span>{view.plan.status !== 'NOW' && <Badge tone={view.plan.status === 'FINISHED' ? 'accent' : 'neutral'}>{copy(...PLAN_STATUS[view.plan.status])}</Badge>}
                        <span className="tw-plan-head__people">{peopleLine(copy, view)}</span></h1>
                    <PurposeLine as="p" purpose={view.plan.purpose} label={copy('What this plan is for', 'რისთვისაა ეს გეგმა')} prompt={copy('Write what this plan is for', 'დაწერეთ, რისთვისაა ეს გეგმა')} onSave={purpose => onChangePlan({ purpose })} />
                    <PurposeChanged changes={view.purposeChanges} what="plan" />
                </div>
                <span className="tw-actions">
                    <PinButton pins={pins} target={{ planId: view.plan.id }} name={view.plan.name} withLabel />
                    <Button size="sm" onClick={() => onDialog('paste')}><ClipboardPaste aria-hidden="true" />{copy('Paste from AI', 'ჩასმა AI-დან')}</Button>
                    <Button variant="primary" size="sm" onClick={() => onAdd()}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
                    <PlanMenu status={view.plan.status} onStatus={status => onChangePlan({ status })} onAddStep={() => onDialog('addStep')} onCopyForAi={() => onDialog('ai')} onCopy={() => onDialog('copy')} onRename={() => onDialog('rename')} onHistory={() => onDialog('history')} />
                </span>
            </div>
        </div>
        {pins.error && <p className="gk-notice gk-notice--danger" role="alert">{pins.error}</p>}
        {empty
            ? <>{media}<Panel flush><EmptyNote title={copy('No tasks in this plan yet', 'ამ გეგმაში საქმეები ჯერ არ არის')}
                action={<div className="tw-empty-actions"><Button variant="primary" size="sm" onClick={() => onAdd()}><Plus aria-hidden="true" />{copy('Add task', 'საქმის დამატება')}</Button>
                    <Button size="sm" onClick={() => onDialog('addStep')}><Folder aria-hidden="true" />{copy('Add a plan as a step', 'გეგმის ნაბიჯად დამატება')}</Button></div>} /></Panel></>
            : <>
                <OrderStrip nodes={shown} steps={who == null && !statuses.length ? view.steps : []} numbers={numbers} onOpen={id => { if (task !== id) actions.onToggle(id); }} onOpenPlan={onOpenPlan} onDetach={onDetach} />
                {media}
                <div className="tw-bar-line">
                    <h2 className="tw-heading">{agenda.layout === 'list' ? copy('Tasks', 'საქმეები') : copy('What happened', 'რა მოხდა')}</h2>
                    <div className="tw-work-bar">
                        <LayoutSwitch layout={agenda.layout} onChange={agenda.setLayout} />
                        <AgendaToolbar team={view.team} lines={lines} filter={agenda.filter} onChange={agenda.change} />
                    </div>
                </div>
                {agenda.layout === 'list' ? <TaskList tasks={listed} planOf={planOf} onOpen={agenda.open} />
                    : <Agenda revision={revision} filter={{ ...agenda.filter, plan: null }} context={{ nodes, planOf, planItems: new Map(), team: view.team }} exclude={NO_FINDINGS} scope={scope} showPlan={view.steps.length > 0}
                        pinned={id => pins.pinned({ itemId: id })} onOpen={agenda.open} onClear={clear} />}
            </>}
        </div>
        {opened && <TaskDialog node={opened} plan={planOf.get(opened.item.id)} actions={placed} pins={pins} onOpenPlan={onOpenPlan} />}
    </TaskMenuProvider>;
}
