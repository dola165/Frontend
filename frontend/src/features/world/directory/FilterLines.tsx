import { useId, useState, type ReactNode } from 'react';
import { Check, ChevronDown, LocateFixed, SlidersHorizontal, X } from 'lucide-react';
import { useWorldCopy } from '../copy';
import { useWorldData } from '../useWorldData';
import type { FilterControls } from './DirectoryFilters';
import { LookPicker } from './pickers';
import { offered, type ChoiceFilter, type DateFilter, type FilterDef, type NearbyFilter, type ScopeFilter, type TextFilter } from './types';
import type { DirectoryState } from './useDirectoryState';
import './lines.css';

/**
 * One long line: its name on the left, its value on the right, a caret at the end. Pressing it opens its choices
 * right under it, in the column, pushing what follows down: nothing floats, nothing to look away to.
 */
function Line({ label, value, open, on, onToggle, children }: { label: ReactNode; value: ReactNode; open: boolean; /** A choice the person made lights the line. */ on: boolean; onToggle: () => void; children: ReactNode }) {
    const id = useId();
    return (
        <div className="gk-world-line" data-open={open || undefined}>
            <button type="button" className="gk-world-line__row" aria-expanded={open} aria-controls={open ? id : undefined} data-on={on || undefined} onClick={onToggle}>
                <span className="gk-world-line__label">{label}</span>
                <span className="gk-world-line__value">{value}</span>
                <ChevronDown className="gk-world-line__caret" aria-hidden="true" />
            </button>
            {open && <div id={id} className="gk-world-line__choices">{children}</div>}
        </div>
    );
}

