import { useEffect, useId, useRef, useState } from 'react';
import { Check, Folder, MoreHorizontal, X } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addPlanStep, fetchDetail, isDone, type Detail, type Plan, type PlanStatus, type PlanView, type WorkNode } from './api';
import { planAsText } from './planAsText';
import { ancestorsOf } from './planSteps';
import { useClickAway } from './useClickAway';
import { StatusDot } from './WorkBits';
import { ago, endWords, madeBy } from './teamWorkWords';

/**
 * The plan step by step: the plans that are its steps first (each with what it is for and its progress, complete
 * when it is live or finished), then its tasks in order, as cards joined by a line, swiped or scrolled sideways.
 * Done steps are solid, the current one stands out, later ones are quiet; a card opens its task or plan.
 */
export function OrderStrip({ nodes, steps = [], numbers, onOpen, onOpenPlan, onDetach }: {
    nodes: WorkNode[]; steps?: Plan[]; numbers: Map<number, number>; onOpen: (id: number) => void; onOpenPlan?: (id: number) => void; onDetach?: (plan: Plan) => void;
}) {
    const copy = useJourneyCopy();
    const track = useRef<HTMLOListElement>(null);
    const current = nodes.find(node => node.item.status === 'IN_PROGRESS') ?? nodes.find(node => !isDone(node.item.status));
    useEffect(() => {
        const card = track.current?.querySelector<HTMLElement>('[data-state="current"]');
        if (track.current && card) track.current.scrollLeft = Math.max(0, card.offsetLeft - 16);
    }, [current?.item.id]);
    if (nodes.length === 0 && steps.length === 0) return null;
    return <section className="tw-order" aria-labelledby="tw-order-title">
        <h2 id="tw-order-title" className="tw-section__title">{copy('In order', 'რიგითობით')}</h2>
        <ol ref={track} className="tw-order__track">
            {steps.map((plan, index) => {
                const state = plan.live ? 'done' : plan.percent > 0 || plan.inProgress > 0 ? 'current-plan' : 'later';
                return <li key={`p${plan.id}`} data-state={state} data-plan="" data-status={plan.live ? 'LIVE' : plan.inProgress > 0 ? 'IN_PROGRESS' : 'PLANNED'}>
                    <button type="button" onClick={() => onOpenPlan?.(plan.id)} aria-label={copy(`Plan ${plan.name}`, `გეგმა ${plan.name}`)}>
                        <span className="tw-order__top"><span className="tw-order__number gk-num">{state === 'done' ? <Check aria-hidden="true" /> : index + 1}</span><Folder className="tw-order__folder" aria-hidden="true" /><span className="gk-num tw-order__percent">{plan.percent}%</span></span>
                        <span className="tw-order__name">{plan.purpose ?? plan.name}</span>
                        {plan.purpose && <span className="tw-order__plan-name">{plan.name}</span>}
                        <span className="tw-order__bar"><span style={{ width: `${plan.percent}%` }} /></span>
                        <span className="tw-order__when">{plan.live ? copy('live', 'ლაივზეა') : copy(`plan · ${plan.taskCount - plan.done} open`, `გეგმა · ${plan.taskCount - plan.done} ღია`)}</span>
                    </button>
                    {onDetach && <button type="button" className="tw-icon-button tw-order__detach" aria-label={copy(`Take the plan ${plan.name} out`, `გეგმის ${plan.name} ამოღება`)} title={copy('Take out of this plan', 'ამ გეგმიდან ამოღება')} onClick={() => onDetach(plan)}><X aria-hidden="true" /></button>}
                </li>;
            })}
            {nodes.map(node => {
                const item = node.item;
                const state = isDone(item.status) ? 'done' : node === current ? 'current' : 'later';
                return <li key={item.id} data-state={state} data-status={item.status}>
                    <button type="button" onClick={() => onOpen(item.id)} aria-current={state === 'current' ? 'step' : undefined}>
                        <span className="tw-order__top"><span className="tw-order__number gk-num">{state === 'done' ? <Check aria-hidden="true" /> : (numbers.get(item.id) ?? 0) + steps.length}</span><StatusDot status={item.status} /><span className="gk-num tw-order__percent">{item.percent != null ? `${item.percent}%` : ''}</span></span>
                        <span className="tw-order__name">{item.description ?? item.title}</span>
                        {item.description && <span className="tw-order__plan-name">{item.title}</span>}
                        <span className="tw-order__bar"><span style={{ width: `${item.percent ?? (isDone(item.status) ? 100 : 0)}%` }} /></span>
                        <span className="tw-order__when">{state === 'done' ? copy('done', 'დასრულდა') : item.end.kind === 'UNKNOWN' ? copy('end not set', 'ვადა არ არის') : `${copy('ends', 'დასრულება')} ${endWords(copy, item.end)}`}</span>
                    </button>
                </li>;
            })}
        </ol>
    </section>;
}

