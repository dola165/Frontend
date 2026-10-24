import { useId, useState } from 'react';
import { CalendarDays, Folder, List, Rocket } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { isGone, LIST_ORDER, type Plan, type WorkItem } from './api';
import type { AgendaLayout } from './useAgendaFilter';
import { ago } from './teamWorkWords';
import { TaskRow } from './TaskRow';
import './team-work-now.css';

type Open = (taskId: number, stepId: number | null) => void;
const newest = (a: WorkItem, b: WorkItem) => b.updatedAt.localeCompare(a.updatedAt);
/** How many grey rows show before "Show all". */
const GONE_SHOWN = 12;

/** Rows under small headings, each heading only when its list has something. */
export function TaskGroups({ groups, planOf, parentOf, onOpen }: {
    groups: [title: string, items: WorkItem[]][]; planOf: Map<number, Plan>; parentOf?: Map<number, WorkItem>; onOpen: Open;
}) {
    return <div className="tw-groups">{groups.filter(([, items]) => items.length > 0).map(([title, items]) => <section key={title} className="tw-group" aria-label={title}>
        <h3 className="tw-group__title">{title} <span className="gk-faint gk-num">{items.length}</span></h3>
        <ul className="tw-rows">{items.map(item => {
            const parent = item.parentId != null ? parentOf?.get(item.parentId) : undefined;
            return <TaskRow key={item.id} item={item} parent={parent} planName={planOf.get(parent?.id ?? item.id)?.name} onOpen={onOpen} />;
        })}</ul>
    </section>)}</div>;
}

/**
 * Now: every task in progress or blocked, however old, so nothing slips under the days. What needs your look is in
 * Needs you above; planned work waits in the days and the plans; accepted, live and cancelled are not open.
 */
export function NowSection({ tasks, planOf, onOpen }: { tasks: WorkItem[]; planOf: Map<number, Plan>; onOpen: Open }) {
    const copy = useJourneyCopy();
    const titleId = useId();
    const of = (status: WorkItem['status']) => tasks.filter(item => item.status === status).sort(newest);
    const groups: [string, WorkItem[]][] = [[copy('In progress', 'მიმდინარე'), of('IN_PROGRESS')], [copy('Blocked', 'დაბლოკილი'), of('BLOCKED')]];
    const open = groups.reduce((count, [, items]) => count + items.length, 0);
    return <section className="tw-block tw-now" aria-labelledby={titleId}>
        <h2 id={titleId} className="tw-heading">{copy('Now', 'ახლა')} <span className="gk-faint gk-num">{open || ''}</span></h2>
        {open === 0 ? <p className="tw-quiet-row gk-muted" role="status">{copy('Nothing open right now.', 'ახლა ღია არაფერია.')}</p>
            : <TaskGroups groups={groups} planOf={planOf} onOpen={onOpen} />}
    </section>;
}

/** At the very bottom: live and cancelled work as thin grey rows, newest first; the rest one tap away. */
export function GoneRows({ tasks, planOf, onOpen }: { tasks: WorkItem[]; planOf: Map<number, Plan>; onOpen: Open }) {
    const copy = useJourneyCopy();
    const titleId = useId();
    const [all, setAll] = useState(false);
    const gone = tasks.filter(item => isGone(item.status)).sort(newest);
    if (!gone.length) return null;
    const shown = all ? gone : gone.slice(0, GONE_SHOWN);
    return <section className="tw-gone" aria-labelledby={titleId}>
        <h2 id={titleId} className="tw-gone__title">{copy('Live and cancelled', 'ლაივზე და გაუქმებული')} <span className="gk-num">{gone.length}</span></h2>
        <ul className="tw-rows tw-rows--quiet">{shown.map(item => <TaskRow key={item.id} item={item} planName={planOf.get(item.id)?.name} quiet onOpen={onOpen} />)}</ul>
        {gone.length > shown.length && <button type="button" className="tw-link-button tw-gone__more" onClick={() => setAll(true)}>{copy(`Show all ${gone.length}`, `ყველას ჩვენება (${gone.length})`)}</button>}
    </section>;
}