/** A choice as a line: one option closes it, several stay open until the line is pressed again. */
function ChoiceLine({ filter, state, signedIn }: { filter: ChoiceFilter; state: FilterControls; signedIn: boolean }) {
    const t = useWorldCopy();
    const [open, setOpen] = useState(false);
    const values = state.query.values[filter.key] ?? [];
    const options = offered(filter, signedIn);
    const chosen = options.filter(option => values.includes(option.value));
    const value = !chosen.length ? t(filter.allLabel ?? 'Any') : chosen.length === 1 ? t(chosen[0].label) : `${t(chosen[0].label)} +${chosen.length - 1}`;
    const on = chosen.length > 0 && !(filter.fallback && values.length === 1 && values[0] === filter.fallback);
    const pick = (next: string) => {
        if (filter.multi) state.toggleValue(filter.key, next, true);
        else { state.setValues(filter.key, next ? [next] : []); setOpen(false); }
    };
    const all = !filter.multi && !filter.fallback ? [{ value: '', label: filter.allLabel ?? 'All' }] : [];
    return (
        <Line label={t(filter.label)} value={value} open={open} on={on} onToggle={() => setOpen(current => !current)}>
            {filter.look ? <LookPicker filter={filter} options={options} values={values} pick={pick} />
                : <div role="group" aria-label={t(filter.label)} className="gk-world-line__options">
                    {[...all, ...options].map(option => {
                        const lit = option.value ? values.includes(option.value) : values.length === 0;
                        return (
                            <button key={option.value || 'all'} type="button" className="gk-world-line__option" aria-pressed={lit} onClick={() => pick(option.value)}>
                                {t(option.label)}{lit && <Check aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>}
        </Line>
    );
}

/** A text or date filter as a line: pressed, it opens its field; the value commits on Enter or when the field loses focus. */
function InputLine({ filter, state }: { filter: TextFilter | DateFilter; state: FilterControls }) {
    const t = useWorldCopy();
    const [open, setOpen] = useState(false);
    const value = state.query.values[filter.key]?.[0] ?? '';
    const [draft, setDraft] = useState(value);
    const [seen, setSeen] = useState(value);
    if (seen !== value) { setSeen(value); setDraft(value); }
    const commit = () => { const next = draft.trim(); if (next !== value) state.setValues(filter.key, next ? [next] : []); };
    const placeholder = filter.kind === 'text' && filter.placeholder ? t(filter.placeholder) : t('Any');
    return (
        <Line label={t(filter.label)} value={value || placeholder} open={open} on={Boolean(value)} onToggle={() => setOpen(current => !current)}>
            {filter.kind === 'date'
                ? <input type="date" className="gk-input" aria-label={t(filter.label)} value={value} min={filter.min?.()} onChange={event => state.setValues(filter.key, event.target.value ? [event.target.value] : [])} />
                : <input className="gk-input" aria-label={t(filter.label)} value={draft} maxLength={100} placeholder={placeholder} inputMode={filter.inputMode} autoFocus
                    onChange={event => setDraft(event.target.value)} onBlur={commit}
                    onKeyDown={event => { if (event.key === 'Enter') { commit(); setOpen(false); } }} />}
        </Line>
    );
}

/** An on/off filter: the line itself is the switch, a tick at its end when on. */
function ToggleLine({ filter, state }: { filter: FilterDef; state: FilterControls }) {
    const t = useWorldCopy();
    const on = state.query.values[filter.key]?.[0] === 'true';
    return (
        <button type="button" className="gk-world-line__row" aria-pressed={on} data-on={on || undefined} onClick={() => state.setValues(filter.key, on ? [] : ['true'])}>
            <span className="gk-world-line__label">{t(filter.label)}</span>
            <span className="gk-world-line__tick" aria-hidden="true">{on && <Check />}</span>
        </button>
    );
}

/** "Near me" as a line: asks the device for its location only when pressed, then keeps the position in the URL. */
function NearbyLine({ filter, state }: { filter: NearbyFilter; state: FilterControls }) {
    const t = useWorldCopy();
    const [status, setStatus] = useState<'idle' | 'locating' | 'failed'>('idle');
    const on = Boolean(state.query.values[filter.key]?.[0]);
    const choose = () => {
        if (on) return state.setValues(filter.key, []);
        if (!navigator.geolocation) return setStatus('failed');
        setStatus('locating');
        navigator.geolocation.getCurrentPosition(
            position => { setStatus('idle'); state.setValues(filter.key, [`${position.coords.latitude.toFixed(4)},${position.coords.longitude.toFixed(4)}`]); },
            () => setStatus('failed'), { timeout: 10_000, maximumAge: 300_000 });
    };
    return (
        <>
            <button type="button" className="gk-world-line__row" aria-pressed={on} data-on={on || undefined} disabled={status === 'locating'} onClick={choose}>
                <span className="gk-world-line__label"><LocateFixed aria-hidden="true" />{t(filter.label)}</span>
                <span className="gk-world-line__value">{on ? t('Within {km} km of you', { km: filter.km }) : status === 'locating' ? t('Finding you…') : ''}</span>
            </button>
            {status === 'failed' && <p role="status" className="gk-world-line__note">{t('Your location is not available. Choose a city instead.')}</p>}
        </>
    );
}

/** A scope from a link (one club, one organiser), named once that is known; pressing the line removes it. */
function ScopeLine({ filter, value, onRemove }: { filter: ScopeFilter; value: string; onRemove: () => void }) {
    const t = useWorldCopy();
    const named = useWorldData(filter.name && value ? `scope:${filter.key}:${value}` : null, signal => filter.name!(value, signal).catch(() => null));
    const label = named.data || t(filter.label);
    return (
        <button type="button" className="gk-world-line__row" data-on onClick={onRemove} aria-label={t('Remove filter: {name}', { name: label })}>
            <span className="gk-world-line__label">{t('Showing only')}</span>
            <span className="gk-world-line__value">{label}</span>
            <X className="gk-world-line__caret" aria-hidden="true" />
        </button>
    );
}

function FilterLine({ filter, state, signedIn }: { filter: FilterDef; state: FilterControls; signedIn: boolean }) {
    if (filter.kind === 'choice') return <ChoiceLine filter={filter} state={state} signedIn={signedIn} />;
    if (filter.kind === 'toggle') return <ToggleLine filter={filter} state={state} />;
    if (filter.kind === 'nearby') return <NearbyLine filter={filter} state={state} />;
    if (filter.kind === 'text' || filter.kind === 'date') return <InputLine filter={filter} state={state} />;
    return null;
}

/**
 * The filters as long lines, one under another, in the Map tab's column: the main ones first, the rest behind one
 * "More filters" line that opens them in place (open from the start when one of them is set). A scope from a link is a
 * line that removes it, and Clear filters ends the column. Nothing here moves the map.
 */
export function FilterLines({ state, signedIn, onClear }: { state: DirectoryState; signedIn: boolean; /** Absent when nothing can be cleared. */ onClear?: () => void }) {
    const t = useWorldCopy();
    const visible = state.source.filters.filter(filter => filter.kind !== 'scope' && !filter.nav && (!filter.when || filter.when(state.query)));
    const scopes = state.activeFilters.filter(filter => filter.kind === 'scope');
    const isPrimary = (filter: FilterDef) => filter.kind === 'nearby' || ((filter.kind === 'choice' || filter.kind === 'toggle') && filter.primary);
    const primary = visible.filter(isPrimary), secondary = visible.filter(filter => !isPrimary(filter));
    const secondaryActive = state.activeFilters.filter(filter => secondary.includes(filter)).length;
    const [more, setMore] = useState(secondaryActive > 0);
    const moreId = useId();
    if (!visible.length && !scopes.length && !onClear) return null;
    return (
        <div className="gk-world-lines" role="group" aria-label={t('Filters')}>
            {scopes.map(filter => filter.kind === 'scope' && <ScopeLine key={filter.key} filter={filter} value={state.query.values[filter.key]?.[0] ?? ''} onRemove={() => state.setValues(filter.key, [])} />)}
            {primary.map(filter => <FilterLine key={`${filter.kind}:${filter.key}`} filter={filter} state={state} signedIn={signedIn} />)}
            {secondary.length > 0 && (
                <>
                    <button type="button" className="gk-world-line__row gk-world-line__more" aria-expanded={more} aria-controls={more ? moreId : undefined} onClick={() => setMore(current => !current)}>
                        <span className="gk-world-line__label"><SlidersHorizontal aria-hidden="true" />{more ? t('Fewer filters') : t('More filters')}</span>
                        <span className="gk-world-line__value">{secondaryActive > 0 ? <span className="gk-num">{secondaryActive}</span> : ''}</span>
                        <ChevronDown className="gk-world-line__caret" aria-hidden="true" />
                    </button>
                    {more && <div id={moreId} className="gk-world-lines__more">
                        {secondary.map(filter => <FilterLine key={`${filter.kind}:${filter.key}`} filter={filter} state={state} signedIn={signedIn} />)}
                    </div>}
                </>
            )}
            {onClear && <button type="button" className="gk-world-lines__clear" onClick={onClear}>{t('Clear filters')}</button>}
        </div>
    );
}
