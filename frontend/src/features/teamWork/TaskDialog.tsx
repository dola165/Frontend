import { Folder } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Plan, WorkNode } from './api';
import { PinButton } from './pins';
import type { Pins } from './usePins';
import { TaskBody, type TaskActions } from './TaskBox';
import { KeyChip, StatusDot } from './WorkBits';

/**
 * A task opened from the agenda, Needs you or a pin: its details in a dialog, with your pin and its plan on top.
 * `?task=` (and `?step=` for one of its steps) keep it open across a reload.
 */
export function TaskDialog({ node, plan, actions, pins, onOpenPlan }: { node: WorkNode; plan?: Plan; actions: TaskActions; pins: Pins; onOpenPlan?: (id: number) => void }) {
    const copy = useJourneyCopy();
    const { item } = node;
    const close = () => actions.onToggle(item.id);
    return <Dialog open size="lg" className="tw-dialog tw-task-dialog" onClose={close} closeLabel={copy('Close', 'დახურვა')}
        title={<span className="tw-task-dialog__title"><StatusDot status={item.status} /><KeyChip value={item.key} /><span>{item.title}</span></span>}>
        <div className="tw-task-dialog__bar">
            <PinButton pins={pins} target={{ itemId: item.id }} name={item.title} withLabel />
            {plan && onOpenPlan && <button type="button" className="tw-link-button" onClick={() => onOpenPlan(plan.id)}><Folder aria-hidden="true" />{plan.name}</button>}
        </div>
        {pins.error && <p className="gk-notice gk-notice--danger" role="alert">{pins.error}</p>}
        <TaskBody node={node} plan={plan} actions={actions} onClose={close} />
    </Dialog>;
}
