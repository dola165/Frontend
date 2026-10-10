import { useId, useState } from 'react';
import { Button, Chip, Field } from '../../../../design/primitives';
import { FilterField } from '../../directory/DirectoryFilters';
import { RADII, type ExploreQuery, type MapFilterDef } from './exploreQuery';
import type { Applicant } from './useApplicant';
import './explore.css';

const GROUPS: { title: string; keys: string[] }[] = [
    { title: 'Who it’s for', keys: ['age', 'gender', 'level', 'position'] },
    { title: 'When', keys: ['when', 'time', 'matchType'] },
    { title: 'Clubs', keys: ['joinPolicy', 'category', 'accepting', 'waitlist', 'verified', 'feeMin', 'feeMax', 'feeCurrency', 'feePeriod'] },
];

function WhereField({ query, hasOrigin, onLocate }: { query: ExploreQuery; hasOrigin: boolean; onLocate: () => void }) {
    const regionId = useId(), radiusId = useId();
    const [region, setRegion] = useState(query.coverage.kind === 'region' ? query.coverage.name : '');
    const kind = query.coverage.kind;
    return (
        <div className="gk-field">
            <span className="gk-field__label">Where</span>
            <div className="gk-chips" role="group" aria-label="Where to search">
                <Chip pressed={kind === 'area'} onClick={() => kind !== 'area' && query.setRegion('')}>This map area</Chip>
                <Chip pressed={kind === 'radius'} onClick={() => { if (!hasOrigin) onLocate(); query.setRadius(query.coverage.kind === 'radius' ? query.coverage.km : 10); }}>Near me</Chip>
                <Chip pressed={kind === 'region'} onClick={() => document.getElementById(regionId)?.focus()}>A city or country</Chip>
            </div>
            {kind === 'radius' && (
                <label className="gk-map-filters__inline" htmlFor={radiusId}>
                    <span>Within</span>
                    <select id={radiusId} className="gk-input" value={query.coverage.km} onChange={event => query.setRadius(Number(event.target.value))}>
                        {RADII.map(km => <option key={km} value={km}>{km} km</option>)}
                    </select>
                    {!hasOrigin && <span className="gk-faint">of your location once it is shared</span>}
                </label>
            )}
            <form className="gk-map-filters__inline" onSubmit={event => { event.preventDefault(); query.setRegion(region); }}>
                <input id={regionId} className="gk-input" value={region} maxLength={100} placeholder="City or country, for example Kutaisi" aria-label="Search a city or country" onChange={event => setRegion(event.target.value)} />
                <Button type="submit" size="sm" disabled={!region.trim()}>Search there</Button>
            </form>
        </div>
    );
}

/** A parent or player picks who the club search is for; groups then fit their age. */
function PlayerField({ applicant }: { applicant: Applicant }) {
    const id = useId();
    if (!applicant.participants.length) return null;
    return (
        <Field label="Find a group for" htmlFor={id} hint="Clubs and groups that fit this player’s age and team. Who you pick stays private.">
            <select id={id} className="gk-input" value={applicant.player?.id ?? ''} onChange={event => applicant.select(applicant.participants.find(item => item.id === Number(event.target.value))?.id)}>
                <option value="">Anyone</option>
                {applicant.participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
        </Field>
    );
}

/** Every filter for the layers on the map, grouped. Changes apply straight away. */
export function FiltersPanel({ query, signedIn, applicant, hasOrigin, onLocate, onDone }: {
    query: ExploreQuery; signedIn: boolean; applicant: Applicant; hasOrigin: boolean; onLocate: () => void; onDone: () => void;
}) {
    const shown = (keys: string[]) => keys.map(key => query.visibleFilters.find(filter => filter.key === key)).filter((filter): filter is MapFilterDef => Boolean(filter));
    return (
        <div className="gk-map-filters">
            <div className="gk-map-filters__head">
                <h2 className="gk-panel__title">Filters</h2>
                <div className="gk-row">
                    {(query.activeFilters.length > 0 || query.q) && <Button size="sm" variant="ghost" onClick={query.clearFilters}>Clear all</Button>}
                    <Button size="sm" onClick={onDone}>Show results</Button>
                </div>
            </div>
            <WhereField query={query} hasOrigin={hasOrigin} onLocate={onLocate} />
            {query.layers.includes('clubs') && <PlayerField applicant={applicant} />}
            {GROUPS.map(group => {
                const filters = shown(group.keys);
                if (!filters.length) return null;
                return (
                    <fieldset key={group.title} className="gk-map-filters__group">
                        <legend>{group.title}</legend>
                        {filters.map(filter => <FilterField key={filter.key} filter={filter} state={query.controls} signedIn={signedIn} />)}
                    </fieldset>
                );
            })}
        </div>
    );
}
