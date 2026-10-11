import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, LocateFixed, SlidersHorizontal, X } from 'lucide-react';
import { Chip, Field } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldData } from '../useWorldData';
import type { ChoiceFilter, DirectoryQuery, FilterDef, NearbyFilter, ScopeFilter } from './types';
import type { DirectoryState } from './useDirectoryState';
import { LookPicker } from './pickers';
import './filters.css';

/** What a filter control needs: the current values and how to change them. The World map shares these controls. */
export interface FilterControls {
    query: DirectoryQuery;
    setValues: (key: string, values: string[]) => void;
    toggleValue: (key: string, value: string, multi: boolean) => void;
}

const offered = (filter: ChoiceFilter, signedIn: boolean) => filter.options.filter(option => signedIn || !option.signedIn);

export function ChoiceChips({ filter, state, signedIn }: { filter: ChoiceFilter; state: FilterControls; signedIn: boolean }) {
    const t = useWorldCopy();
    const values = state.query.values[filter.key] ?? [];
    return (
        <div className="gk-chips" role="group" aria-label={t(filter.label)}>
            {!filter.multi && !filter.fallback && <Chip pressed={values.length === 0} onClick={() => state.setValues(filter.key, [])}>{t(filter.allLabel ?? 'All')}</Chip>}
            {offered(filter, signedIn).map(option => (
                <Chip key={option.value} pressed={values.includes(option.value)} onClick={() => filter.multi || !filter.fallback ? state.toggleValue(filter.key, option.value, Boolean(filter.multi)) : state.setValues(filter.key, [option.value])}>
                    {t(option.label)}
                </Chip>
            ))}
        </div>
    );
}

/** A text filter commits on blur or Enter, so typing never reloads results per keystroke. */
function TextField({ filter, value, onCommit }: { filter: FilterDef & { placeholder?: string; inputMode?: 'numeric' | 'text' }; value: string; onCommit: (value: string) => void }) {
    const t = useWorldCopy();
    const id = useId();
    const [draft, setDraft] = useState(value);
    return (
        <Field label={t(filter.label)} htmlFor={id}>
            <input id={id} className="gk-input" value={draft} maxLength={100} placeholder={filter.placeholder && t(filter.placeholder)} inputMode={filter.inputMode}
                onChange={event => setDraft(event.target.value)}
                onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
                onKeyDown={event => { if (event.key === 'Enter') onCommit(draft.trim()); }} />
        </Field>
    );
}

/** One filter as a form control: multi-choice chips, a select, a checkbox, a date or a text field. */
export function FilterField({ filter, state, signedIn }: { filter: FilterDef; state: FilterControls; signedIn: boolean }) {
    const t = useWorldCopy();
    const id = useId();
    const value = state.query.values[filter.key]?.[0] ?? '';
    if (filter.kind === 'choice' && filter.multi) return <div className="gk-field"><span className="gk-field__label">{t(filter.label)}</span><ChoiceChips filter={filter} state={state} signedIn={signedIn} /></div>;
    if (filter.kind === 'choice') return (
        <Field label={t(filter.label)} htmlFor={id}>
            <select id={id} className="gk-input" value={value} onChange={event => state.setValues(filter.key, [event.target.value])}>
                {!filter.fallback && <option value="">{t(filter.allLabel ?? 'Any')}</option>}
                {offered(filter, signedIn).map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </select>
        </Field>
    );
    if (filter.kind === 'toggle') return (
        <label className="gk-world-check">
            <input type="checkbox" checked={value === 'true'} onChange={event => state.setValues(filter.key, event.target.checked ? ['true'] : [])} />
            {t(filter.label)}
        </label>
    );
    if (filter.kind === 'date') return (
        <Field label={t(filter.label)} htmlFor={id}>
            <input id={id} type="date" className="gk-input" value={value} min={filter.min?.()} onChange={event => state.setValues(filter.key, event.target.value ? [event.target.value] : [])} />
        </Field>
    );
    return <TextField key={value} filter={filter} value={value} onCommit={next => state.setValues(filter.key, next ? [next] : [])} />;
}

/** A scope from a link, named after what it is (the club, the competition) once that is known. */
function ScopeChip({ filter, value, onRemove }: { filter: ScopeFilter; value: string; onRemove: () => void }) {
    const t = useWorldCopy();
    const named = useWorldData(filter.name && value ? `scope:${filter.key}:${value}` : null, signal => filter.name!(value, signal).catch(() => null));
    const label = named.data || t(filter.label);
    return (
        <Chip pressed onClick={onRemove} aria-label={t('Remove filter: {name}', { name: label })}>
            {label}<X aria-hidden="true" />
        </Chip>
    );
}

/** "Near me": asks the device for its location only when chosen, then keeps the position in the URL. */
function NearbyChip({ filter, state }: { filter: NearbyFilter; state: FilterControls }) {
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
            <Chip pressed={on} disabled={status === 'locating'} onClick={choose}>
                <LocateFixed aria-hidden="true" />{on ? t('Within {km} km of you', { km: filter.km }) : status === 'locating' ? t('Finding you…') : t(filter.label)}
            </Chip>
            {status === 'failed' && <span role="status" className="gk-world-filters__note">{t('Your location is not available. Choose a city instead.')}</span>}
        </>
    );
}

