import { Folder } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Person, Plan, WorkItem, WorkNode } from './api';
import { PinButton } from './pins';
import type { Pins } from './usePins';
import { TaskView, type PlaceOnPlan } from './TaskView';
import { KeyChip, StatusDot } from './WorkBits';

export interface TaskActions {
    open: number | null; team: Person[]; me: number | null;
    onToggle: (id: number) => void; onOpen: (id: number | null) => void; onAddStep: (parent: WorkItem) => void; onSaved: () => void; onDeleted: () => void;
    /** Every top-level task, for links from one to another. */
    candidates: WorkItem[];
    /** On a plan page: move the task up or down, or take it off the plan. */
    placeOf?: (item: WorkItem) => PlaceOnPlan;
    /** The plan page the task is on, for Copy for AI. */
    planName?: string;
}

/** A task opened: its page, and the step chosen from it below. */
export function TaskBody({ node, plan, actions, framed = false, onClose }: { node: WorkNode; plan?: Plan; actions: TaskActions; framed?: boolean; onClose: () => void }) {
    const copy = useJourneyCopy();
    const { item, steps } = node;
    const { open, team, me, onOpen, onAddStep, onSaved, onDeleted, placeOf, planName, candidates } = actions;
    const step = steps.find(candidate => candidate.id === open);
    return <>
        <TaskView id={item.id} team={team} me={me} plan={plan?.name ?? planName} place={placeOf?.(item)} candidates={candidates} framed={framed} onOpen={id => onOpen(open === id ? null : id)} onAddStep={() => onAddStep(item)} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />
        {step && <div className="tw-task__step">
            <p className="tw-task__step-title"><StatusDot status={step.status} /><KeyChip value={step.key} /><span className="gk-faint">{copy('Step', 'ნაბიჯი')}:</span> {step.title}</p>
            <TaskView key={step.id} id={step.id} team={team} me={me} plan={plan?.name ?? planName} candidates={candidates} framed onOpen={onOpen} onClose={() => onOpen(null)} onSaved={onSaved} onDeleted={() => { onOpen(null); onSaved(); }} />
        </div>}
    </>;
}

/**
 * A task opened from a card, Needs you or a pin: a big panel over the page (nearly the whole screen on a desktop, a
 * sheet on a phone). Its head is the quiet line (status, key, name) with your pin and its plan; the page inside
 * starts with what the task is for. `?task=` (and `?step=` for one of its steps) keep it open across a reload.
 */
export function TaskDialog({ node, plan, actions, pins, onOpenPlan }: { node: WorkNode; plan?: Plan; actions: TaskActions; pins: Pins; onOpenPlan?: (id: number) => void }) {
    const copy = useJourneyCopy();
    const { item } = node;
    const close = () => actions.onToggle(item.id);
    return <Dialog open size="lg" className="tw-dialog tw-task-dialog" onClose={close} closeLabel={copy('Close', 'დახურვა')}
        title={<span className="tw-task-dialog__title"><StatusDot status={item.status} /><KeyChip value={item.key} /><span>{item.title}</span></span>}
        description={<span className="tw-task-dialog__bar">
            <PinButton pins={pins} target={{ itemId: item.id }} name={item.title} withLabel />
            {plan && onOpenPlan && <button type="button" className="tw-link-button" onClick={() => onOpenPlan(plan.id)}><Folder aria-hidden="true" />{plan.name}</button>}
            {pins.error && <span className="gk-notice gk-notice--danger" role="alert">{pins.error}</span>}
        </span>}>
        <TaskBody node={node} plan={plan} actions={actions} framed onClose={close} />
    </Dialog>;
}
