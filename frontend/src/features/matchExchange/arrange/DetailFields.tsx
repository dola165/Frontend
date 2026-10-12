import { useState } from 'react';
import { Avatar, Button, Field } from '../../../design/primitives';
import { label, levels, type Referee } from '../api';
import { ChoiceChips } from '../../../design/ChoiceChips';
import { Combobox } from '../../../design/Combobox';
import { useSearch } from '../../../design/useSearch';
import { ClubRefereeChoices } from '../ClubRefereeChoices';
import { searchReferees } from './api';
import type { Draft, InvitedReferee, Mode, RefereeChoice } from './matchPlan';

const invitedFrom = (referee: Referee): InvitedReferee => ({ id: referee.user_id, name: referee.full_name, fee: referee.fee, currency: referee.currency,
    acceptsVolunteer: referee.accepts_volunteer, acceptsPaid: referee.accepts_paid });

/** Volunteer, or a fee in a currency: what a referee invited now, or referees asked nearby, are offered. */
function Terms({ draft, onChange }: { draft: Draft; onChange: (value: Partial<Draft>) => void }) {
    const paid = draft.volunteer === false;
    return <>
        <ChoiceChips label="Terms" value={paid ? 'PAID' : 'VOLUNTEER'} onChange={value => onChange({ volunteer: value === 'VOLUNTEER', fee: draft.fee ?? String(draft.invited?.fee ?? 0), currency: draft.currency ?? draft.invited?.currency ?? 'GEL' })}
            choices={[{ value: 'VOLUNTEER', label: 'Volunteer' }, { value: 'PAID', label: 'Paid' }]} />
        {paid && <div className="gk-arrange__kickoff">
            <Field label="Fee offered" htmlFor="arrange-referee-fee">
                <input id="arrange-referee-fee" className="gk-input" type="number" inputMode="decimal" min={0} max={1_000_000} step="0.01" value={draft.fee ?? ''} onChange={event => onChange({ fee: event.target.value })} />
            </Field>
            <Field label="Currency" htmlFor="arrange-referee-currency">
                <select id="arrange-referee-currency" className="gk-input" value={draft.currency ?? 'GEL'} onChange={event => onChange({ currency: event.target.value })}>{['GEL', 'EUR', 'GBP', 'USD'].map(code => <option key={code}>{code}</option>)}</select>
            </Field>
        </div>}
    </>;
}

/** The referee to invite now: one of the club's own referees, or anyone in the directory found by name or area. */
function InviteReferee({ draft, squadId, onChange }: { draft: Draft; squadId: number; onChange: (value: Partial<Draft>) => void }) {
    const [query, setQuery] = useState('');
    const results = useSearch(query, searchReferees);
    const choose = (referee: Referee) => onChange({ invited: invitedFrom(referee), fee: String(referee.fee), currency: referee.currency, volunteer: draft.volunteer ?? !referee.accepts_paid });
    if (draft.invited) return (
        <div className="gk-arrange__picked">
            <Avatar name={draft.invited.name} size={32} />
            <span className="gk-arrange__option-text"><strong>{draft.invited.name}</strong>
                <span>{[draft.invited.acceptsVolunteer && 'Volunteer matches', draft.invited.acceptsPaid && `${draft.invited.fee} ${draft.invited.currency} listed fee`].filter(Boolean).join(' · ')}</span></span>
            <Button size="sm" variant="ghost" onClick={() => onChange({ invited: null })} aria-label={`Choose a different referee instead of ${draft.invited.name}`}>Change</Button>
        </div>
    );
    return <>
        <ClubRefereeChoices squadId={squadId || null} volunteer={draft.volunteer !== false} selectedId={0} onSelect={choose} />
        <Combobox label="Referees" query={query} onQuery={setQuery} items={results.items} itemKey={referee => referee.user_id} status={results.status}
            placeholder="Search referees by name or area" emptyText="No referee matches that search." errorText="Referee search is unavailable. Ask referees nearby instead."
            renderItem={referee => <span className="gk-arrange__option-text"><strong>{referee.full_name}</strong><span>{[referee.service_area, referee.accepts_paid ? `${referee.fee} ${referee.currency}` : 'Volunteer'].filter(Boolean).join(' · ')}</span></span>}
            onSelect={referee => { choose(referee); setQuery(''); }} />
    </>;
}

/**
 * The referee, folded to one choice with "later" first: arrange it later, leave it to them, invite one now (a club
 * referee or anyone in the directory), ask referees nearby to apply, record one already arranged, or play without.
 */
export function RefereeField({ mode, draft, squadId, onChange, error, opponentName }: {
    mode: Mode; draft: Draft; squadId: number; onChange: (value: Partial<Draft>) => void; error?: string; opponentName?: string;
}) {
    const value = draft.referee;
    const options: { value: RefereeChoice; label: string }[] = mode === 'edit'
        ? [{ value: 'US', label: 'A referee is needed' }, { value: 'NONE', label: 'No referee needed' }]
        : [
            { value: 'US', label: 'We’ll arrange one later' },
            ...(mode === 'direct' ? [{ value: 'THEM' as const, label: `${opponentName ?? 'They'} arrange${opponentName ? 's' : ''} it` }] : []),
            { value: 'INVITE', label: 'Invite a referee now' },
            { value: 'OPEN', label: 'Ask referees nearby' },
            { value: 'EXTERNAL', label: 'Already arranged' },
            { value: 'NONE', label: 'No referee needed' },
        ];
    const hint = value === 'EXTERNAL' ? 'Recorded as your arrangement; it isn’t a GrassKickZ appointment.'
        : value === 'INVITE' ? `${draft.invited?.name ?? 'The referee'} accepts or declines after checking their availability. Fees are agreed directly.`
            : value === 'OPEN' ? 'Referees nearby see the match and apply; you choose one. Fees are agreed directly.'
                : mode === 'edit' ? 'Invite or replace officials from the match page.'
                    : 'Optional. Once the match exists you can invite a referee or ask referees nearby from it.';
    return (
        <div className="gk-field gk-arrange__referee">
            <label className="gk-field__label" htmlFor="arrange-referee">Referee</label>
            <select id="arrange-referee" className="gk-input" value={value} onChange={event => onChange({ referee: event.target.value as RefereeChoice })}>
                {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {value === 'EXTERNAL' && <>
                <label className="gk-visually-hidden" htmlFor="arrange-referee-name">Referee’s name</label>
                <input id="arrange-referee-name" className="gk-input" maxLength={160} value={draft.refereeName} placeholder="Referee’s name" aria-invalid={Boolean(error) || undefined}
                    onChange={event => onChange({ refereeName: event.target.value })} />
            </>}
            {value === 'INVITE' && <InviteReferee draft={draft} squadId={squadId} onChange={onChange} />}
            {(value === 'INVITE' || value === 'OPEN') && <Terms draft={draft} onChange={onChange} />}
            {error ? <span className="gk-field__error" role="alert">{error}</span> : <span className="gk-field__hint">{hint}</span>}
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
