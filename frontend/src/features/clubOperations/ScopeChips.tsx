import { Chip } from '../../design/primitives';
import type { Choice } from './api';
import type { StaffScopeSelection } from './StaffScopePicker';

/** Where a responsibility applies: the whole club, or chosen squads. Labelled for screen readers as one group. */
export function ScopeChips({ squads, value, onChange, disabled = false, legend = 'Where it applies' }: {
    squads: Choice[]; value: StaffScopeSelection; onChange: (value: StaffScopeSelection) => void; disabled?: boolean; legend?: string;
}) {
    const toggle = (id: number) => onChange({ clubWide: false, squadIds: value.squadIds.includes(id) ? value.squadIds.filter(s => s !== id) : [...value.squadIds, id] });
    return <fieldset className="cw-scope" disabled={disabled}>
        <legend className="gk-field__label">{legend}</legend>
        <div className="gk-chips" role="group" aria-label={legend}>
            <Chip pressed={value.clubWide} onClick={() => onChange({ clubWide: !value.clubWide, squadIds: [] })}>Whole club</Chip>
            {squads.map(squad => <Chip key={squad.id} pressed={!value.clubWide && value.squadIds.includes(squad.id)} onClick={() => toggle(squad.id)}>{squad.name}</Chip>)}
        </div>
        <p className="gk-field__hint" aria-live="polite">{value.clubWide ? 'Applies to club-wide records and every current and future squad.' : value.squadIds.length ? `${value.squadIds.length} ${value.squadIds.length === 1 ? 'squad' : 'squads'} selected` : 'Choose the whole club or at least one squad.'}</p>
    </fieldset>;
}
