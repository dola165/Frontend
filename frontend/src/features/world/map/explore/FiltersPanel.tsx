import { useId, useState } from 'react';
import { Button, Chip, Field } from '../../../../design/primitives';
import { FilterField } from '../../directory/DirectoryFilters';
import { RADII, type ExploreQuery, type MapFilterDef } from './exploreQuery';
import type { Applicant } from './useApplicant';
import { useWorldCopy } from '../../copy';
import './explore.css';

const GROUPS: { title: string; keys: string[] }[] = [
    { title: 'Who it’s for', keys: ['age', 'gender', 'level', 'position'] },
    { title: 'When', keys: ['when', 'time', 'matchType'] },
    { title: 'Clubs', keys: ['joinPolicy', 'category', 'accepting', 'waitlist', 'verified', 'feeMin', 'feeMax', 'feeCurrency', 'feePeriod'] },
];

function WhereField({ query, hasOrigin, onLocate }: { query: ExploreQuery; hasOrigin: boolean; onLocate: () => void }) {
    const t = useWorldCopy();
    const regionId = useId(), radiusId = useId();
    const [region, setRegion] = useState(query.coverage.kind === 'region' ? query.coverage.name : '');
    const kind = query.coverage.kind;
    return (
        <div className="gk-field">
            <span className="gk-field__label">{t('Where')}</span>
            <div className="gk-chips" role="group" aria-label={t('Where to search')}>
                <Chip pressed={kind === 'area'} onClick={() => kind !== 'area' && query.setRegion('')}>{t('This map area')}</Chip>
                <Chip pressed={kind === 'radius'} onClick={() => { if (!hasOrigin) onLocate(); query.setRadius(query.coverage.kind === 'radius' ? query.coverage.km : 10); }}>{t('Near me')}</Chip>
                <Chip pressed={kind === 'region'} onClick={() => document.getElementById(regionId)?.focus()}>{t('A city or country')}</Chip>
            </div>
            {kind === 'radius' && (
                <label className="gk-map-filters__inline" htmlFor={radiusId}>
                    <span>{t('Within')}</span>
                    <select id={radiusId} className="gk-input" value={query.coverage.km} onChange={event => query.setRadius(Number(event.target.value))}>
                        {RADII.map(km => <option key={km} value={km}>{km} km</option>)}
                    </select>
                    {!hasOrigin && <span className="gk-faint">{t('of your location once it is shared')}</span>}
                </label>
            )}
            <form className="gk-map-filters__inline" onSubmit={event => { event.preventDefault(); query.setRegion(region); }}>
                <input id={regionId} className="gk-input" value={region} maxLength={100} placeholder={t('City or country, for example Kutaisi')} aria-label={t('Search a city or country')} onChange={event => setRegion(event.target.value)} />
                <Button type="submit" size="sm" disabled={!region.trim()}>{t('Search there')}</Button>
            </form>
        </div>
    );
}

/** A parent or player picks who the club search is for; groups then fit their age. */
function PlayerField({ applicant }: { applicant: Applicant }) {
    const t = useWorldCopy();
    const id = useId();
    if (!applicant.participants.length) return null;
    return (
        <Field label={t('Find a group for')} htmlFor={id} hint={t('Clubs and groups that fit this player’s age and team. Who you pick stays private.')}>
            <select id={id} className="gk-input" value={applicant.player?.id ?? ''} onChange={event => applicant.select(applicant.participants.find(item => item.id === Number(event.target.value))?.id)}>
                <option value="">{t('Anyone')}</option>
                {applicant.participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
        </Field>
    );
}

/** Every filter for the layers on the map, grouped. Changes apply straight away. */
export function FiltersPanel({ query, signedIn, applicant, hasOrigin, onLocate, onDone }: {
    query: ExploreQuery; signedIn: boolean; applicant: Applicant; hasOrigin: boolean; onLocate: () => void; onDone: () => void;
}) {
    const t = useWorldCopy();
    const shown = (keys: string[]) => keys.map(key => query.visibleFilters.find(filter => filter.key === key)).filter((filter): filter is MapFilterDef => Boolean(filter));
    return (
        <div className="gk-map-filters">
            <div className="gk-map-filters__head">
                <h2 className="gk-panel__title">{t('Filters')}</h2>
                <div className="gk-row">
                    {(query.activeFilters.length > 0 || query.q) && <Button size="sm" variant="ghost" onClick={query.clearFilters}>{t('Clear all')}</Button>}
                    <Button size="sm" onClick={onDone}>{t('Show results')}</Button>
                </div>
            </div>
            <WhereField query={query} hasOrigin={hasOrigin} onLocate={onLocate} />
            {query.layers.includes('clubs') && <PlayerField applicant={applicant} />}
            {GROUPS.map(group => {
                const filters = shown(group.keys);
                if (!filters.length) return null;
                return (
                    <fieldset key={group.title} className="gk-map-filters__group">
                        <legend>{t(group.title)}</legend>
                        {filters.map(filter => <FilterField key={filter.key} filter={filter} state={query.controls} signedIn={signedIn} />)}
                    </fieldset>
                );
            })}
        </div>
    );
}
