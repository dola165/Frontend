import { useState } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { Button, Field } from '../../../../design/primitives';
import { Segmented } from '../../../../design/Tabs';
import { MediaImage } from '../../../../components/ui/MediaImage';
import { apiClient } from '../../../../api/axiosConfig';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { resolveMediaUrl } from '../../../../utils/resolveMediaUrl';
import type { Tiebreak } from '../../../competitions/api';
import { entryPolicyOf, takenAsTheyCome, usualRuleset, usualSeasonPolicy, type RegistrationPolicy } from '../../../tournaments/create/drawDraft';
import type { TournamentVisibility } from '../../../tournaments/domain';
import { useWorldCopy } from '../../copy';
import type { useDrawRoom } from './useDrawRoom';

type Room = ReturnType<typeof useDrawRoom>;
const TIEBREAKS: Record<Tiebreak, string> = { POINTS: 'Points', GOAL_DIFFERENCE: 'Goal difference', GOALS_FOR: 'Goals scored', WINS: 'Wins', BUCHHOLZ: 'Opponents’ points', SEED: 'Seeding' };

/** Entries: when they open and close, how they are taken, the fee and the prizes. */
export function EntriesQuestion({ room }: { room: Room }) {
    const t = useWorldCopy();
    const { draft, update, updateRules } = room;
    // Entries come in at once only where the backend takes them so (squads or players, open to all); elsewhere the
    // organiser approves each, and the room does not promise otherwise.
    const asTheyCome = takenAsTheyCome(draft);
    const policies: { id: RegistrationPolicy; label: string }[] = [{ id: 'APPROVAL_ONLY', label: t('I approve each') }, ...(asTheyCome ? [{ id: 'OPEN' as const, label: t('In as they come') }] : []), { id: 'INVITE_ONLY', label: t('By invitation only') }];
    return <>
        <div className="gk-draw__grid">
            <Field label={t('Entries open')} htmlFor="draw-opens" hint={draft.opensAt ? undefined : t('Open now')}><input id="draw-opens" data-field="opensAt" type="datetime-local" className="gk-input" value={draft.opensAt} onChange={event => update({ opensAt: event.target.value })} /></Field>
            <Field label={t('Entries close')} htmlFor="draw-closes" hint={draft.closesAt ? undefined : t('Until it starts')}><input id="draw-closes" data-field="closesAt" type="datetime-local" className="gk-input" max={draft.startDate} value={draft.closesAt} onChange={event => update({ closesAt: event.target.value })} /></Field>
        </div>
        <div>
            <Segmented label={t('How entries are taken')} value={entryPolicyOf(draft)} onChange={registrationPolicy => update({ registrationPolicy })} items={policies} />
            {!asTheyCome && draft.scope !== 'CLUB' && <p className="gk-field__hint">{t('Only an Open tournament takes entries as they come.')}</p>}
        </div>
        <div className="gk-draw__grid">
            <Field label={t('Entry fee')} htmlFor="draw-fee"><input id="draw-fee" type="number" min={0} max={1000000} className="gk-input" value={draft.rules.entryFee} onChange={event => updateRules({ entryFee: Math.max(0, Number(event.target.value)) })} /></Field>
            <Field label={t('Currency')} htmlFor="draw-currency"><select id="draw-currency" className="gk-input" value={draft.rules.currency} onChange={event => updateRules({ currency: event.target.value })}>{['GEL', 'EUR', 'USD', 'GBP'].map(code => <option key={code} value={code}>{code}</option>)}</select></Field>
            <Field label={t('Fee basis')} htmlFor="draw-basis"><select id="draw-basis" className="gk-input" value={draft.rules.feeBasis} onChange={event => updateRules({ feeBasis: event.target.value as 'TEAM' | 'PLAYER' | 'EVENT' })}>
                <option value="TEAM">{t('Per team')}</option><option value="PLAYER">{t('Per player')}</option><option value="EVENT">{t('Per event')}</option>
            </select></Field>
        </div>
        <Field label={t('Prizes')} htmlFor="draw-prizes"><input id="draw-prizes" className="gk-input" maxLength={5000} placeholder={t('Medals for every player')} value={draft.incentives} onChange={event => update({ incentives: event.target.value })} /></Field>
    </>;
}

