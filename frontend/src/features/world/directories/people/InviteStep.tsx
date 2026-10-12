import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Send } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { Button } from '../../../../design/primitives';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { post, type Referee } from '../../../matchExchange/api';
import { useWorldCopy } from '../../copy';
import { fixtureDay, fixtureTime } from '../../format';
import { listingDetail } from '../../front/coach/coachMatches';
import { useWorldData } from '../../useWorldData';
import { peekClick, peekOf, useRelatedOpen } from '../../peek/usePeek';
import { listingCode } from '../../scoreboard/matchCode';
import { OPEN_SEAT, seatsChanged, useSeats } from './dugoutData';
import { formatsOf } from './refereeData';
import '../../peek/step.css';
import './people.css';

type Duty = 'REFEREE' | 'ASSISTANT_1' | 'ASSISTANT_2';
const DUTIES: { value: Duty; label: string }[] = [{ value: 'REFEREE', label: 'Referee' }, { value: 'ASSISTANT_1', label: 'Assistant 1' }, { value: 'ASSISTANT_2', label: 'Assistant 2' }];

/**
 * Inviting a referee to the match being staffed, inside their peek: the duty, the terms they accept, one sentence
 * saying exactly what will be asked, then Send. The referee answers; until then the seat waits.
 */
export function InviteStep({ referee, matchId }: { referee: Referee; matchId: number }) {
    const t = useWorldCopy();
    const relate = useRelatedOpen();
    const { sessionId } = useAuth();
    const [attempt, setAttempt] = useState(0);
    const loaded = useWorldData(`invite-match:${sessionId}:${matchId}:${attempt}`, () => listingDetail(sessionId, matchId));
    const match = loaded.data;
    const live = (match?.appointments ?? []).filter(item => ['INVITED', 'ACCEPTED'].includes(item.status));
    const taken = new Set(live.map(item => item.duty));
    const theirs = live.find(item => item.referee_id === referee.user_id);
    const [duty, setDuty] = useState<Duty | null>(null);
    const chosenDuty = duty ?? DUTIES.find(item => !taken.has(item.value))?.value ?? 'REFEREE';
    const [volunteerChoice, setVolunteer] = useState<boolean | null>(null);
    const volunteer = volunteerChoice ?? (referee.accepts_volunteer || !referee.accepts_paid);
    const [state, setState] = useState<{ busy: boolean; sent: boolean; error: string; changed: boolean }>({ busy: false, sent: false, error: '', changed: false });

    if (loaded.loading) return <p className="gk-faint">{t('Loading the match…')}</p>;
    if (!match) return <p className="gk-world-row-note">{loaded.error || t('This match could not load.')} <button type="button" className="gk-browse__retry" onClick={loaded.retry}>{t('Try again')}</button></p>;
    const when = `${fixtureDay(match.starts_at_iso, match.timezone)} ${fixtureTime(match.starts_at_iso, match.timezone)}`;
    const heading = <h4 className="gk-step__title">{t('Invite to {match}', { match: `${match.squad_name} · ${when}` })}</h4>;
    if (match.can_arrange_official === false) return <section className="gk-step">{heading}<p className="gk-faint">{t('The other club arranges the referee for this match.')}</p></section>;
    if (theirs || state.sent) return (
        <section className="gk-step" data-done>{heading}
            <p role="status">{theirs?.status === 'ACCEPTED' ? t('{name} referees this match.', { name: referee.full_name }) : t('Invited. {name} will answer; the seat waits until then.', { name: referee.full_name })}</p>
            <Link className="gk-section__action" to={`/match-exchange/${match.event_id}`} onClick={peekClick(peekOf('match', listingCode(match.event_id)), relate)}>{t('Open match')}</Link>
        </section>
    );
    if (!referee.accepts_paid && !referee.accepts_volunteer) return <section className="gk-step">{heading}<p className="gk-faint">{t('{name} is not taking matches.', { name: referee.full_name })}</p></section>;
    if (match.format && !formatsOf(referee).includes(match.format)) return <section className="gk-step">{heading}<p className="gk-faint">{t('{name} does not take this format.', { name: referee.full_name })}</p></section>;
    const fee = `${referee.fee} ${referee.currency}`;
    const send = async () => {
        setState({ busy: true, sent: false, error: '', changed: false });
        try {
            await post(`/match-exchange/${match.event_id}/referees`, { refereeId: referee.user_id, duty: chosenDuty, volunteer, fee: volunteer ? 0 : referee.fee, currency: referee.currency, revision: match.revision });
            seatsChanged(sessionId, match.event_id);
            setState({ busy: false, sent: true, error: '', changed: false });
        } catch (error) {
            const changed = isAxiosError(error) && error.response?.status === 409;
            setState({ busy: false, sent: false, changed, error: changed ? t('This match changed since you opened it.') : extractApiErrorMessage(error, t('The invitation could not be sent.')) });
        }
    };
    const reload = () => { seatsChanged(sessionId, match.event_id); setAttempt(value => value + 1); setState({ busy: false, sent: false, error: '', changed: false }); };
    const dutyWord = t(DUTIES.find(item => item.value === chosenDuty)!.label).toLowerCase();
    const preview = t(volunteer ? 'Ask {name} to be {duty} for {squad}, {when} at {place}, as a volunteer.' : 'Ask {name} to be {duty} for {squad}, {when} at {place}, for {fee}.',
        { name: referee.full_name, duty: dutyWord, squad: match.squad_name, when, place: match.location_name || t('your ground'), fee });
    return (
        <section className="gk-step">
            {heading}
            <div className="gk-step__row" role="group" aria-label={t('Duty')}>
                {DUTIES.map(item => <button key={item.value} type="button" className="gk-chip" aria-pressed={chosenDuty === item.value} disabled={taken.has(item.value)} onClick={() => setDuty(item.value)}>{t(item.label)}</button>)}
            </div>
            <div className="gk-step__row" role="group" aria-label={t('Terms')}>
                <button type="button" className="gk-chip" aria-pressed={volunteer} disabled={!referee.accepts_volunteer} onClick={() => setVolunteer(true)}>{t('Volunteer')}</button>
                <button type="button" className="gk-chip" aria-pressed={!volunteer} disabled={!referee.accepts_paid} onClick={() => setVolunteer(false)}>{fee}</button>
            </div>
            <p className="gk-step__preview">{preview}</p>
            {state.error && <p className="gk-step__error" role="alert">{state.error}{state.changed && <> <button type="button" className="gk-browse__retry" onClick={reload}>{t('Reload')}</button></>}</p>}
            <Button variant="primary" onClick={() => { void send(); }} disabled={state.busy || taken.has(chosenDuty) || !(volunteer ? referee.accepts_volunteer : referee.accepts_paid)}><Send aria-hidden="true" />{state.busy ? t('Sending…') : t('Send invitation')}</Button>
        </section>
    );
}

