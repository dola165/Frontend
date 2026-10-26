import { CircleHelp } from 'lucide-react';
import { DiscussButton } from '../teamChat/DiscussButton';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { WorkItem } from './api';
import { DoneTip } from './DoneTip';
import { useTaskMenu } from './useTaskMenu';
import { useDoneTip } from './useDoneTip';
import { ago } from './teamWorkWords';
import { KeyChip, StatusDot } from './WorkBits';

/**
 * One task on one line: its dot, key and short name (bold), who is on it, its plan and when it last changed, with
 * "Done means" on hover, focus or a long press. A step opens under its task. `quiet` is the thin grey row of work that
 * is live or cancelled: smaller, lighter, never bold. Right-click (or hold) it to open, discuss, move, copy or pin it.
 */
export function TaskRow({ item, parent, planName, quiet = false, onOpen }: {
    item: WorkItem; parent?: WorkItem; planName?: string; quiet?: boolean; onOpen: (taskId: number, stepId: number | null) => void;
}) {
    const copy = useJourneyCopy();
    const tip = useDoneTip();
    const who = item.people.map(person => person.name).filter(Boolean).join(', ');
    const where = [parent && copy(`step of ${parent.key}`, `${parent.key}-ის ნაბიჯი`), planName].filter(Boolean).join(' · ');
    const when = [item.updatedBy?.name, ago(copy, item.updatedAt)].filter(Boolean).join(' · ');
    const open = () => onOpen(parent?.id ?? item.id, parent ? item.id : null);
    const menu = useTaskMenu(item, open);
    return <li className="tw-row" data-status={item.status} data-quiet={quiet || undefined} {...tip.holder}>
        <button type="button" className="tw-row__open gk-cm-target" {...tip.trigger} {...menu.bind} onClick={() => { if (!tip.swallow()) open(); }}>
            <StatusDot status={item.status} /><KeyChip value={item.key} />
            <span className="tw-row__name" title={item.title}>{item.title}</span>
            {item.openQuestions > 0 && <span className="tw-task__ask gk-num" title={copy('Questions for Beqa', 'კითხვები ბექასთვის')}><CircleHelp aria-hidden="true" />{item.openQuestions}</span>}
            <span className="tw-row__who" title={who || undefined}>{who || <span className="gk-faint">{copy('nobody yet', 'ჯერ არავინ')}</span>}</span>
            <span className="tw-row__plan" title={where || undefined}>{where}</span>
            <span className="tw-row__when gk-num" title={copy('Last change', 'ბოლო ცვლილება')}>{when}</span>
        </button>
        <DiscussButton task={item} compact />
        <DoneTip id={tip.id} doneMeans={item.doneMeans} />
        {menu.notice && <span className="tw-row__notice" role="status">{menu.notice}</span>}
        {menu.menu}
    </li>;
}
