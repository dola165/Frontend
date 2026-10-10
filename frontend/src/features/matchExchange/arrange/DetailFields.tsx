import { Field } from '../../../design/primitives';
import { label, levels } from '../api';
import { ChoiceChips } from '../../../design/ChoiceChips';
import type { Draft, Mode, RefereeChoice } from './matchPlan';

/** The referee is optional now: arrange later, leave it to them, record one already arranged, or play without. */
export function RefereeField({ mode, value, name, onChange, error, opponentName }: {
    mode: Mode; value: RefereeChoice; name: string; onChange: (value: { referee?: RefereeChoice; refereeName?: string }) => void; error?: string; opponentName?: string;
}) {
    const options: { value: RefereeChoice; label: string }[] = mode === 'edit'
        ? [{ value: 'US', label: 'A referee is needed' }, { value: 'NONE', label: 'No referee needed' }]
        : [
            { value: 'US', label: 'We’ll arrange one' },
            ...(mode === 'direct' ? [{ value: 'THEM' as const, label: `${opponentName ?? 'They'} arrange${opponentName ? 's' : ''} it` }] : []),
            { value: 'EXTERNAL', label: 'Already arranged' },
            { value: 'NONE', label: 'No referee needed' },
        ];
    return (
        <div className="gk-field">
            <label className="gk-field__label" htmlFor="arrange-referee">Referee</label>
            <select id="arrange-referee" className="gk-input" value={value} onChange={event => onChange({ referee: event.target.value as RefereeChoice })}>
                {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {value === 'EXTERNAL' && <>
                <label className="gk-visually-hidden" htmlFor="arrange-referee-name">Referee’s name</label>
                <input id="arrange-referee-name" className="gk-input" maxLength={160} value={name} placeholder="Referee’s name" aria-invalid={Boolean(error) || undefined}
                    onChange={event => onChange({ refereeName: event.target.value })} />
            </>}
            {error ? <span className="gk-field__error" role="alert">{error}</span>
                : <span className="gk-field__hint">{value === 'EXTERNAL' ? 'Recorded as your arrangement; it isn’t a GrassKickZ appointment.'
                    : mode === 'edit' ? 'Invite or replace officials from the match page.'
                        : 'Optional. Once the match exists you can invite a referee or publish a request from its page.'}</span>}
        </div>
    );
}

/** Name, kind of match, level and time zone: sensible defaults, shown in one line until opened. */
export function MoreDetails({ draft, automaticTitle, onChange, timezoneError, open, hideKind }: {
    draft: Draft; automaticTitle: string; onChange: (value: Partial<Draft>) => void; timezoneError?: string; open?: boolean; hideKind?: boolean;
}) {
    return (
        <details className="gk-arrange__more" open={open || Boolean(timezoneError) || undefined}>
            <summary><span className="gk-field__label">More details</span>
                <span className="gk-field__hint">{[hideKind ? draft.title : draft.matchType === 'COMPETITIVE' ? 'Competitive' : 'Friendly', `${label(draft.level)} level`, draft.timezone].join(' · ')}</span></summary>
            <div className="gk-arrange__more-body">
                <Field label="Match name" htmlFor="arrange-title" hint={draft.title.trim() ? undefined : 'Leave empty to use the name shown.'}>
                    <input id="arrange-title" className="gk-input" maxLength={140} value={draft.title} placeholder={automaticTitle || 'Match name'} onChange={event => onChange({ title: event.target.value })} />
                </Field>
                {!hideKind && <div className="gk-field">
                    <span className="gk-field__label" id="arrange-type-label">Kind of match</span>
                    <ChoiceChips labelledBy="arrange-type-label" value={draft.matchType} onChange={matchType => onChange({ matchType })}
                        choices={[{ value: 'FRIENDLY', label: 'Friendly' }, { value: 'COMPETITIVE', label: 'Competitive' }]} />
                </div>}
                <div className="gk-arrange__kickoff">
                    <Field label="Playing level" htmlFor="arrange-level">
                        <select id="arrange-level" className="gk-input" value={draft.level} onChange={event => onChange({ level: event.target.value })}>
                            {levels.map(level => <option key={level} value={level}>{label(level)}</option>)}
                        </select>
                    </Field>
                    <Field label="Time zone" htmlFor="arrange-timezone" error={timezoneError}>
                        <input id="arrange-timezone" className="gk-input" list="arrange-timezones" value={draft.timezone} onChange={event => onChange({ timezone: event.target.value })} />
                        <datalist id="arrange-timezones"><option>Asia/Tbilisi</option><option>Europe/Istanbul</option><option>Europe/London</option></datalist>
                    </Field>
                </div>
            </div>
        </details>
    );
}