/** The rules in detail, folded: the usual wording is already there, so most organisers never open it. */
export function RulesDetail({ room }: { room: Room }) {
    const t = useWorldCopy();
    const { draft, updateRules, updatePolicy, update } = room;
    const { rules, policy } = draft;
    const number = (label: string, value: number, min: number, max: number, set: (value: number) => void, field?: string) =>
        <Field label={t(label)} htmlFor={`draw-${label}`}><input id={`draw-${label}`} data-field={field} type="number" className="gk-input" min={min} max={max} value={value} onChange={event => set(Number(event.target.value))} /></Field>;
    const usual = (current: string, wording: string, set: (value: string) => void) => current !== wording && <button type="button" className="gk-chip" onClick={() => set(wording)}>{t('Use the usual wording')}</button>;
    return (
        <details className="gk-draw__more">
            <summary><span className="gk-field__label">{t('Rules in detail')}</span><span className="gk-field__hint">{t('{minutes} minutes, {rest} minutes between', { minutes: rules.matchMinutes, rest: rules.restMinutes })} · {rules.pitches === 1 ? t('one pitch') : t('{count} pitches', { count: rules.pitches })}</span></summary>
            <div className="gk-draw__more-body">
                <Field label={t('Rules')} htmlFor="draw-ruleset"><textarea id="draw-ruleset" data-field="ruleset" className="gk-input" rows={2} maxLength={2000} value={rules.ruleset} onChange={event => updateRules({ ruleset: event.target.value })} /></Field>
                {usual(rules.ruleset, usualRuleset, ruleset => updateRules({ ruleset }))}
                <Field label={t('How results stand')} htmlFor="draw-season"><textarea id="draw-season" data-field="seasonPolicy" className="gk-input" rows={2} maxLength={1000} value={rules.seasonPolicy} onChange={event => updateRules({ seasonPolicy: event.target.value })} /></Field>
                {usual(rules.seasonPolicy, usualSeasonPolicy(rules.family), seasonPolicy => updateRules({ seasonPolicy }))}
                <div className="gk-draw__grid">
                    {number('Match length, minutes', rules.matchMinutes, 1, 120, matchMinutes => updateRules({ matchMinutes }), 'matchMinutes')}
                    {number('Rest between matches, minutes', rules.restMinutes, 0, 240, restMinutes => updateRules({ restMinutes }))}
                    {number('Pitches', rules.pitches, 1, 20, pitches => updateRules({ pitches }))}
                    {['SWISS', 'ROTATION', 'KING_OF_PITCH'].includes(rules.structure) && number('Rounds', rules.rounds, 1, 30, rounds => updateRules({ rounds }))}
                    {rules.family === 'LADDER' && <>{number('Challenge up to places above', rules.challengeRange, 1, 20, challengeRange => updateRules({ challengeRange }))}{number('A challenge lapses after, days', rules.challengeExpiryDays, 1, 30, challengeExpiryDays => updateRules({ challengeExpiryDays }))}</>}
                    {rules.structure === 'KING_OF_PITCH' && number('Most games in a row on the pitch', rules.maxConsecutiveStays, 1, 10, maxConsecutiveStays => updateRules({ maxConsecutiveStays }))}
                    <Field label={t('Who it is for')} htmlFor="draw-category" hint={t('As written, for example Girls or Open.')}><input id="draw-category" className="gk-input" maxLength={100} value={rules.eligibilityCategory} onChange={event => updateRules({ eligibilityCategory: event.target.value })} /></Field>
                    {/^U\d+$/.test(rules.ageGroup) && <Field label={t('Ages counted on')} htmlFor="draw-cutoff"><input id="draw-cutoff" data-field="ageCutoff" type="date" className="gk-input" value={rules.ageCutoff ?? ''} onChange={event => updateRules({ ageCutoff: event.target.value || null })} /></Field>}
                </div>
                {rules.family === 'FESTIVAL' && <label className="gk-draw__check"><input type="checkbox" checked={rules.standings} onChange={event => updateRules({ standings: event.target.checked })} />{t('Keep a table and name a winner')}</label>}
                <div className="gk-field">
                    <span className="gk-field__label">{t('Level on points')}</span>
                    <ol className="gk-draw__order">{rules.tiebreaks.map((key, index) => <li key={key}>
                        <span>{t(TIEBREAKS[key])}</span>
                        <Button size="sm" variant="ghost" disabled={index === 0} aria-label={t('Move {item} up', { item: t(TIEBREAKS[key]) })} onClick={() => { const next = [...rules.tiebreaks]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateRules({ tiebreaks: next }); }}><ArrowUp aria-hidden="true" /></Button>
                        <Button size="sm" variant="ghost" disabled={rules.tiebreaks.length === 1} aria-label={t('Remove {item}', { item: t(TIEBREAKS[key]) })} onClick={() => updateRules({ tiebreaks: rules.tiebreaks.filter(item => item !== key) })}><X aria-hidden="true" /></Button>
                    </li>)}</ol>
                    {rules.tiebreaks.length < 6 && <select className="gk-input gk-draw__half" aria-label={t('Add a way to separate teams')} value="" onChange={event => event.target.value && updateRules({ tiebreaks: [...rules.tiebreaks, event.target.value as Tiebreak] })}>
                        <option value="">{t('Add a way to separate teams')}</option>
                        {(Object.keys(TIEBREAKS) as Tiebreak[]).filter(key => !rules.tiebreaks.includes(key)).map(key => <option key={key} value={key}>{t(TIEBREAKS[key])}</option>)}
                    </select>}
                </div>
                <div className="gk-draw__grid">
                    {number('Fewest players in a squad', policy.minimumRoster, 1, 100, minimumRoster => updatePolicy({ minimumRoster }))}
                    {number('Longest match this age allows, minutes', policy.maximumMatchMinutes, 1, 120, maximumMatchMinutes => updatePolicy({ maximumMatchMinutes }))}
                    {number('Youngest player, years', policy.minimumAge, 0, 90, minimumAge => updatePolicy({ minimumAge }))}
                    {rules.family === 'LADDER' && number('Inactive after, days (0: never)', policy.inactivityDays, 0, 365, inactivityDays => updatePolicy({ inactivityDays }))}
                </div>
                <Field label={t('Whose rules, and which version')} htmlFor="draw-authority"><input id="draw-authority" className="gk-input" maxLength={500} value={policy.ruleAuthority} onChange={event => updatePolicy({ ruleAuthority: event.target.value })} /></Field>
                <Field label={t('Governing body, if any')} htmlFor="draw-jurisdiction" hint={t('As the organiser states it; nothing here is checked or endorsed.')}><input id="draw-jurisdiction" className="gk-input" maxLength={300} value={rules.jurisdiction} onChange={event => updateRules({ jurisdiction: event.target.value })} /></Field>
                <Field label={t('Where its sanction is published, if any')} htmlFor="draw-sanction"><textarea id="draw-sanction" className="gk-input" rows={2} maxLength={1000} value={policy.sanctioningEvidence} onChange={event => updatePolicy({ sanctioningEvidence: event.target.value })} /></Field>
                <label className="gk-draw__check"><input type="checkbox" checked={policy.allowParticipantOfficials ?? false} onChange={event => updatePolicy({ allowParticipantOfficials: event.target.checked })} />{t('A team’s own player or official may referee its match')}</label>
                <Field label={t('Anything else teams should know')} htmlFor="draw-written"><textarea id="draw-written" className="gk-input" rows={3} maxLength={10000} value={draft.writtenRules} onChange={event => update({ writtenRules: event.target.value })} /></Field>
            </div>
        </details>
    );
}

