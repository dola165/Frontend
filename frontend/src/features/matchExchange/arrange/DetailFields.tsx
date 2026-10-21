import { useMatchCopy } from '../copy';
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
function Terms({ draft, onChange, error }: { draft: Draft; onChange: (value: Partial<Draft>) => void; /** A fee problem, said under the field. */ error?: string }) {
    const t = useMatchCopy();
    const paid = draft.volunteer === false;
    return <>
        <ChoiceChips label={t("Terms")} value={paid ? 'PAID' : 'VOLUNTEER'} onChange={value => onChange({ volunteer: value === 'VOLUNTEER', fee: draft.fee ?? String(draft.invited?.fee ?? 0), currency: draft.currency ?? draft.invited?.currency ?? 'GEL' })}
            choices={[{ value: 'VOLUNTEER', label: t("Volunteer") }, { value: 'PAID', label: t("Paid") }]} />
        {paid && <div className="gk-arrange__kickoff">
            <Field label={t("Fee offered")} htmlFor="arrange-referee-fee">
                <input id="arrange-referee-fee" className="gk-input" type="number" inputMode="decimal" min={0} max={1_000_000} step="0.01" value={draft.fee ?? ''}
                    aria-invalid={Boolean(error) || undefined} aria-describedby={error ? 'arrange-referee-error' : undefined} onChange={event => onChange({ fee: event.target.value })} />
            </Field>
            <Field label={t("Currency")} htmlFor="arrange-referee-currency">
                <select id="arrange-referee-currency" className="gk-input" value={draft.currency ?? 'GEL'} onChange={event => onChange({ currency: event.target.value })}>{['GEL', 'EUR', 'GBP', 'USD'].map(code => <option key={code}>{code}</option>)}</select>
            </Field>
        </div>}
    </>;
}

