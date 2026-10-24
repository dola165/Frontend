import { CornerDownRight, Folder, Pin, Plus } from 'lucide-react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { openCount, type Plan, type WorkNode } from './api';
import { UnpinButton } from './pins';
import { sortPlans } from './planSteps';
import type { Pins } from './usePins';
import { KeyChip, StatusDot } from './WorkBits';
import './team-work-plan-row.css';

/**
 * The plans in one row: your pinned plans first (their pin mark unpins them), then the others, each by its name in
 * bold with what it is for and what is still open, scrolled sideways when they don't fit; then New plan. Tasks you
 * pinned are small chips at the start of the row (under it on a phone), each opening its task.
 */
export function PlanRow({ pins, plans, nodes, onOpenPlan, onOpen, onNewPlan }: {
    pins: Pins; plans: Plan[]; nodes: Map<number, WorkNode>; onOpenPlan: (id: number) => void; onOpen: (taskId: number, stepId: number | null) => void; onNewPlan: () => void;
}) {
    const copy = useJourneyCopy();
    const ids = new Set(plans.map(plan => plan.id));
    const pinned = pins.pins.flatMap(pin => { const plan = pin.planId != null ? plans.find(candidate => candidate.id === pin.planId) : undefined; return plan ? [plan] : []; });
    const pinnedIds = new Set(pinned.map(plan => plan.id));
    const tasks = pins.pins.flatMap(pin => { const node = pin.itemId != null ? nodes.get(pin.itemId) : undefined; return node ? [node.item] : []; });
    const card = (plan: Plan, isPinned: boolean) => <li key={plan.id} className="tw-plan-row__plan" data-pinned={isPinned || undefined}>
        <button type="button" className="tw-plan-row__open" data-status={plan.status} onClick={() => onOpenPlan(plan.id)}>
            <span className="tw-plan-row__name">{plan.partOf && ids.has(plan.partOf.id) ? <CornerDownRight aria-hidden="true" /> : <Folder aria-hidden="true" />}<span>{plan.name}</span></span>
            <span className="tw-plan-row__line"><span className="tw-plan-row__purpose" data-missing={plan.purpose ? undefined : ''}>{plan.purpose ?? copy('Write what this plan is for', 'დაწერეთ, რისთვისაა ეს გეგმა')}</span>
                <span className="tw-plan-row__count gk-num">{plan.status === 'FINISHED' ? copy('finished', 'დასრულდა') : plan.live ? copy('live', 'ლაივზეა') : plan.taskCount === 0 ? `${plan.percent}%` : copy(`${openCount(plan)} open`, `${openCount(plan)} ღია`)}</span></span>
        </button>
        {isPinned && <button type="button" className="tw-plan-row__pin" aria-label={copy(`Unpin ${plan.name}`, `მოხსნა: ${plan.name}`)} title={copy('Pinned. Press to unpin', 'მიმაგრებულია. დააჭირეთ მოსახსნელად')} onClick={() => void pins.toggle({ planId: plan.id })}><Pin aria-hidden="true" /></button>}
    </li>;
    return <nav className="tw-plan-row" aria-label={copy('Plans', 'გეგმები')}>
        {tasks.length > 0 && <ul className="tw-plan-row__chips" aria-label={copy('Pinned tasks', 'მიმაგრებული საქმეები')}>{tasks.map(item => <li key={item.id} className="tw-plan-row__chip">
            <button type="button" className="tw-plan-row__chip-open" title={item.description ?? item.title} onClick={() => onOpen(item.id, null)}><Pin className="tw-plan-row__chip-pin" aria-hidden="true" /><StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-plan-row__chip-name">{item.title}</span></button>
            <UnpinButton pins={pins} target={{ itemId: item.id }} name={item.title} />
        </li>)}</ul>}
        <ul className="tw-plan-row__plans">
            {pinned.map(plan => card(plan, true))}
            {sortPlans(plans).filter(plan => !pinnedIds.has(plan.id)).map(plan => card(plan, false))}
            <li className="tw-plan-row__plan"><button type="button" className="tw-plan-row__open tw-plan-row__new" onClick={onNewPlan}><Plus aria-hidden="true" />{copy('New plan', 'ახალი გეგმა')}</button></li>
        </ul>
    </nav>;
}