/** Publishing: the name, a few words about it, who sees it (private until published) and its picture. */
export function PublishQuestion({ room }: { room: Room }) {
    const t = useWorldCopy();
    const { draft, update } = room;
    const [upload, setUpload] = useState({ busy: false, error: '' });
    const send = async (file: File) => {
        setUpload({ busy: true, error: '' });
        const body = new FormData();
        body.append('file', file);
        try { update({ bannerImageUrl: (await apiClient.post<{ url: string }>('/media/upload', body)).data.url }); setUpload({ busy: false, error: '' }); }
        catch (cause) { setUpload({ busy: false, error: extractApiErrorMessage(cause, t('The picture could not be uploaded.')) }); }
    };
    const visibility: { id: TournamentVisibility; label: string }[] = [{ id: 'PRIVATE', label: t('Private') }, { id: 'UNLISTED', label: t('With the link') }, { id: 'PUBLIC', label: t('Public') }];
    return <>
        <Field label={t('Name')} htmlFor="draw-name"><input id="draw-name" data-field="name" className="gk-input" maxLength={255} placeholder={t('Autumn Cup U12')} value={draft.name} onChange={event => update({ name: event.target.value })} /></Field>
        <Field label={t('About it')} htmlFor="draw-about"><textarea id="draw-about" className="gk-input" rows={2} maxLength={4000} value={draft.description} onChange={event => update({ description: event.target.value })} /></Field>
        <div className="gk-field">
            <Segmented label={t('Who sees it')} value={draft.visibility} onChange={value => update({ visibility: value })} items={visibility} />
            <span className="gk-field__hint">{draft.visibility === 'PRIVATE' ? t('Only your organisation’s staff, until you publish it.') : draft.visibility === 'UNLISTED' ? t('Anyone with its link; it is not listed in World.') : t('Everyone, in World and on its page.')}</span>
        </div>
        <div className="gk-field">
            <span className="gk-field__label">{t('Picture')}</span>
            {draft.bannerImageUrl && <MediaImage className="gk-draw__banner" src={resolveMediaUrl(draft.bannerImageUrl) ?? draft.bannerImageUrl} alt="" />}
            <div className="gk-step__row">
                <label className="gk-btn gk-btn--sm gk-draw__file">{upload.busy ? t('Uploading…') : draft.bannerImageUrl ? t('Change the picture') : t('Add a picture')}
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.busy} onChange={event => { const file = event.target.files?.[0]; if (file) void send(file); }} /></label>
                {draft.bannerImageUrl && <Button size="sm" variant="ghost" onClick={() => update({ bannerImageUrl: '' })}>{t('Remove')}</Button>}
            </div>
            {upload.error ? <span className="gk-field__error" role="alert">{upload.error}</span> : <span className="gk-field__hint">{t('One you have the right to use.')}</span>}
        </div>
    </>;
}
