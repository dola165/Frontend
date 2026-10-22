import { useId, type ReactNode } from 'react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { STATUSES, type EndKind, type EndUnit, type Person, type WorkEnd, type WorkStatus } from './api';
import { statusName } from './teamWorkWords';

/** A status as a coloured dot; its name is there for screen readers and on hover. */
export function StatusDot({ status }: { status: WorkStatus }) {
    const copy = useJourneyCopy();
    return <span className="tw-dot" data-status={status} role="img" aria-label={statusName(copy, status)} title={statusName(copy, status)} />;
}

/** A quiet tag for a small fix (a button, a complaint), so it doesn't look like a project. */
export function SmallChip() {
    const copy = useJourneyCopy();
    return <span className="tw-chip">{copy('small', 'პატარა')}</span>;
}

/** Big work or a small fix. */
export function SmallPick({ small, onChange }: { small: boolean; onChange: (small: boolean) => void }) {
    const copy = useJourneyCopy();
    return <label className="tw-check"><input type="checkbox" checked={small} onChange={event => onChange(event.target.checked)} />{copy('Small fix (a button, a complaint)', 'პატარა შესწორება (ღილაკი, საჩივარი)')}</label>;
}

/** The one-line key for the dots. */
export function ColourKey() {
    const copy = useJourneyCopy();
    return <p className="tw-key">{STATUSES.map(status => <span key={status}><span className="tw-dot" data-status={status} aria-hidden="true" />{statusName(copy, status)}</span>)}</p>;
}

export function Field({ label, children, wide = false }: { label: string; children: (id: string) => ReactNode; wide?: boolean }) {
    const id = useId();
    return <div className={`tw-field${wide ? ' tw-field--wide' : ''}`}><label htmlFor={id}>{label}</label>{children(id)}</div>;
}

/** Status and a percent slider in steps of 5: the quick part of every edit. Finished means 100%. */
export function QuickEdit({ status, percent, fromParts = false, onChange }: { status: WorkStatus; percent: number; fromParts?: boolean; onChange: (change: { status?: WorkStatus; percent?: number }) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    return <div className="tw-quick">
        <div className="tw-status-pick" role="radiogroup" aria-label={copy('Status', 'სტატუსი')}>
            {STATUSES.map(value => <button key={value} type="button" role="radio" aria-checked={status === value} data-status={value}
                onClick={() => onChange(value === 'FINISHED' && status !== 'FINISHED' && !fromParts ? { status: value, percent: 100 } : { status: value })}>
                <span className="tw-dot" aria-hidden="true" />{statusName(copy, value)}
            </button>)}
        </div>
        <div className="tw-slider"><label htmlFor={id}>{copy('Done', 'შესრულებულია')}</label>
            <input id={id} type="range" min={0} max={100} step={5} value={percent} disabled={fromParts} onChange={event => onChange({ percent: Number(event.target.value) })} />
            <output htmlFor={id} className="gk-num">{percent}%</output>
        </div>
    </div>;
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

/** Who is on a piece: the team as toggles. */
export function PeoplePick({ team, chosen, onChange }: { team: Person[]; chosen: number[]; onChange: (people: number[]) => void }) {
    const copy = useJourneyCopy();
    return <div className="tw-field tw-field--wide">
        <span className="tw-field__label">{copy('Who’s on it', 'ვინ მუშაობს')}</span>
        <div className="tw-people-pick">{team.map(person => person.id != null && <button key={person.id} type="button" aria-pressed={chosen.includes(person.id)}
            onClick={() => onChange(chosen.includes(person.id!) ? chosen.filter(id => id !== person.id) : [...chosen, person.id!])}>{person.name ?? '—'}</button>)}</div>
    </div>;
}

