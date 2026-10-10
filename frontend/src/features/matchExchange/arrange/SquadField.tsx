import { Field } from '../../../design/primitives';
import type { Squad } from '../api';
import { ChoiceChips } from '../../../design/ChoiceChips';

/** Our squad: the squads I coach as quick choices, every other club squad in a list. */
export function SquadField({ squads, coached, value, onChange, error, locked }: {
    squads: Squad[]; coached: number[]; value: number; onChange: (id: number) => void; error?: string; locked?: boolean;
}) {
    const chosen = squads.find(squad => squad.id === value);
    if (locked) return (
        <Field label="Your squad" htmlFor="arrange-squad" hint="The squad cannot change once a match is published.">
            <input id="arrange-squad" className="gk-input" value={chosen ? `${chosen.name} · ${chosen.club_name}` : 'Your squad'} readOnly />
        </Field>
    );
    const quick = squads.filter(squad => coached.includes(squad.id));
    const others = squads.filter(squad => !quick.includes(squad));
    return (
        <div className="gk-field">
            <span className="gk-field__label" id="arrange-squad-label">Your squad</span>
            {quick.length > 0 && <ChoiceChips labelledBy="arrange-squad-label" invalid={Boolean(error)} value={value || null} onChange={onChange}
                choices={quick.map(squad => ({ value: squad.id, label: squad.name }))} />}
            {others.length > 0 && (
                <select aria-label={quick.length ? 'Another squad' : 'Your squad'} aria-invalid={Boolean(error) || undefined} className="gk-input gk-arrange__other-squad"
                    value={others.some(squad => squad.id === value) ? value : ''} onChange={event => onChange(Number(event.target.value))}>
                    <option value="">{quick.length ? 'Another club squad…' : 'Choose your squad'}</option>
                    {others.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
                </select>
            )}
            {error ? <span className="gk-field__error" role="alert">{error}</span>
                : chosen && <span className="gk-field__hint">{chosen.club_name}</span>}
        </div>
    );
}
