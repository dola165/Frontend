import './arrange.css';
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink, EmptyNote, Field, Panel, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { clubProfile, createArrangement } from './api';
import { automaticTitle, buildArrangement, localStamp, problemsWith, type Draft, type GroundChoice, type Problems } from './matchPlan';
import { useDraft } from './useDraft';
import { useArrangeData } from './useArrangeData';
import { OpponentField } from './OpponentField';
import { SquadField } from './SquadField';
import { KickoffField } from './KickoffField';
import { GroundField } from './GroundField';
import { MoreDetails, RefereeField } from './DetailFields';
import { MatchSummary } from './MatchSummary';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tbilisi';
const blank = (squadId: number): Draft => ({
    opponent: null, targetSquadId: -1, squadId, date: '', time: '', minutes: null, format: null, ground: { kind: 'LATER', city: '' },
    referee: 'US', refereeName: '', note: '', title: '', matchType: 'FRIENDLY', level: 'DEVELOPMENT', timezone: zone(), requestId: crypto.randomUUID(),
});
/** Where focus goes for each problem, in reading order. */
const FIELD_TARGETS: [keyof Problems, string][] = [['opponent', '#arrange-opponent, #arrange-their-squad + [role=radiogroup] [tabindex="0"]'], ['squad', '[aria-labelledby="arrange-squad-label"] [tabindex="0"], .gk-arrange__other-squad'],
    ['date', '#arrange-date'], ['time', '#arrange-time'], ['ground', 'input[name="arrange-ground"]:checked'], ['referee', '#arrange-referee-name'], ['timezone', '#arrange-timezone']];

/**
 * One short form for a new match. `direct` invites a club the coach already knows; `open` posts the
 * date to Match Exchange so other squads can propose. Neither books or rents a pitch.
 */
