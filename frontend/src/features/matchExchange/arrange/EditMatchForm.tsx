import './arrange.css';
import { useRef, useState, type FormEvent } from 'react';
import { Button, Field } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { changeImpactFrom, hasBlockingAttention, type ChangeImpact, type Match } from '../api';
import { refereeState } from '../detail/matchState';
import { MatchChangeImpact } from '../MatchChangeImpact';
import { updateListing } from './api';
import { buildTerms, draftFromMatch, localStamp, placeGround, playedAge, problemsWith, whatHappens, type Draft, type Problems } from './matchPlan';
import { useArrangeData } from './useArrangeData';
import { SquadField } from './SquadField';
import { KickoffField } from './KickoffField';
import { GroundField } from './GroundField';
import { MoreDetails, RefereeField } from './DetailFields';
import { MatchPreview } from './MatchPreview';

/** The match's referee as things stand, in the preview's words. */
const refereeWords = (m: Match) => {
    const state = refereeState(m).label;
    return state === 'Not needed' ? 'No referee' : state === 'Arranged outside GrassKickZ' ? 'Referee arranged' : `Referee ${state.toLowerCase()}`;
};
const FIELD_TARGETS: [keyof Problems, string][] = [['date', '#arrange-date'], ['time', '#arrange-time'], ['length', '#arrange-minutes'], ['ground', 'input[name="arrange-ground"]:checked'], ['timezone', '#arrange-timezone']];

/**
 * Revises a published match with the same fields used to create it. A change that affects an agreed
 * opponent, referee or ground is previewed first; it is applied only with the returned confirmation.
 */
export function EditMatchForm({ match, onClose, onSaved }: { match: Match; onClose: () => void; onSaved: () => void }) {
    const form = useRef<HTMLFormElement>(null);
    const [now] = useState(() => new Date());
    const [draft, setDraft] = useState<Draft>(() => draftFromMatch(match));
    const patch = (value: Partial<Draft>) => setDraft(old => ({ ...old, ...value }));
    const data = useArrangeData({ opponent: draft.opponent, squadId: match.squad_id, targetSquadId: draft.targetSquadId });
    const [checked, setChecked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [review, setReview] = useState<{ signature: string; impact: ChangeImpact }>();
    const sending = useRef(false);

    // The match's ground shown as ours or theirs when it is one, never changing who hosts or the city it was stored with.
    const effective: Draft = { ...draft, ground: placeGround(draft.ground, data.ours.data ?? [], data.theirs.data ?? [], draft.hosting) };
    const squad = data.ourSquad ?? data.squads.data?.find(s => s.id === match.squad_id) ?? null;
    const ageGroup = playedAge(draft, squad);
    const terms = squad ? buildTerms(effective, squad, 'edit', match.revision) : null;
    const signature = JSON.stringify({ ...terms, requestId: undefined });
    // A review belongs to exactly these terms: any edit afterwards needs a fresh review.
    const impact = review?.signature === signature ? review.impact : undefined;
    const confirmable = Boolean(impact && impact.revision === match.revision && impact.confirmationRequired && !hasBlockingAttention(impact));
    const problems = problemsWith(effective, 'edit', now);
    const shown = checked ? problems : {};

    async function submit(event: FormEvent) {
        event.preventDefault();
        setChecked(true);
        const first = FIELD_TARGETS.find(([key]) => problems[key]);
        if (first) { form.current?.querySelector<HTMLElement>(first[1])?.focus(); return; }
        if (sending.current || !terms) return;
        sending.current = true; setBusy(true); setError('');
        try {
            await updateListing(match.event_id, terms, confirmable ? impact?.confirmationToken : undefined);
            onSaved();
        } catch (cause) {
            const next = changeImpactFrom(cause);
            if (next) setReview({ signature, impact: next });
            else setError(extractApiErrorMessage(cause, 'The changes could not be saved. Your edits are kept; try again.'));
        } finally { sending.current = false; setBusy(false); }
    }

    return (
        <form ref={form} className="gk-arrange" data-place="page" onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
            <MatchPreview mode="edit" draft={effective} squad={squad} ageGroup={ageGroup} targetSquadName={match.opponent_squad_name}
                refereeWords={draft.referee === (match.referee_required ? 'US' : 'NONE') ? refereeWords(match) : undefined} />
            <fieldset className="gk-arrange__group" disabled={busy}>
                <legend className="gk-visually-hidden">Teams</legend>
                <Field label="Opponent" htmlFor="arrange-opponent-fixed" hint={match.opponent_name ? 'Agreed. To change opponent, use “Find another opponent” on the match page.' : match.requested_club_id ? 'Invitation sent; waiting for their answer.' : 'Squads propose to play on the match page.'}>
                    <input id="arrange-opponent-fixed" className="gk-input" readOnly value={match.opponent_name ? `${match.opponent_name}${match.opponent_squad_name ? ` · ${match.opponent_squad_name}` : ''}` : 'Not agreed yet'} />
                </Field>
                <SquadField squads={data.squads.data ?? []} coached={data.coached} value={match.squad_id} onChange={() => undefined} locked />
            </fieldset>
            <fieldset className="gk-arrange__group" disabled={busy}>
                <legend className="gk-visually-hidden">When</legend>
                <KickoffField date={draft.date} time={draft.time} minutes={draft.minutes} format={draft.format} ageGroup={ageGroup} squadAge={data.ageGroup} known
                    today={localStamp(now, draft.timezone).slice(0, 10)} onChange={patch} errors={{ date: shown.date, time: shown.time, length: shown.length }} />
            </fieldset>
            <fieldset className="gk-arrange__group" disabled={busy}>
                <legend className="gk-visually-hidden">Where</legend>
                <GroundField mode="edit" value={effective.ground} hosting={draft.hosting} onChange={ground => patch({ ground })} onHosting={hosting => patch({ hosting })} ours={data.ours} theirs={draft.opponent ? data.theirs : null}
                    opponentName={draft.opponent?.name} defaultCity={match.city} error={shown.ground} />
            </fieldset>
            <fieldset className="gk-arrange__group" disabled={busy}>
                <legend className="gk-visually-hidden">Referee and notes</legend>
                <RefereeField mode="edit" draft={draft} squadId={match.squad_id} onChange={patch} />
                <Field label="Match notes" htmlFor="arrange-note" hint="Visible to both teams. Changing them may ask the opponent to agree again.">
                    <textarea id="arrange-note" className="gk-input" maxLength={2000} rows={3} value={draft.note} onChange={event => patch({ note: event.target.value })} />
                </Field>
                <MoreDetails draft={draft} automaticTitle={match.title} onChange={patch} timezoneError={shown.timezone} hideKind />
            </fieldset>
            <footer className="gk-arrange__foot">
                {impact && <MatchChangeImpact impact={impact} />}
                {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
                <p className="gk-arrange__next">{whatHappens('edit', effective, match.opponent_squad_name)}</p>
                <div className="gk-arrange__actions">
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Keep the current details</Button>
                    <Button variant="primary" type="submit" disabled={busy} className="gk-arrange__send">
                        {busy ? 'Saving…' : confirmable ? 'Confirm changes and notify participants' : 'Review and save changes'}
                    </Button>
                </div>
            </footer>
        </form>
    );
}
