import { useMatchCopy } from '../copy';
import { useState } from 'react';
import { Button } from '../../../design/primitives';
import { ages, formats, label } from '../api';
import { ChoiceChips } from '../../../design/ChoiceChips';
import { appLanguage } from '../../../utils/formatting';
import { LENGTHS, MAX_LENGTH, MIN_LENGTH, addMinutes, dayLabel, defaultFormat, defaultMinutes, formatLabel, halvesLabel, weekendDays } from './matchPlan';

const OTHER = 'other';

/**
 * Match day and kick-off. The age group, format and length follow our squad's age group; "Change" plays at another age
 * (a squad playing up), another format, or any length from 20 minutes to 12 hours (a festival day).
 */
export function KickoffField({ date, time, minutes, format, ageGroup, squadAge, known, today, onChange, errors }: {
    date: string; time: string; minutes: number | null; format: string | null; /** The age group played. */ ageGroup: string; /** Our squad's own. */ squadAge: string;
    known: boolean; today: string;
    onChange: (value: { date?: string; time?: string; minutes?: number | null; format?: string | null; ageGroup?: string | null }) => void; errors: { date?: string; time?: string; length?: string };
}) {
    const t = useMatchCopy();
    const custom = minutes !== null || format !== null || ageGroup !== squadAge;
    const [adjusting, setAdjusting] = useState(custom);
    const length = minutes ?? defaultMinutes(ageGroup);
    const [typing, setTyping] = useState(!LENGTHS.includes(length));
    const playing = format ?? defaultFormat(ageGroup);
    const quick = weekendDays(today);
    const ageName = (age: string) => age === 'SENIOR' ? t("senior football") : label(age);
    return (
        <fieldset className="gk-arrange__fieldset">
            <legend className="gk-field__label">{t("Kick-off")}</legend>
            <div className="gk-arrange__kickoff">
                <div className="gk-field">
                    <label className="gk-visually-hidden" htmlFor="arrange-date">{t("Match day")}</label>
                    <input id="arrange-date" className="gk-input" type="date" lang={appLanguage()} min={today} value={date} aria-invalid={Boolean(errors.date) || undefined}
                        aria-describedby={errors.date ? 'arrange-date-error' : undefined} onChange={event => onChange({ date: event.target.value })} />
                </div>
                <div className="gk-field">
                    <label className="gk-visually-hidden" htmlFor="arrange-time">{t("Kick-off time")}</label>
                    <input id="arrange-time" className="gk-input" type="time" lang={appLanguage()} step={300} value={time} aria-invalid={Boolean(errors.time) || undefined}
                        aria-describedby={errors.time ? 'arrange-time-error' : undefined} onChange={event => onChange({ time: event.target.value })} />
                </div>
            </div>
            <ChoiceChips label={t("Upcoming weekend days")} value={quick.includes(date) ? date : null} onChange={value => onChange({ date: value })}
                choices={quick.map(day => ({ value: day, label: dayLabel(day) }))} />
            {errors.date && <span id="arrange-date-error" className="gk-field__error" role="alert">{t(errors.date)}</span>}
            {errors.time && <span id="arrange-time-error" className="gk-field__error" role="alert">{t(errors.time)}</span>}
            {!known && !custom ? <p className="gk-arrange__length">{t("Choose your squad and the usual format and length for its age group fill in.")}</p> : <p className="gk-arrange__length">
                <span>
                    {date && time ? <>{t("Ends")}{' '}<strong className="gk-num">{addMinutes(`${date}T${time}`, length).slice(11)}</strong> · </> : null}
                    {t('{age} · {format}, {minutes} minutes', { age: t(label(ageGroup)), format: formatLabel(playing), minutes: length })}{custom ? '' : t(' ({halves}, usual for {age})', { halves: halvesLabel(ageGroup), age: ageName(ageGroup) })}
                </span>
                {!adjusting && <Button size="sm" variant="ghost" onClick={() => setAdjusting(true)}>{t('Change')}</Button>}
            </p>}
            {adjusting && (
                <div className="gk-arrange__adjust">
                    <div className="gk-field">
                        <label className="gk-field__label" htmlFor="arrange-age">{t("Age group")}</label>
                        <select id="arrange-age" className="gk-input" value={ageGroup} onChange={event => onChange({ ageGroup: event.target.value === squadAge ? null : event.target.value, minutes: null, format: null })}>
                            {ages.map(age => <option key={age} value={age}>{age === squadAge ? t('{age} (your squad)', { age: t(label(age)) }) : t(label(age))}</option>)}
                        </select>
                    </div>
                    <div className="gk-field">
                        <label className="gk-field__label" htmlFor="arrange-format">{t("Format")}</label>
                        <select id="arrange-format" className="gk-input" value={playing} onChange={event => onChange({ format: event.target.value })}>
                            {Object.entries(formats).map(([value, name]) => <option key={value} value={value}>{t(name)}</option>)}
                        </select>
                    </div>
                    <div className="gk-field">
                        <label className="gk-field__label" htmlFor="arrange-length">{t("Length, including breaks")}</label>
                        <select id="arrange-length" className="gk-input" value={typing ? OTHER : length} onChange={event => {
                            if (event.target.value === OTHER) { setTyping(true); return; }
                            setTyping(false); onChange({ minutes: Number(event.target.value) });
                        }}>
                            {[...new Set([...LENGTHS, ...(typing ? [] : [length])])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{t('{minutes} minutes', { minutes: value })}</option>)}
                            <option value={OTHER}>{t("Other length…")}</option>
                        </select>
                    </div>
                    {typing && <div className="gk-field">
                        <label className="gk-field__label" htmlFor="arrange-minutes">{t("Minutes")}</label>
                        <input id="arrange-minutes" className="gk-input" type="number" inputMode="numeric" min={MIN_LENGTH} max={MAX_LENGTH} step={5} value={minutes ?? ''}
                            aria-invalid={Boolean(errors.length) || undefined} aria-describedby={errors.length ? 'arrange-minutes-hint arrange-length-error' : 'arrange-minutes-hint'}
                            onChange={event => onChange({ minutes: event.target.value === '' ? null : Number(event.target.value) })} />
                        <span id="arrange-minutes-hint" className="gk-field__hint">{t("20 minutes to 12 hours")}</span>
                    </div>}
                    {custom && <Button size="sm" variant="ghost" onClick={() => { setTyping(false); onChange({ minutes: null, format: null, ageGroup: null }); }}>{t('Use the {age} default', { age: ageName(squadAge) })}</Button>}
                </div>
            )}
            {errors.length && <span id="arrange-length-error" className="gk-field__error" role="alert">{t(errors.length)}</span>}
        </fieldset>
    );
}