/**
 * Inviting a referee met anywhere in World, before a match is chosen: the coach's own coming matches that still need
 * one and are of a format the referee takes, as chips; choosing one opens the invitation for that match (as a Dugout
 * seat does). Nothing shows without one.
 */
export function InvitePick({ referee }: { referee: Referee }) {
    const t = useWorldCopy();
    const location = useLocation();
    const [, setParams] = useSearchParams();
    const { seats } = useSeats();
    const takes = formatsOf(referee);
    const open = seats.filter(({ match, referee: seated }) => !seated && OPEN_SEAT.has(match.referee_status) && match.referee_status !== 'INVITED'
        && (!match.format || takes.includes(match.format))).slice(0, 4);
    if (!open.length) return null;
    const choose = (eventId: number) => setParams(next => { const copy = new URLSearchParams(next); copy.set('match', String(eventId)); return copy; },
        { replace: true, preventScrollReset: true, state: location.state });
    return (
        <section className="gk-step" aria-label={t('Invite {name} to a match', { name: referee.full_name })}>
            <h4 className="gk-step__title">{t('Invite {name} to a match', { name: referee.full_name })}</h4>
            <div className="gk-step__row" role="group" aria-label={t('Your matches that need a referee')}>
                {open.map(({ match }) => <button key={match.event_id} type="button" className="gk-chip" onClick={() => choose(match.event_id)}>
                    {match.squad_name} · {fixtureDay(match.starts_at_iso, match.timezone)} {fixtureTime(match.starts_at_iso, match.timezone)}
                </button>)}
            </div>
        </section>
    );
}
