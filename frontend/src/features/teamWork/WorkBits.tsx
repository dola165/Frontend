import { useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { PRIORITIES, STATUSES, isDone, type EndKind, type EndUnit, type Person, type Priority, type WorkEnd, type WorkStatus } from './api';
import { ESTIMATES, priorityName, statusName } from './teamWorkWords';
import { useClickAway } from './useClickAway';

/** A status as a coloured dot; its name is there for screen readers and on hover. */
export function StatusDot({ status }: { status: WorkStatus }) {
    const copy = useJourneyCopy();
    return <span className="tw-dot" data-status={status} role="img" aria-label={statusName(copy, status)} title={statusName(copy, status)} />;
}

/** The task's key, GK-142, quiet and in numerals. */
export const KeyChip = ({ value }: { value: string }) => <span className="tw-key-chip gk-num">{value}</span>;

/** A quiet tag for a small fix (a button, a complaint), so it doesn't look like a plan. */
export function SmallChip() {
    const copy = useJourneyCopy();
    return <span className="tw-chip">{copy('small', 'პატარა')}</span>;
}

/** Big work or a small fix. */
export function SmallPick({ small, onChange }: { small: boolean; onChange: (small: boolean) => void }) {
    const copy = useJourneyCopy();
    return <label className="tw-check"><input type="checkbox" checked={small} onChange={event => onChange(event.target.checked)} />{copy('Small fix (a button, a complaint)', 'პატარა შესწორება (ღილაკი, საჩივარი)')}</label>;
}

/**
 * The status as one compact control: the current status (its dot and name), and the other five one tap away.
 * Accepted or live fills a percent to 100 unless the task follows its steps.
 */
export function StatusMenu({ status, percent = null, fromSteps = false, onChange }: { status: WorkStatus; percent?: number | null; fromSteps?: boolean; onChange: (change: { status: WorkStatus; percent?: number }) => void }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const menuId = useId();
    useClickAway(open, box, () => setOpen(false));
    return <div className="tw-menu tw-status-menu" ref={box} data-status={status}>
        <button type="button" className="tw-status-menu__button" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} aria-label={copy(`Status: ${statusName(copy, status)}`, `სტატუსი: ${statusName(copy, status)}`)} onClick={() => setOpen(value => !value)}>
            <span className="tw-dot" aria-hidden="true" /><span>{statusName(copy, status)}</span><ChevronDown aria-hidden="true" />
        </button>
        {open && <div className="tw-menu__list" id={menuId} role="menu">
            {STATUSES.map(value => <button key={value} type="button" role="menuitemradio" aria-checked={status === value} data-status={value}
                onClick={() => { setOpen(false); if (value !== status) onChange(isDone(value) && !isDone(status) && !fromSteps && percent != null ? { status: value, percent: 100 } : { status: value }); }}>
                <span className="tw-menu__check">{status === value && <Check aria-hidden="true" />}</span><span className="tw-dot" aria-hidden="true" />{statusName(copy, value)}
            </button>)}
        </div>}
    </div>;
}

/** The colours explained and, pressed, a filter: one or more statuses, none for all. */
export function StatusFilter({ chosen, onChange }: { chosen: WorkStatus[]; onChange: (chosen: WorkStatus[]) => void }) {
    const copy = useJourneyCopy();
    return <div className="tw-key" role="group" aria-label={copy('Show by status', 'სტატუსით ჩვენება')}>{STATUSES.map(status => <button key={status} type="button" data-status={status} aria-pressed={chosen.includes(status)}
        onClick={() => onChange(chosen.includes(status) ? chosen.filter(other => other !== status) : [...chosen, status])}>
        <span className="tw-dot" data-status={status} aria-hidden="true" />{statusName(copy, status)}
    </button>)}</div>;
}

export function Field({ label, children, wide = false }: { label: string; children: (id: string) => ReactNode; wide?: boolean }) {
    const id = useId();
    return <div className={`tw-field${wide ? ' tw-field--wide' : ''}`}><label htmlFor={id}>{label}</label>{children(id)}</div>;
}

/**
 * Progress, estimated in five words (not started, started, halfway, nearly done, done); "Exact" opens a slider in
 * steps of 5; "No percent" takes it off. Shown only when someone opens the Progress fold.
 */