/** The referee to invite now: one of the club's own referees, or anyone in the directory found by name or area. */
function InviteReferee({ draft, squadId, onChange }: { draft: Draft; squadId: number; onChange: (value: Partial<Draft>) => void }) {
    const t = useMatchCopy();
    // The search is what an "invite a referee" problem points at (it carries the field's own label).
    const [query, setQuery] = useState('');
    const results = useSearch(query, searchReferees);
    const choose = (referee: Referee) => onChange({ invited: invitedFrom(referee), fee: String(referee.fee), currency: referee.currency, volunteer: draft.volunteer ?? !referee.accepts_paid });
    if (draft.invited) return (
        <div className="gk-arrange__picked">
            <Avatar name={draft.invited.name} size={32} />
            <span className="gk-arrange__option-text"><strong>{draft.invited.name}</strong>
                <span>{[draft.invited.acceptsVolunteer && t("Volunteer matches"), draft.invited.acceptsPaid && t('{fee} {currency} listed fee', { fee: draft.invited.fee, currency: draft.invited.currency })].filter(Boolean).join(' · ')}</span></span>
            <Button size="sm" variant="ghost" onClick={() => onChange({ invited: null })} aria-label={t('Choose a different referee instead of {name}', { name: draft.invited.name })}>{t('Change')}</Button>
        </div>
    );
    return <>
        <ClubRefereeChoices squadId={squadId || null} volunteer={draft.volunteer !== false} selectedId={0} onSelect={choose} />
        <Combobox id="arrange-referee-search" label={t("Referees")} query={query} onQuery={setQuery} items={results.items} itemKey={referee => referee.user_id} status={results.status}
            loadingText={t('Searching…')} placeholder={t("Search referees by name or area")} emptyText={t("No referee matches that search.")} errorText={t("Referee search is unavailable. Ask referees nearby instead.")}
            renderItem={referee => <span className="gk-arrange__option-text"><strong>{referee.full_name}</strong><span>{[referee.service_area, referee.accepts_paid ? `${referee.fee} ${referee.currency}` : t("Volunteer")].filter(Boolean).join(' · ')}</span></span>}
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
    const t = useMatchCopy();
    const value = draft.referee;
    const options: { value: RefereeChoice; label: string }[] = mode === 'edit'
        ? [{ value: 'US', label: t("A referee is needed") }, { value: 'NONE', label: t("No referee needed") }]
        : [
            { value: 'US', label: t("We’ll arrange one later") },
            ...(mode === 'direct' ? [{ value: 'THEM' as const, label: opponentName ? t('{club} arranges it', { club: opponentName }) : t('They arrange it') }] : []),
            { value: 'INVITE', label: t("Invite a referee now") },
            { value: 'OPEN', label: t("Ask referees nearby") },
            { value: 'EXTERNAL', label: t("Already arranged") },
            { value: 'NONE', label: t("No referee needed") },
        ];
    const hint = value === 'EXTERNAL' ? t("Recorded as your arrangement; it isn’t a GrassKickZ appointment.")
        : value === 'INVITE' ? t('{name} accepts or declines after checking their availability. Fees are agreed directly.', { name: draft.invited?.name ?? t("The referee") })
            : value === 'OPEN' ? t("Referees nearby see the match and apply; you choose one. Fees are agreed directly.")
                : mode === 'edit' ? t("Invite or replace officials from the match page.")
                    : t("Optional. Once the match exists you can invite a referee or ask referees nearby from it.");
    return (
        <div className="gk-field gk-arrange__referee">
            <label className="gk-field__label" htmlFor="arrange-referee">{t("Referee")}</label>
            <select id="arrange-referee" className="gk-input" value={value} aria-invalid={Boolean(error) || undefined} aria-describedby={error ? 'arrange-referee-error' : 'arrange-referee-hint'}
                onChange={event => onChange({ referee: event.target.value as RefereeChoice })}>
                {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {value === 'EXTERNAL' && <>
                <label className="gk-visually-hidden" htmlFor="arrange-referee-name">{t("Referee’s name")}</label>
                <input id="arrange-referee-name" className="gk-input" maxLength={160} value={draft.refereeName} placeholder={t("Referee’s name")} aria-invalid={Boolean(error) || undefined}
                    aria-describedby={error ? 'arrange-referee-error' : undefined}
                    onChange={event => onChange({ refereeName: event.target.value })} />
            </>}
            {value === 'INVITE' && <InviteReferee draft={draft} squadId={squadId} onChange={onChange} />}
            {(value === 'INVITE' || value === 'OPEN') && <Terms draft={draft} onChange={onChange} error={error && /fee|currency/i.test(error) ? error : undefined} />}
            {error ? <span id="arrange-referee-error" className="gk-field__error" role="alert">{t(error)}</span> : <span id="arrange-referee-hint" className="gk-field__hint">{hint}</span>}
        </div>
    );
}

/** Name, kind of match, level and time zone: sensible defaults, shown in one line until opened. */
export function MoreDetails({ draft, automaticTitle, onChange, timezoneError, open, hideKind }: {
    draft: Draft; automaticTitle: string; onChange: (value: Partial<Draft>) => void; timezoneError?: string; open?: boolean; hideKind?: boolean;
}) {
    const t = useMatchCopy();
    return (
        <details className="gk-arrange__more" open={open || Boolean(timezoneError) || undefined}>
            <summary><span className="gk-field__label">{t("More details")}</span>
                <span className="gk-field__hint">{[hideKind ? draft.title : draft.matchType === 'COMPETITIVE' ? t("Competitive") : t("Friendly"), t('{level} level', { level: t(label(draft.level)) }), draft.timezone].join(' · ')}</span></summary>
            <div className="gk-arrange__more-body">
                <Field label={t("Match name")} htmlFor="arrange-title" hint={draft.title.trim() ? undefined : t("Leave empty to use the name shown.")}>
                    <input id="arrange-title" className="gk-input" maxLength={140} value={draft.title} placeholder={automaticTitle || t("Match name")} onChange={event => onChange({ title: event.target.value })} />
                </Field>
                {!hideKind && <div className="gk-field">
                    <span className="gk-field__label" id="arrange-type-label">{t("Kind of match")}</span>
                    <ChoiceChips labelledBy="arrange-type-label" value={draft.matchType} onChange={matchType => onChange({ matchType })}
                        choices={[{ value: 'FRIENDLY', label: t("Friendly") }, { value: 'COMPETITIVE', label: t("Competitive") }]} />
                </div>}
                <div className="gk-arrange__kickoff">
                    <Field label={t("Playing level")} htmlFor="arrange-level">
                        <select id="arrange-level" className="gk-input" value={draft.level} onChange={event => onChange({ level: event.target.value })}>
                            {levels.map(level => <option key={level} value={level}>{t(label(level))}</option>)}
                        </select>
                    </Field>
                    <Field label={t("Time zone")} htmlFor="arrange-timezone" error={timezoneError && t(timezoneError)}>
                        <input id="arrange-timezone" className="gk-input" list="arrange-timezones" value={draft.timezone} onChange={event => onChange({ timezone: event.target.value })} />
                        <datalist id="arrange-timezones"><option>Asia/Tbilisi</option><option>Europe/Istanbul</option><option>Europe/London</option></datalist>
                    </Field>
                </div>
            </div>
        </details>
    );
}
