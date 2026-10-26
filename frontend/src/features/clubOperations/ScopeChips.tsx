import { Chip } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { Choice } from './api';
import type { StaffScopeSelection } from './StaffScopePicker';
import '../clubWorkspace/club-workspace.css';

/**
 * Where a responsibility applies: the whole club, or chosen squads. Labelled for screen readers as one group.
 * `allowClubWide={false}` offers only squads (a head coach suggesting an assistant for their own squads).
 */
export function ScopeChips({ squads, value, onChange, disabled = false, legend, allowClubWide = true }: {
    squads: Choice[]; value: StaffScopeSelection; onChange: (value: StaffScopeSelection) => void; disabled?: boolean; legend?: string; allowClubWide?: boolean;
}) {
    const copy = useJourneyCopy();
    const title = legend ?? copy('Where it applies', 'სად ვრცელდება');
    const count = value.squadIds.length;
    const toggle = (id: number) => onChange({ clubWide: false, squadIds: value.squadIds.includes(id) ? value.squadIds.filter(s => s !== id) : [...value.squadIds, id] });
    return <fieldset className="cw-scope" disabled={disabled}>
        <legend className="gk-field__label">{title}</legend>
        <div className="gk-chips" role="group" aria-label={title}>
            {allowClubWide && <Chip pressed={value.clubWide} onClick={() => onChange({ clubWide: !value.clubWide, squadIds: [] })}>{copy('Whole club', 'მთელი კლუბი')}</Chip>}
            {squads.map(squad => <Chip key={squad.id} pressed={!value.clubWide && value.squadIds.includes(squad.id)} onClick={() => toggle(squad.id)}>{squad.name}</Chip>)}
        </div>
        <p className="gk-field__hint" aria-live="polite">{value.clubWide ? copy('Applies to club-wide records and every current and future squad.', 'ვრცელდება კლუბის ჩანაწერებზე და ყველა არსებულ თუ მომავალ გუნდზე.')
            : count ? copy(`${count} ${count === 1 ? 'squad' : 'squads'} selected`, `არჩეულია ${count} გუნდი`)
                : allowClubWide ? copy('Choose the whole club or at least one squad.', 'აირჩიეთ მთელი კლუბი ან ერთი გუნდი მაინც.') : copy('Choose at least one squad.', 'აირჩიეთ ერთი გუნდი მაინც.')}</p>
    </fieldset>;
}