export function ArrangeMatchForm({ mode, opponentId, squadId = 0 }: { mode: 'direct' | 'open'; opponentId?: number; squadId?: number }) {
    const { user, sessionId } = useAuth();
    const navigate = useNavigate();
    const form = useRef<HTMLFormElement>(null);
    const [now] = useState(() => new Date());
    const { draft, patch, reset, clear } = useDraft(`gk:arrange:${user?.id}:${sessionId}:${mode}:${opponentId ?? 'any'}:${squadId || 'any'}`, () => blank(squadId));
    const data = useArrangeData(draft);
    // Something worth keeping was entered; an opponent filled in from a club's page does not count.
    const started = Boolean((draft.opponent && draft.opponent.id !== opponentId) || draft.date || draft.time || draft.note.trim() || draft.title.trim());
    const [checked, setChecked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirmReset, setConfirmReset] = useState(false);
    const sending = useRef(false);

    // A "Propose a match" link from a club profile names the opponent; fill it in once.
    const applyOpponent = useEffectEvent((club: { id: number; name: string; logoUrl?: string | null; cityName?: string | null }) => {
        if (!draft.opponent && club.id !== data.ownClubId) patch({ opponent: { id: club.id, name: club.name, logoUrl: club.logoUrl, city: club.cityName ?? null }, targetSquadId: -1 });
    });
    useEffect(() => {
        if (mode !== 'direct' || !opponentId) return;
        const controller = new AbortController();
        void clubProfile(opponentId, controller.signal).then(applyOpponent).catch(() => { /* The search box stays available. */ });
        return () => controller.abort();
    }, [mode, opponentId]);

    const withCity = (ground: GroundChoice): GroundChoice => 'city' in ground && !ground.city.trim() ? { ...ground, city: data.ownCity } : ground;
    const effective: Draft = { ...draft, squadId: data.squadId, targetSquadId: data.targetSquadId, ground: withCity(draft.ground) };
    const problems = problemsWith(effective, mode, now);
    if (mode === 'direct' && draft.opponent && data.targetSquadId < 0 && data.theirSquads.data) problems.opponent = 'Choose their squad, or let them choose.';
    const shown = checked ? problems : {};
    const title = automaticTitle(effective, data.ourSquad ?? undefined, mode);
    const targetSquadName = data.theirSquads.data?.find(squad => squad.id === data.targetSquadId)?.name ?? null;

    async function submit(event: FormEvent) {
        event.preventDefault();
        setChecked(true);
        const first = FIELD_TARGETS.find(([key]) => problems[key]);
        if (first) { form.current?.querySelector<HTMLElement>(first[1])?.focus(); return; }
        if (sending.current || !data.ourSquad) return;
        sending.current = true; setBusy(true); setError('');
        try {
            const match = await createArrangement(buildArrangement(effective, data.ourSquad, mode));
            clear();
            navigate(`/match-exchange/${match.event_id}?sent=${mode}`);
        } catch (cause) {
            setError(extractApiErrorMessage(cause, mode === 'direct' ? 'The invitation could not be sent. Your details are kept; try again.' : 'The match could not be posted. Your details are kept; try again.'));
        } finally { sending.current = false; setBusy(false); }
    }

    if (data.squads.loading) return <Panel padded><div className="gk-stack gk-stack--tight" role="status" aria-label="Loading your squads"><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={120} /></div></Panel>;
    if (data.squads.error) return <Panel><EmptyNote title="Your squads could not load" action={<Button onClick={data.squads.retry}>Try again</Button>}>{data.squads.error}</EmptyNote></Panel>;
    if (!data.squads.data?.length) return <Panel><EmptyNote title="No squads you can arrange matches for" action={<ButtonLink to="/world/matches">Back to matches</ButtonLink>}>Club staff with a squad responsibility arrange matches. Ask your club’s leadership if you should have one.</EmptyNote></Panel>;

    const problemCount = Object.keys(shown).length;
    return (
        <form ref={form} className="gk-arrange" onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
            <Panel className="gk-arrange__fields">
                <fieldset className="gk-arrange__group gk-arrange__group--pair" disabled={busy}>
                    <legend className="gk-visually-hidden">Teams</legend>
                    {mode === 'direct' && <OpponentField opponent={draft.opponent} ownClubId={data.ownClubId} squads={data.theirSquads} targetSquadId={data.targetSquadId}
                        suggestedSquadId={data.suggestedTheirs} error={shown.opponent}
                        onOpponent={opponent => patch({ opponent, targetSquadId: -1, ...(draft.ground.kind === 'THEIRS' ? { ground: { kind: 'LATER', city: '' } } : {}) })}
                        onTargetSquad={targetSquadId => patch({ targetSquadId })} />}
                    <SquadField squads={data.squads.data} coached={data.coached} value={data.squadId} onChange={id => patch({ squadId: id, minutes: null, format: null })} error={shown.squad} />
                </fieldset>
                <fieldset className="gk-arrange__group" disabled={busy}>
                    <legend className="gk-visually-hidden">When</legend>
                    <KickoffField date={draft.date} time={draft.time} minutes={draft.minutes} format={draft.format} ageGroup={data.ageGroup} known={Boolean(data.ourSquad)}
                        today={localStamp(now, draft.timezone || zone()).slice(0, 10)} onChange={patch} errors={{ date: shown.date, time: shown.time }} />
                </fieldset>
                <fieldset className="gk-arrange__group" disabled={busy}>
                    <legend className="gk-visually-hidden">Where</legend>
                    <GroundField mode={mode} value={effective.ground} onChange={ground => patch({ ground })} ours={data.ours} theirs={mode === 'direct' && draft.opponent ? data.theirs : null}
                        opponentName={draft.opponent?.name} defaultCity={data.ownCity} error={shown.ground} />
                </fieldset>
                <fieldset className="gk-arrange__group gk-arrange__group--pair" disabled={busy}>
                    <legend className="gk-visually-hidden">Referee and notes</legend>
                    <RefereeField mode={mode} value={draft.referee} name={draft.refereeName} onChange={patch} error={shown.referee} opponentName={draft.opponent?.name} />
                    <Field label={mode === 'direct' ? 'Note for their coach' : 'Details for interested teams'} htmlFor="arrange-note" hint="Optional. Kit colours, arrival time, playing rules.">
                        <textarea id="arrange-note" className="gk-input" maxLength={2000} rows={3} value={draft.note} onChange={event => patch({ note: event.target.value })}
                            placeholder={mode === 'direct' ? 'We would love a game before the league restarts…' : 'Squad of 14, happy to play 3 × 25 minutes…'} />
                    </Field>
                    <MoreDetails draft={draft} automaticTitle={title} onChange={patch} timezoneError={shown.timezone} />
                </fieldset>
            </Panel>
            <Panel as="aside" className="gk-arrange__summary">
                <MatchSummary mode={mode} draft={effective} squad={data.ourSquad} ageGroup={data.ageGroup} targetSquadName={targetSquadName} title={draft.title.trim() || title}>
                    {problemCount > 0 && <p className="gk-notice gk-notice--warning" role="alert">{problemCount === 1 ? 'One detail needs your attention.' : `${problemCount} details need your attention.`} They are marked in the form.</p>}
                    {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
                    <Button variant="primary" type="submit" disabled={busy} className="gk-arrange__send">{busy ? 'Sending…' : mode === 'direct' ? 'Send invitation' : 'Post open match'}</Button>
                    <div className="gk-arrange__secondary">
                        <ButtonLink variant="ghost" size="sm" to="/world/matches?tab=mine">Cancel</ButtonLink>
                        {started && (confirmReset
                            ? <span className="gk-arrange__confirm" role="group" aria-label="Clear this draft?">
                                <Button size="sm" variant="danger" onClick={() => { reset(); setChecked(false); setError(''); setConfirmReset(false); }}>Clear draft</Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Keep it</Button>
                            </span>
                            : <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>Start over</Button>)}
                    </div>
                </MatchSummary>
            </Panel>
        </form>
    );
}