export function ProgressPick({ percent, onChange }: { percent: number | null; onChange: (percent: number | null) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const estimated = percent == null || ESTIMATES.some(([value]) => value === percent);
    const [exact, setExact] = useState(!estimated);
    return <div className="tw-progress-pick">
        <div className="tw-estimate" role="radiogroup" aria-label={copy('Progress', 'პროგრესი')}>
            <button type="button" role="radio" aria-checked={percent == null} onClick={() => { setExact(false); onChange(null); }}>{copy('No percent', 'უპროცენტოდ')}</button>
            {ESTIMATES.map(([value, en, ka]) => <button key={value} type="button" role="radio" aria-checked={!exact && percent === value} onClick={() => { setExact(false); onChange(value); }}>{copy(en, ka)}</button>)}
            <button type="button" className="tw-estimate__exact" aria-pressed={exact} onClick={() => setExact(value => !value)}>{copy('Exact', 'ზუსტად')}</button>
        </div>
        {exact && <div className="tw-slider"><label htmlFor={id}>{copy('Exact progress', 'ზუსტი პროგრესი')}</label>
            <input id={id} type="range" min={0} max={100} step={5} value={percent ?? 0} onChange={event => onChange(Number(event.target.value))} />
            <output htmlFor={id} className="gk-num">{percent ?? 0}%</output>
        </div>}
    </div>;
}

/** Status and progress together, for a new task: the six statuses as radios, then the progress words. */
export function QuickEdit({ status, percent, onChange }: { status: WorkStatus; percent: number | null; onChange: (change: { status?: WorkStatus; percent?: number | null }) => void }) {
    const copy = useJourneyCopy();
    return <div className="tw-quick">
        <div className="tw-status-pick" role="radiogroup" aria-label={copy('Status', 'სტატუსი')}>
            {STATUSES.map(value => <button key={value} type="button" role="radio" aria-checked={status === value} data-status={value}
                onClick={() => onChange(isDone(value) && !isDone(status) && percent != null ? { status: value, percent: 100 } : { status: value })}>
                <span className="tw-dot" aria-hidden="true" />{statusName(copy, value)}
            </button>)}
        </div>
        <ProgressPick percent={percent} onChange={next => onChange({ percent: next })} />
    </div>;
}

/** Now, next, later, or nothing said. */
export function PriorityPick({ priority, onChange }: { priority: Priority | null; onChange: (priority: Priority | null) => void }) {
    const copy = useJourneyCopy();
    return <div className="tw-field">
        <span className="tw-field__label">{copy('Priority', 'პრიორიტეტი')}</span>
        <div className="tw-people-pick" role="radiogroup" aria-label={copy('Priority', 'პრიორიტეტი')}>
            {PRIORITIES.map(value => <button key={value} type="button" role="radio" aria-checked={priority === value} data-priority={value} onClick={() => onChange(priority === value ? null : value)}>{priorityName(copy, value)}</button>)}
        </div>
    </div>;
}

/** One team member or nobody: who asked for the task. */
export function PersonPick({ label, team, chosen, onChange }: { label: string; team: Person[]; chosen: number | null; onChange: (id: number | null) => void }) {
    const copy = useJourneyCopy();
    return <Field label={label}>{fieldId => <select id={fieldId} className="gk-input" value={chosen ?? ''} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
        <option value="">{copy('Nobody in particular', 'არავინ კონკრეტულად')}</option>
        {team.flatMap(person => person.id == null ? [] : [<option key={person.id} value={person.id}>{person.name ?? '—'}</option>])}
    </select>}</Field>;
}

const KINDS: [EndKind, string, string][] = [['DATE', 'On a date', 'თარიღზე'], ['ABOUT', 'About', 'დაახლოებით'], ['POSSIBLY', 'Possibly in', 'შესაძლოა'], ['UNKNOWN', 'Don’t know', 'არ ვიცით']];

/** The expected end: an exact date, about N days/weeks/months, possibly a month, or not known. */
export function EndPick({ end, onChange }: { end: WorkEnd; onChange: (end: WorkEnd) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const month = end.kind === 'POSSIBLY' && end.date ? end.date.slice(0, 7) : '';
    return <div className="tw-field tw-end">
        <label htmlFor={id}>{copy('Expected end', 'სავარაუდო დასრულება')}</label>
        <div className="tw-end__row">
            <select id={id} className="gk-input" value={end.kind} onChange={event => {
                const kind = event.target.value as EndKind;
                onChange(kind === 'ABOUT' ? { kind, amount: end.amount ?? 2, unit: end.unit ?? 'WEEKS' } : kind === 'UNKNOWN' ? { kind } : { kind, date: end.date ?? null });
            }}>{KINDS.map(([kind, en, ka]) => <option key={kind} value={kind}>{copy(en, ka)}</option>)}</select>
            {end.kind === 'DATE' && <input className="gk-input" type="date" aria-label={copy('End date', 'დასრულების თარიღი')} value={end.date ?? ''} onChange={event => onChange({ kind: 'DATE', date: event.target.value || null })} />}
            {end.kind === 'ABOUT' && <>
                <input className="gk-input tw-end__amount" type="number" min={1} max={99} aria-label={copy('How many', 'რამდენი')} value={end.amount ?? ''} onChange={event => onChange({ ...end, amount: Number(event.target.value) || null })} />
                <select className="gk-input" aria-label={copy('Unit', 'ერთეული')} value={end.unit ?? 'WEEKS'} onChange={event => onChange({ ...end, unit: event.target.value as EndUnit })}>
                    <option value="DAYS">{copy('days', 'დღე')}</option><option value="WEEKS">{copy('weeks', 'კვირა')}</option><option value="MONTHS">{copy('months', 'თვე')}</option>
                </select>
            </>}
            {end.kind === 'POSSIBLY' && <input className="gk-input" type="month" aria-label={copy('Month', 'თვე')} value={month} onChange={event => onChange({ kind: 'POSSIBLY', date: event.target.value ? `${event.target.value}-01` : null })} />}
        </div>
    </div>;
}

/** Who is on a task: the team as toggles. */
export function PeoplePick({ team, chosen, onChange }: { team: Person[]; chosen: number[]; onChange: (people: number[]) => void }) {
    const copy = useJourneyCopy();
    return <div className="tw-field tw-field--wide">
        <span className="tw-field__label">{copy('Who’s on it', 'ვინ მუშაობს')}</span>
        <div className="tw-people-pick">{team.map(person => person.id != null && <button key={person.id} type="button" aria-pressed={chosen.includes(person.id)}
            onClick={() => onChange(chosen.includes(person.id!) ? chosen.filter(id => id !== person.id) : [...chosen, person.id!])}>{person.name ?? '—'}</button>)}</div>
    </div>;
}
