import { Check } from 'lucide-react';
import { useWorldCopy } from '../copy';
import type { ChoiceFilter, FilterOption } from './types';
import './pickers.css';

interface PickerProps { filter: ChoiceFilter; options: FilterOption[]; values: string[]; pick: (value: string) => void }

/** Positions picked on a small pitch: forwards at the top, the goalkeeper at the bottom; pick one band or several. */
function PitchPicker({ filter, options, values, pick }: PickerProps) {
    const t = useWorldCopy();
    const bands = [...options].reverse();
    return (
        <div className="gk-pick-pitch" role="group" aria-label={t(filter.label)}>
            <span className="gk-pick-pitch__lines" aria-hidden="true" />
            {bands.map(option => (
                <button key={option.value} type="button" className="gk-pick-pitch__band" data-band={option.value} aria-pressed={values.includes(option.value)} onClick={() => pick(option.value)}>
                    {t(option.label)}{values.includes(option.value) && <Check aria-hidden="true" />}
                </button>
            ))}
        </div>
    );
}

/**
 * Levels as a ladder, highest first: choosing a rung means "this or higher", so the rungs above it light too. Rungs
 * outside the ladder (a goalkeeper licence) sit apart below it.
 */
function LadderPicker({ filter, options, values, pick }: PickerProps) {
    const t = useWorldCopy();
    const ladder = options.filter(option => !option.apart), apart = options.filter(option => option.apart);
    const chosen = ladder.findIndex(option => values.includes(option.value));
    const rung = (option: FilterOption, lit: boolean) => (
        <button key={option.value} type="button" className="gk-pick-ladder__rung" data-lit={lit || undefined} aria-pressed={values.includes(option.value)} data-close onClick={() => pick(option.value)}>
            <span className="gk-pick-ladder__step" aria-hidden="true" />{t(option.label)}{values.includes(option.value) && <Check aria-hidden="true" />}
        </button>
    );
    return (
        <div className="gk-pick-ladder" role="group" aria-label={t(filter.label)}>
            <button type="button" className="gk-pick-ladder__rung" aria-pressed={values.length === 0} data-close onClick={() => pick('')}>{t(filter.allLabel ?? 'Any')}</button>
            {ladder.map((option, index) => rung(option, chosen >= 0 && index <= chosen))}
            {apart.length > 0 && <span className="gk-pick-ladder__apart">{apart.map(option => rung(option, false))}</span>}
        </div>
    );
}

/** Choices as tiles with their symbols (services): pick one or several. */
function TilePicker({ filter, options, values, pick }: PickerProps) {
    const t = useWorldCopy();
    return (
        <div className="gk-pick-tiles" role="group" aria-label={t(filter.label)}>
            {options.map(option => {
                const Icon = option.icon;
                return (
                    <button key={option.value} type="button" className="gk-pick-tiles__tile" aria-pressed={values.includes(option.value)} onClick={() => pick(option.value)}>
                        {Icon && <Icon aria-hidden="true" />}<span>{t(option.label)}</span>
                    </button>
                );
            })}
        </div>
    );
}

/** A choice filter drawn as what it chooses: a pitch, a ladder or tiles (`ChoiceFilter.look`). */
export function LookPicker(props: PickerProps) {
    if (props.filter.look === 'pitch') return <PitchPicker {...props} />;
    if (props.filter.look === 'ladder') return <LadderPicker {...props} />;
    return <TilePicker {...props} />;
}
