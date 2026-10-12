import './arrange.css';
import { useEffect, useEffectEvent, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, EmptyNote, Field, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { Match } from '../api';
import { clubProfile, createArrangement } from './api';
import { automaticTitle, buildArrangement, draftStarted, localStamp, playedAge, problemsWith, whatHappens, type Draft, type GroundChoice, type Problems } from './matchPlan';
import { useDraft } from './useDraft';
import { useArrangeData } from './useArrangeData';
import { OpponentField } from './OpponentField';
import { SquadField } from './SquadField';
import { KickoffField } from './KickoffField';
import { GroundField } from './GroundField';
import { MoreDetails, RefereeField } from './DetailFields';
import { MatchPreview } from './MatchPreview';
import { BeforeYouPost } from './BeforeYouPost';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tbilisi';
const blank = (squadId: number): Draft => ({
    opponent: null, targetSquadId: -1, squadId, date: '', time: '', minutes: null, format: null, ground: { kind: 'LATER', city: '' },
    referee: 'US', refereeName: '', note: '', title: '', matchType: 'FRIENDLY', level: 'DEVELOPMENT', timezone: zone(), requestId: crypto.randomUUID(),
});
/** The referee control a referee problem is about: the name, the referee to invite, the fee, else the choice itself. */
const refereeTarget = (draft: Draft, problem: string) => draft.referee === 'EXTERNAL' ? '#arrange-referee-name'
    : draft.referee === 'INVITE' && !draft.invited ? '#arrange-referee-search'
        : /fee|currency/i.test(problem) ? '#arrange-referee-fee' : '#arrange-referee';
/** Where focus goes for each problem, in reading order. */
const FIELD_TARGETS: [keyof Problems, string][] = [['opponent', '#arrange-opponent, #arrange-their-squad + [role=radiogroup] [tabindex="0"]'], ['squad', '[aria-labelledby="arrange-squad-label"] [tabindex="0"], .gk-arrange__other-squad'],
    ['date', '#arrange-date'], ['time', '#arrange-time'], ['length', '#arrange-minutes'], ['ground', 'input[name="arrange-ground"]:checked'], ['referee', '#arrange-referee'], ['timezone', '#arrange-timezone']];

/**
 * One short form for a new match, shown in World's frame. `direct` invites a club the coach already knows; `open` posts
 * the date to Open matches so other squads can propose. Neither books or rents a pitch. The draft is kept in the
 * browser's session under `storageKey`, so closing the frame never loses it; once sent, `onSent` shows the match.
 */
export function ArrangeMatchForm({ mode, opponentId, squadId = 0, storageKey, onSent, head }: {
    mode: 'direct' | 'open'; opponentId?: number; squadId?: number; storageKey: string; onSent: (match: Match) => void; /** Shown above the preview. */ head?: ReactNode;
}) {
    const { user } = useAuth();
    const form = useRef<HTMLFormElement>(null);
    const [now] = useState(() => new Date());
    const { draft, patch, reset, clear } = useDraft(user ? storageKey : null, () => blank(squadId));
    const data = useArrangeData(draft);
    const [checked, setChecked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirmReset, setConfirmReset] = useState(false);
    const sending = useRef(false);
    // Keyboard focus never lands under the match pinned at the top or Send pinned at the bottom: the drawer keeps their
    // heights clear when it scrolls a field into view.
    const ready = Boolean(data.squads.data?.length);
    useEffect(() => {
        const body = form.current?.closest<HTMLElement>('.gk-drawer__body');
        const top = form.current?.querySelector<HTMLElement>('.gk-arrange__preview'), foot = form.current?.querySelector<HTMLElement>('.gk-arrange__foot');
        if (!ready || !body || !top || !foot) return;
        const fit = () => { body.style.scrollPaddingBlock = `${top.offsetHeight + 8}px ${foot.offsetHeight + 8}px`; };
        fit();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
        observer?.observe(top); observer?.observe(foot);
        return () => { observer?.disconnect(); body.style.scrollPaddingBlock = ''; };
    }, [ready]);

    // A "Propose a match" from a club names the opponent; fill it in once.
    const applyOpponent = useEffectEvent((club: { id: number; name: string; logoUrl?: string | null; cityName?: string | null }) => {
        if (!draft.opponent && club.id !== data.ownClubId) patch({ opponent: { id: club.id, name: club.name, logoUrl: club.logoUrl, city: club.cityName ?? null }, targetSquadId: -1 });
    });
    useEffect(() => {
        if (mode !== 'direct' || !opponentId) return;
        const controller = new AbortController();
        void clubProfile(opponentId, controller.signal).then(applyOpponent).catch(() => { /* The search box stays available. */ });
        return () => controller.abort();
    }, [mode, opponentId]);

    // A ground with no city on record takes the city it is in: ours is in our club's city, theirs (and "at their
    // ground" when inviting them) in theirs, anything else in ours.
    const withCity = (ground: GroundChoice): GroundChoice => {
        if ('ground' in ground) return ground.ground && !ground.ground.city?.trim() && !ground.city?.trim()
            ? { ...ground, city: ground.kind === 'OURS' ? data.ownCity : ground.kind === 'THEIRS' ? draft.opponent?.city ?? '' : '' } : ground;
        return ground.city.trim() ? ground : { ...ground, city: (ground.kind === 'TRAVEL' && mode === 'direct' && draft.opponent?.city) || data.ownCity };
    };
    // Clubs almost always host at their own ground, so it is the starting choice until the person picks another.
    const starting = (ground: GroundChoice): GroundChoice => ground.kind === 'LATER' && !draft.groundTouched && data.ours.data?.[0] ? { kind: 'OURS', ground: data.ours.data[0] } : ground;
    const effective: Draft = { ...draft, squadId: data.squadId, targetSquadId: data.targetSquadId, ground: withCity(starting(draft.ground)) };
    const ageGroup = playedAge(draft, data.ourSquad);
    const problems = problemsWith(effective, mode, now);
    if (mode === 'direct' && draft.opponent && data.targetSquadId < 0 && data.theirSquads.data) problems.opponent = 'Choose their squad, or let them choose.';
    const shown = checked ? problems : {};
    const title = automaticTitle(effective, data.ourSquad ?? undefined, mode);
    const targetSquadName = data.theirSquads.data?.find(squad => squad.id === data.targetSquadId)?.name ?? null;

    async function submit(event: FormEvent) {
        event.preventDefault();
        setChecked(true);
        const first = FIELD_TARGETS.find(([key]) => problems[key]);
        if (first) { form.current?.querySelector<HTMLElement>(first[0] === 'referee' ? refereeTarget(effective, problems.referee ?? '') : first[1])?.focus(); return; }
        if (sending.current || !data.ourSquad) return;
        sending.current = true; setBusy(true); setError('');
        try {
            const match = await createArrangement(buildArrangement(effective, data.ourSquad, mode));
            clear();
            onSent(match);
        } catch (cause) {
            setError(extractApiErrorMessage(cause, mode === 'direct' ? 'The invitation could not be sent. Your details are kept; try again.' : 'The match could not be posted. Your details are kept; try again.'));
        } finally { sending.current = false; setBusy(false); }
    }

    if (data.squads.loading) return <div className="gk-stack gk-stack--tight" role="status" aria-label="Loading your squads"><Skeleton height={64} /><Skeleton height={44} /><Skeleton height={120} /></div>;
    if (data.squads.error) return <EmptyNote title="Your squads could not load" action={<Button onClick={data.squads.retry}>Try again</Button>}>{data.squads.error}</EmptyNote>;
    if (!data.squads.data?.length) return <EmptyNote title="No squads you can arrange matches for">Club staff with a squad responsibility arrange matches. Ask your club’s leadership if you should have one.</EmptyNote>;

    const problemCount = Object.keys(shown).length;
    return (
        <form ref={form} className="gk-arrange" onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
            <MatchPreview mode={mode} draft={effective} squad={data.ourSquad} ourLogo={data.ownLogo} ageGroup={ageGroup} targetSquadName={targetSquadName}>{head}</MatchPreview>
            <fieldset className="gk-arrange__group" disabled={busy}>
                <legend className="gk-visually-hidden">Teams</legend>
                {mode === 'direct' && <OpponentField opponent={draft.opponent} ownClubId={data.ownClubId} squads={data.theirSquads} targetSquadId={data.targetSquadId}
                    suggestedSquadId={data.suggestedTheirs} error={shown.opponent}
                    onOpponent={opponent => patch({ opponent, targetSquadId: -1, ...(draft.ground.kind === 'THEIRS' ? { ground: { kind: 'LATER', city: '' }, groundTouched: false }
                        : draft.ground.kind === 'TRAVEL' ? { ground: { kind: 'TRAVEL', city: opponent?.city ?? '' } } : {}) })}
                    onTargetSquad={targetSquadId => patch({ targetSquadId })} />}
                <SquadField squads={data.squads.data} coached={data.coached} value={data.squadId} onChange={id => patch({ squadId: id, minutes: null, format: null, ageGroup: null })} error={shown.squad} />
            </fieldset>
            <fieldset className="gk-arrange__group" disabled={busy}>
                <legend className="gk-visually-hidden">When</legend>
                <KickoffField date={draft.date} time={draft.time} minutes={draft.minutes} format={draft.format} ageGroup={ageGroup} squadAge={data.ageGroup} known={Boolean(data.ourSquad)}
                    today={localStamp(now, draft.timezone || zone()).slice(0, 10)} onChange={patch} errors={{ date: shown.date, time: shown.time, length: shown.length }} />
                {mode === 'open' && data.ourSquad && draft.date && !data.ours.loading && <BeforeYouPost ageGroup={ageGroup} date={draft.date} ownClubId={data.ownClubId}
                    near={data.ours.data?.[0]?.latitude != null && data.ours.data[0].longitude != null ? { lat: data.ours.data[0].latitude, lng: data.ours.data[0].longitude } : null} />}
            </fieldset>
            <fieldset className="gk-arrange__group" disabled={busy}>
                <legend className="gk-visually-hidden">Where</legend>
                <GroundField mode={mode} value={effective.ground} hosting={draft.hosting} onChange={ground => patch({ ground, groundTouched: true })} onHosting={hosting => patch({ hosting })}
                    ours={data.ours} theirs={mode === 'direct' && draft.opponent ? data.theirs : null} opponentName={draft.opponent?.name} opponentCity={draft.opponent?.city} defaultCity={data.ownCity} error={shown.ground} />
            </fieldset>
            <fieldset className="gk-arrange__group" disabled={busy}>
                <legend className="gk-visually-hidden">Referee and notes</legend>
                <RefereeField mode={mode} draft={draft} squadId={data.squadId} onChange={patch} error={shown.referee} opponentName={draft.opponent?.name} />
                <Field label={mode === 'direct' ? 'Note for their coach' : 'Details for interested teams'} htmlFor="arrange-note" hint="Optional. Kit colours, arrival time, playing rules.">
                    <textarea id="arrange-note" className="gk-input" maxLength={2000} rows={3} value={draft.note} onChange={event => patch({ note: event.target.value })}
                        placeholder={mode === 'direct' ? 'We would love a game before the league restarts…' : 'Squad of 14, happy to play 3 × 25 minutes…'} />
                </Field>
                <MoreDetails draft={draft} automaticTitle={title} onChange={patch} timezoneError={shown.timezone} />
            </fieldset>
            <footer className="gk-arrange__foot">
                {problemCount > 0 && <p className="gk-notice gk-notice--warning" role="alert">{problemCount === 1 ? 'One detail needs your attention.' : `${problemCount} details need your attention.`} They are marked in the form.</p>}
                {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
                <p className="gk-arrange__next">{whatHappens(mode, effective, targetSquadName)}</p>
                <div className="gk-arrange__actions">
                    {draftStarted(draft) && (confirmReset
                        ? <span className="gk-arrange__confirm" role="group" aria-label="Clear this draft?">
                            <Button size="sm" variant="danger" onClick={() => { reset(); setChecked(false); setError(''); setConfirmReset(false); }}>Clear draft</Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Keep it</Button>
                        </span>
                        : <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>Start over</Button>)}
                    <Button variant="primary" type="submit" disabled={busy} className="gk-arrange__send">{busy ? 'Sending…' : mode === 'direct' ? 'Send invitation' : 'Post open match'}</Button>
                </div>
            </footer>
        </form>
    );
}
