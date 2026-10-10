import { useId, useState } from 'react';
import { LocateFixed, SlidersHorizontal, X } from 'lucide-react';
import { Chip, Field } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldData } from '../useWorldData';
import type { ChoiceFilter, DirectoryQuery, FilterDef, NearbyFilter, ScopeFilter } from './types';
import type { DirectoryState } from './useDirectoryState';

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
function TextField({ filter, value, onCommit }: { filter: FilterDef & { placeholder?: string }; value: string; onCommit: (value: string) => void }) {
    const t = useWorldCopy();
    const id = useId();
    const [draft, setDraft] = useState(value);
    return (
        <Field label={t(filter.label)} htmlFor={id}>
            <input id={id} className="gk-input" value={draft} maxLength={100} placeholder={filter.placeholder && t(filter.placeholder)}
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

/** Primary filters as chips; everything else behind a More filters disclosure. Scopes from links show as removable chips. */
export function DirectoryFilters({ state, signedIn }: { state: DirectoryState; signedIn: boolean }) {
    const t = useWorldCopy();
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const visible = state.source.filters.filter(filter => filter.kind !== 'scope' && (!filter.when || filter.when(state.query)));
    const scopes = state.activeFilters.filter(filter => filter.kind === 'scope');
    const isPrimary = (filter: FilterDef) => filter.kind === 'nearby' || ((filter.kind === 'choice' || filter.kind === 'toggle') && filter.primary);
    const primary = visible.filter(isPrimary), secondary = visible.filter(filter => !isPrimary(filter));
    const secondaryActive = state.activeFilters.filter(filter => secondary.includes(filter)).length;
    if (!visible.length && !scopes.length) return null;
    return (
        <div className="gk-world-filters">
            <div className="gk-world-filters__row">
                {scopes.length > 0 && (
                    <div className="gk-chips" role="group" aria-label={t('Showing only')}>
                        {scopes.map(filter => filter.kind === 'scope' && <ScopeChip key={filter.key} filter={filter} value={state.query.values[filter.key]?.[0] ?? ''} onRemove={() => state.setValues(filter.key, [])} />)}
                    </div>
                )}
                {primary.map(filter => filter.kind === 'choice'
                    ? <ChoiceChips key={filter.key} filter={filter} state={state} signedIn={signedIn} />
                    : filter.kind === 'nearby' ? <NearbyChip key={filter.key} filter={filter} state={state} />
                        : <Chip key={filter.key} pressed={state.query.values[filter.key]?.[0] === 'true'} onClick={() => state.setValues(filter.key, state.query.values[filter.key]?.[0] === 'true' ? [] : ['true'])}>{t(filter.label)}</Chip>)}
                {secondary.length > 0 && (
                    <Chip pressed={open || secondaryActive > 0} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
                        <SlidersHorizontal aria-hidden="true" />{t('More filters')}{secondaryActive > 0 && <span className="gk-num"> · {secondaryActive}</span>}
                    </Chip>
                )}
            </div>
            {open && secondary.length > 0 && (
                <div id={panelId} className="gk-world-filters__more">
                    {secondary.map(filter => <FilterField key={`${filter.kind}:${filter.key}`} filter={filter} state={state} signedIn={signedIn} />)}
                </div>
            )}
        </div>
    );
}
