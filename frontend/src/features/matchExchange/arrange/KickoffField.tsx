import { useState } from 'react';
import { Button } from '../../../design/primitives';
import { formats } from '../api';
import { ChoiceChips } from './ChoiceChips';
import { LENGTHS, addMinutes, dayLabel, defaultFormat, defaultMinutes, formatLabel, halvesLabel, weekendDays } from './matchPlan';

/** Match day and kick-off. The end follows from the age group's usual length, which can be changed. */
export function KickoffField({ date, time, minutes, format, ageGroup, known, today, onChange, errors }: {
    date: string; time: string; minutes: number | null; format: string | null; ageGroup: string; known: boolean; today: string;
    onChange: (value: { date?: string; time?: string; minutes?: number | null; format?: string | null }) => void; errors: { date?: string; time?: string };
}) {
    const [adjusting, setAdjusting] = useState(minutes !== null || format !== null);
    const length = minutes ?? defaultMinutes(ageGroup);
    const playing = format ?? defaultFormat(ageGroup);
    const quick = weekendDays(today);
    const custom = minutes !== null || format !== null;
    return (
        <fieldset className="gk-arrange__fieldset">
            <legend className="gk-field__label">Kick-off</legend>
            <div className="gk-arrange__kickoff">
                <div className="gk-field">
                    <label className="gk-visually-hidden" htmlFor="arrange-date">Match day</label>
                    <input id="arrange-date" className="gk-input" type="date" min={today} value={date} aria-invalid={Boolean(errors.date) || undefined}
                        aria-describedby={errors.date ? 'arrange-date-error' : undefined} onChange={event => onChange({ date: event.target.value })} />
                </div>
                <div className="gk-field">
                    <label className="gk-visually-hidden" htmlFor="arrange-time">Kick-off time</label>
                    <input id="arrange-time" className="gk-input" type="time" step={300} value={time} aria-invalid={Boolean(errors.time) || undefined}
                        aria-describedby={errors.time ? 'arrange-time-error' : undefined} onChange={event => onChange({ time: event.target.value })} />
                </div>
            </div>
            <ChoiceChips label="Upcoming weekend days" value={quick.includes(date) ? date : null} onChange={value => onChange({ date: value })}
                choices={quick.map(day => ({ value: day, label: dayLabel(day) }))} />
            {errors.date && <span id="arrange-date-error" className="gk-field__error" role="alert">{errors.date}</span>}
            {errors.time && <span id="arrange-time-error" className="gk-field__error" role="alert">{errors.time}</span>}
            {!known && !custom ? <p className="gk-arrange__length">Choose your squad and the usual format and length for its age group fill in.</p> : <p className="gk-arrange__length">
                <span>
                    {date && time ? <>Ends <strong className="gk-num">{addMinutes(`${date}T${time}`, length).slice(11)}</strong> · </> : null}
                    {formatLabel(playing)}, {length} minutes{custom ? '' : ` (${halvesLabel(ageGroup)}, usual for ${ageGroup === 'SENIOR' ? 'senior football' : ageGroup})`}
                </span>
                {!adjusting && <Button size="sm" variant="ghost" onClick={() => setAdjusting(true)}>Change</Button>}
            </p>}
            {adjusting && (
                <div className="gk-arrange__adjust">
                    <div className="gk-field">
                        <label className="gk-field__label" htmlFor="arrange-format">Format</label>
                        <select id="arrange-format" className="gk-input" value={playing} onChange={event => onChange({ format: event.target.value })}>
                            {Object.entries(formats).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                        </select>
                    </div>
                    <div className="gk-field">
                        <label className="gk-field__label" htmlFor="arrange-length">Length, including breaks</label>
                        <select id="arrange-length" className="gk-input" value={length} onChange={event => onChange({ minutes: Number(event.target.value) })}>
                            {[...new Set([...LENGTHS, length])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} minutes</option>)}
                        </select>
                    </div>
                    {custom && <Button size="sm" variant="ghost" onClick={() => onChange({ minutes: null, format: null })}>Use the {ageGroup === 'SENIOR' ? 'senior' : ageGroup} default</Button>}
                </div>
            )}
        </fieldset>
    );
}