const STATUSES: [PlanStatus, string, string][] = [['NOW', 'Working on it now', 'ახლა ვმუშაობთ'], ['LATER', 'Later', 'მოგვიანებით'], ['FINISHED', 'Finished', 'დასრულებული']];

/** The plan's extras behind "…": where it stands, a plan as a step, Copy for AI, a new version, a new name, its history. */
export function PlanMenu({ status, onStatus, onAddStep, onCopyForAi, onCopy, onRename, onHistory }: {
    status: PlanStatus; onStatus: (status: PlanStatus) => void; onAddStep: () => void; onCopyForAi: () => void; onCopy: () => void; onRename: () => void; onHistory: () => void;
}) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const menuId = useId();
    useClickAway(open, box, () => setOpen(false));
    const choose = (action: () => void) => () => { setOpen(false); action(); };
    return <div className="tw-menu" ref={box}>
        <Button size="sm" iconOnly variant="ghost" aria-label={copy('More for this plan', 'მეტი ამ გეგმისთვის')} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}><MoreHorizontal aria-hidden="true" /></Button>
        {open && <div className="tw-menu__list" id={menuId} role="menu">
            {STATUSES.map(([value, en, ka]) => <button key={value} type="button" role="menuitemradio" aria-checked={status === value} onClick={choose(() => { if (status !== value) onStatus(value); })}>
                <span className="tw-menu__check">{status === value && <Check aria-hidden="true" />}</span>{copy(en, ka)}
            </button>)}
            <hr />
            <button type="button" role="menuitem" onClick={choose(onAddStep)}><span className="tw-menu__check" />{copy('Add a plan as a step', 'გეგმის ნაბიჯად დამატება')}</button>
            <button type="button" role="menuitem" onClick={choose(onCopyForAi)}><span className="tw-menu__check" />{copy('Copy for AI', 'კოპირება AI-სთვის')}</button>
            <button type="button" role="menuitem" onClick={choose(onCopy)}><span className="tw-menu__check" />{copy('Copy as new version', 'ასლი ახალ ვერსიად')}</button>
            <button type="button" role="menuitem" onClick={choose(onRename)}><span className="tw-menu__check" />{copy('Rename', 'სახელის შეცვლა')}</button>
            <button type="button" role="menuitem" onClick={choose(onHistory)}><span className="tw-menu__check" />{copy('Plan history', 'გეგმის ისტორია')}</button>
        </div>}
    </div>;
}

/**
 * "Add a plan as a step": one of the other plans, shown by what it is for. Plans that are already part of a plan,
 * and the plans above this one, are left out, so no plan can end up inside itself.
 */