/** Every task on one line each: what moves first, then by last change; live and cancelled sink to the grey rows. */
export function TaskList({ tasks, planOf, onOpen }: { tasks: WorkItem[]; planOf: Map<number, Plan>; onOpen: Open }) {
    const copy = useJourneyCopy();
    const open = tasks.filter(item => !isGone(item.status)).sort((a, b) => LIST_ORDER.indexOf(a.status) - LIST_ORDER.indexOf(b.status) || newest(a, b));
    if (!tasks.length) return <p className="tw-quiet-row gk-muted" role="status">{copy('Nothing for this filter.', 'ამ ფილტრით არაფერია.')}</p>;
    return <div className="tw-list">
        {open.length > 0 && <ul className="tw-rows" aria-label={copy('Tasks', 'საქმეები')}>{open.map(item => <TaskRow key={item.id} item={item} planName={planOf.get(item.id)?.name} onOpen={onOpen} />)}</ul>}
        <GoneRows tasks={tasks} planOf={planOf} onOpen={onOpen} />
    </div>;
}

/** "By day | List": the same tasks and filters, as day cards or as one line per task. Kept in the link (`?show=list`). */
export function LayoutSwitch({ layout, onChange }: { layout: AgendaLayout; onChange: (layout: AgendaLayout) => void }) {
    const copy = useJourneyCopy();
    const options: [AgendaLayout, typeof List, string][] = [['day', CalendarDays, copy('By day', 'დღეებით')], ['list', List, copy('List', 'სია')]];
    return <div className="tw-switch" role="group" aria-label={copy('Show as', 'ჩვენება')}>
        {options.map(([value, Icon, label]) => <button key={value} type="button" aria-pressed={layout === value} onClick={() => onChange(value)}><Icon aria-hidden="true" />{label}</button>)}
    </div>;
}

/** What went live lately and the plans that are finished or live, newest first; each opens its task or plan. */
export function LiveDialog({ tasks, plans, planOf, onOpen, onOpenPlan, onClose }: {
    tasks: WorkItem[]; plans: Plan[]; planOf: Map<number, Plan>; onOpen: Open; onOpenPlan: (id: number) => void; onClose: () => void;
}) {
    const copy = useJourneyCopy();
    const live = tasks.filter(item => item.status === 'LIVE').sort(newest).slice(0, 20);
    const finished = plans.filter(plan => plan.live || plan.status === 'FINISHED').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return <Dialog open size="md" className="tw-dialog" title={copy('What’s live', 'რა არის ლაივზე')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<Button variant="ghost" onClick={onClose}>{copy('Close', 'დახურვა')}</Button>}>
        {live.length === 0 && finished.length === 0 ? <p className="gk-muted">{copy('Nothing has gone live yet.', 'ლაივზე ჯერ არაფერი გასულა.')}</p> : <div className="tw-live">
            {finished.length > 0 && <section aria-label={copy('Plans', 'გეგმები')}><h3 className="tw-group__title">{copy('Plans', 'გეგმები')}</h3>
                <ul className="tw-rows">{finished.map(plan => <li key={plan.id} className="tw-row" data-status="LIVE"><button type="button" className="tw-row__open" onClick={() => { onClose(); onOpenPlan(plan.id); }}>
                    <Folder className="tw-live__folder" aria-hidden="true" /><span className="tw-row__name">{plan.name}</span>
                    <span className="tw-row__plan">{plan.status === 'FINISHED' ? copy('finished', 'დასრულდა') : copy('live', 'ლაივზეა')}</span>
                    <span className="tw-row__when gk-num">{ago(copy, plan.updatedAt)}</span>
                </button></li>)}</ul></section>}
            {live.length > 0 && <section aria-label={copy('Went live', 'ლაივზე გავიდა')}><h3 className="tw-group__title"><Rocket aria-hidden="true" />{copy('Went live', 'ლაივზე გავიდა')}</h3>
                <ul className="tw-rows">{live.map(item => <TaskRow key={item.id} item={item} planName={planOf.get(item.id)?.name} onOpen={(task, step) => { onClose(); onOpen(task, step); }} />)}</ul></section>}
        </div>}
    </Dialog>;
}