/**
 * A pill that opens a small glass panel under it, over the map rather than pushing it down. It closes on Escape
 * (focus returns to the pill), when focus or a click goes elsewhere, and on a choice marked `data-close`.
 */
export function PopoverPill({ label, name, pressed, wide, align, children }: {
    label: ReactNode; /** The pill's name when its text alone does not say which filter it is. */ name?: string; pressed: boolean; wide?: boolean;
    /** 'end': the panel ends at the pill's right edge (as More filters does) without More filters' grid. */ align?: 'end'; children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), pop = useRef<HTMLDivElement>(null);
    const id = useId();
    useEffect(() => {
        if (!open) return;
        const away = (event: PointerEvent) => {
            if (root.current?.contains(event.target as Node)) return;
            // A field being typed in commits on blur, before the panel goes.
            if (root.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
            setOpen(false);
        };
        const row = root.current?.closest('.gk-world-filters');
        const scrolled = () => setOpen(false);
        document.addEventListener('pointerdown', away);
        row?.addEventListener('scroll', scrolled);
        return () => { document.removeEventListener('pointerdown', away); row?.removeEventListener('scroll', scrolled); };
    }, [open]);
    // In the header the row of pills scrolls sideways, so the panel is placed against the header itself: under its
    // pill (More filters ends at its pill's right edge), and always inside the header.
    useLayoutEffect(() => {
        const head = root.current?.closest<HTMLElement>('.gk-world-head'), panel = pop.current, pill = button.current;
        if (!open || !head || !panel || !pill) return;
        const frame = head.getBoundingClientRect(), box = pill.getBoundingClientRect(), width = panel.offsetWidth;
        panel.style.top = `${box.bottom - frame.top + 6}px`;
        // A panel ending at its pill is held by its right edge, so content that arrives later grows it leftwards.
        // When that would cross the header's left edge, it starts at the header instead.
        if ((wide || align === 'end') && box.right - frame.left >= width) { panel.style.left = 'auto'; panel.style.right = `${Math.max(0, frame.right - box.right)}px`; }
        else { panel.style.right = ''; panel.style.left = `${Math.max(0, Math.min(wide || align === 'end' ? box.right - frame.left - width : box.left - frame.left, frame.width - width))}px`; }
    }, [open, wide, align]);
    return (
        <div ref={root} className="gk-world-pill"
            onKeyDown={event => { if (open && event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setOpen(false); button.current?.focus(); } }}
            onBlur={event => { const next = event.relatedTarget as Node | null; if (next && !root.current?.contains(next)) setOpen(false); }}>
            <button ref={button} type="button" className="gk-chip" data-on={pressed || undefined} aria-label={name} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
                {label}<ChevronDown className="gk-world-pill__caret" aria-hidden="true" />
            </button>
            {open && <div ref={pop} id={id} className="gk-world-pill__pop" data-wide={wide || undefined}
                onClick={event => { if ((event.target as HTMLElement).closest('[data-close]')) { setOpen(false); button.current?.focus(); } }}>{children}</div>}
        </div>
    );
}

/** A choice filter as a pill showing its value ("Academies +1", "Upcoming"); its options open under it. */
function ChoicePill({ filter, state, signedIn }: { filter: ChoiceFilter; state: FilterControls; signedIn: boolean }) {
    const t = useWorldCopy();
    const values = state.query.values[filter.key] ?? [];
    const options = offered(filter, signedIn);
    const chosen = options.filter(option => values.includes(option.value));
    const label = !chosen.length ? t(filter.multi ? filter.label : filter.allLabel ?? filter.label)
        : chosen.length === 1 ? t(chosen[0].label) : `${t(chosen[0].label)} +${chosen.length - 1}`;
    // The pill lights only for a choice the person made, not the list's own default.
    const pressed = chosen.length > 0 && !(filter.fallback && values.length === 1 && values[0] === filter.fallback);
    const all = !filter.multi && !filter.fallback ? [{ value: '', label: filter.allLabel ?? 'All' }] : [];
    return (
        <PopoverPill label={label} name={label === t(filter.label) ? undefined : `${t(filter.label)}: ${label}`} pressed={pressed}>
            {filter.look ? <LookPicker filter={filter} options={options} values={values} pick={value => filter.multi ? state.toggleValue(filter.key, value, true) : state.setValues(filter.key, value ? [value] : [])} />
            : <div role="group" aria-label={t(filter.label)} className="gk-world-pill__options">
                {[...all, ...options].map(option => {
                    const on = option.value ? values.includes(option.value) : values.length === 0;
                    return (
                        <button key={option.value || 'all'} type="button" className="gk-world-pill__option" aria-pressed={on} data-close={filter.multi ? undefined : true}
                            onClick={() => filter.multi ? state.toggleValue(filter.key, option.value, true) : state.setValues(filter.key, option.value ? [option.value] : [])}>
                            {t(option.label)}{on && <Check aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>}
        </PopoverPill>
    );
}

/**
 * The filters as one row of pills in the page's header: each primary filter shows its value, the rest open from
 * More filters, scopes from links are removable chips, and Clear empties them all. Nothing here moves the map.
 */
export function DirectoryFilters({ state, signedIn, onClear }: { state: DirectoryState; signedIn: boolean; /** Absent when nothing can be cleared. */ onClear?: () => void }) {
    const t = useWorldCopy();
    const visible = state.source.filters.filter(filter => filter.kind !== 'scope' && (!filter.when || filter.when(state.query)));
    const scopes = state.activeFilters.filter(filter => filter.kind === 'scope');
    const isPrimary = (filter: FilterDef) => filter.kind === 'nearby' || ((filter.kind === 'choice' || filter.kind === 'toggle') && filter.primary);
    const primary = visible.filter(isPrimary), secondary = visible.filter(filter => !isPrimary(filter));
    const secondaryActive = state.activeFilters.filter(filter => secondary.includes(filter)).length;
    if (!visible.length && !scopes.length && !onClear) return null;
    return (
        <div className="gk-world-filters gk-world-head__filters" role="group" aria-label={t('Filters')}>
            {scopes.map(filter => filter.kind === 'scope' && <ScopeChip key={filter.key} filter={filter} value={state.query.values[filter.key]?.[0] ?? ''} onRemove={() => state.setValues(filter.key, [])} />)}
            {primary.map(filter => filter.kind === 'choice'
                ? <ChoicePill key={filter.key} filter={filter} state={state} signedIn={signedIn} />
                : filter.kind === 'nearby' ? <NearbyChip key={filter.key} filter={filter} state={state} />
                    : <Chip key={filter.key} pressed={state.query.values[filter.key]?.[0] === 'true'} onClick={() => state.setValues(filter.key, state.query.values[filter.key]?.[0] === 'true' ? [] : ['true'])}>{t(filter.label)}</Chip>)}
            {secondary.length > 0 && (
                <PopoverPill wide pressed={secondaryActive > 0} label={<><SlidersHorizontal aria-hidden="true" />{t('More filters')}{secondaryActive > 0 && <span className="gk-num"> · {secondaryActive}</span>}</>}>
                    {secondary.map(filter => <FilterField key={`${filter.kind}:${filter.key}`} filter={filter} state={state} signedIn={signedIn} />)}
                </PopoverPill>
            )}
            {onClear && <button type="button" className="gk-world-filters__clear" onClick={onClear}>{t('Clear filters')}</button>}
        </div>
    );
}