export function AddPlanStepDialog({ view, plans, onClose, onDone }: { view: PlanView; plans: Plan[]; onClose: () => void; onDone: (view: PlanView) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [chosen, setChosen] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const above = new Set(ancestorsOf(view.plan, plans));
    const free = plans.filter(plan => plan.id !== view.plan.id && plan.partOf == null && !above.has(plan.id));
    const add = async () => {
        if (!chosen) return;
        setBusy(true); setError('');
        try { onDone(await addPlanStep(view.plan.id, Number(chosen))); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That plan couldn’t be added.', 'ეს გეგმა ვერ დაემატა.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="sm" className="tw-dialog" title={copy('Add a plan as a step', 'გეგმის ნაბიჯად დამატება')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy(`The plan becomes a step of “${view.plan.name}”: it shows here with its purpose and progress, and is complete when it is live.`, `გეგმა „${view.plan.name}“-ის ნაბიჯი ხდება: აქ თავისი მიზნით და პროგრესით ჩანს და მზადაა, როცა ლაივზეა.`)}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy || !chosen} onClick={() => void add()}>{busy ? copy('Adding…', 'ემატება…') : copy('Add as a step', 'ნაბიჯად დამატება')}</Button></>}>
        <div className="tw-field">
            <label htmlFor={id}>{copy('Which plan', 'რომელი გეგმა')}</label>
            {free.length ? <select id={id} className="gk-input" autoFocus value={chosen} onChange={event => setChosen(event.target.value)}>
                <option value="">{copy('Pick a plan', 'აირჩიეთ გეგმა')}</option>
                {free.map(plan => <option key={plan.id} value={plan.id}>{plan.purpose ? `${plan.purpose} · ${plan.name}` : plan.name}</option>)}
            </select> : <p className="gk-faint">{copy('Every other plan is already part of a plan.', 'ყველა სხვა გეგმა უკვე რომელიმე გეგმის ნაწილია.')}</p>}
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}

/** The plan as text for Claude or Codex, copied on open and shown so nobody wonders what went to the clipboard. */
export function CopyForAiDialog({ view, onClose }: { view: PlanView; onClose: () => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [text, setText] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        const ids = view.tasks.flatMap(node => [node.item.id, ...node.steps.map(step => step.id)]);
        let live = true;
        Promise.all(ids.map(item => fetchDetail(item).then(detail => [item, detail] as const).catch(() => null)))
            .then(found => {
                if (!live) return;
                const next = planAsText(view, new Map(found.filter((entry): entry is readonly [number, Detail] => entry !== null)));
                setText(next);
                void navigator.clipboard?.writeText(next).then(() => { if (live) setCopied(true); }).catch(() => undefined);
            });
        return () => { live = false; };
    }, [view]);
    return <Dialog open size="lg" className="tw-dialog" title={copy('Copy for AI', 'კოპირება AI-სთვის')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copied ? copy('Copied. Give it to Claude or Codex, then paste their answer back with Paste from AI: tasks match by key, so nothing doubles.',
            'დაკოპირდა. მიეცით Claude-ს ან Codex-ს და პასუხი ჩასვით „ჩასმა AI-დან“-ით: საქმეები გასაღებით ემთხვევა, ასე რომ არაფერი გაორმაგდება.')
            : copy('Give it to Claude or Codex, then paste their answer back with Paste from AI: tasks match by key, so nothing doubles.',
            'მიეცით Claude-ს ან Codex-ს და პასუხი ჩასვით „ჩასმა AI-დან“-ით: საქმეები გასაღებით ემთხვევა, ასე რომ არაფერი გაორმაგდება.')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Close', 'დახურვა')}</Button>
            <Button variant="primary" disabled={!text} onClick={() => { if (text) void navigator.clipboard?.writeText(text).then(() => setCopied(true)); }}>{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button></>}>
        <label htmlFor={id} className="gk-visually-hidden">{copy('The plan as text', 'გეგმა ტექსტად')}</label>
        <textarea id={id} className="gk-input tw-paste__text" readOnly rows={14} value={text ?? copy('Gathering the plan…', 'გეგმა გროვდება…')} onFocus={event => event.target.select()} />
    </Dialog>;
}

/** Everything that happened to the plan: added, removed, reordered, renamed, pasted, moved between now and later. */
export function PlanHistoryDialog({ view, onClose }: { view: PlanView; onClose: () => void }) {
    const copy = useJourneyCopy();
    return <Dialog open size="md" className="tw-dialog" title={copy('Plan history', 'გეგმის ისტორია')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
        <ol className="tw-history">{view.changes.map(change => <li key={change.id} className="tw-history__line">
            <span className="tw-history__who">{madeBy(copy, change.author?.name, change.byDola)} · {ago(copy, change.at)}</span>
            <span className="tw-history__message">{change.message}</span>
        </li>)}</ol>
    </Dialog>;
}
