import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { Button } from '../../../../design/primitives';
import type { Match, Squad } from '../../../matchExchange/api';
import { ageGroupOf } from '../../../matchExchange/arrange/matchPlan';
import { canUseReservation, holdsGround, isActive, needsReferee } from '../../../matchExchange/detail/matchState';
import { answerInvitation, offerToPlay } from '../../../matchExchange/detail/opponentActions';
import { forget } from '../../cache';
import { useWorldCopy } from '../../copy';
import { loadMyFit } from '../../directories/matches/openMatches';
import { isoDayOf } from '../../format';
import { fitOf, fitSquads } from '../../scoreboard/squadFit';
import { useWorldData } from '../../useWorldData';
import { SendError } from '../SendError';
import { useSend } from '../useSend';
import '../step.css';

/**
 * Offering to play an open match, inside its drawer: the squad that would play (the one that fits the listing's age
 * group chosen, the rest one press away), a warning when that squad already plays that day, a word for their coach, and
 * one sentence saying exactly what is sent. The host chooses one offer; nothing is agreed until they accept.
 */
export function OfferStep({ listing, squads, reload }: { listing: Match; squads: Squad[]; reload: () => void }) {
    const t = useWorldCopy();
    const { sessionId } = useAuth();
    const noteId = useId();
    const fit = useWorldData(`my-fit:${sessionId}`, () => loadMyFit(sessionId)).data;
    const eligible = squads.filter(squad => squad.club_id !== listing.club_id);
    const sameAge = eligible.filter(squad => ageGroupOf(squad.category) === listing.age_group);
    const choices = [...sameAge, ...eligible.filter(squad => !sameAge.includes(squad))];
    // The squads of the listing's age group are the quick choices; any other squad is one list away.
    const quick = sameAge.length ? sameAge : choices, others = choices.filter(squad => !quick.includes(squad));
    const [picked, setPicked] = useState<number>();
    const squadId = picked ?? fitOf(listing, fitSquads(squads))?.id ?? (choices.length === 1 ? choices[0].id : undefined);
    const squad = choices.find(item => item.id === squadId);
    const [note, setNote] = useState('');
    // An offer changes which listings I have offered on: the open matches' "Your U14 Boys?" asks again.
    const { busy, error, changed, send } = useSend(() => { forget(`my-fit:${sessionId}`); reload(); });
    const playsThatDay = squad && fit?.busy.get(squad.id)?.has(isoDayOf(listing.starts_at_iso));
    return (
        <section className="gk-step" aria-label={t('Offer to play')}>
            <h4 className="gk-step__title">{t('Offer to play')}</h4>
            {choices.length > 1 && <div className="gk-step__row" role="group" aria-label={t('Your squad')}>
                {quick.map(item => <button key={item.id} type="button" className="gk-chip" aria-pressed={item.id === squadId} onClick={() => setPicked(item.id)}>{item.name}</button>)}
                {others.length > 0 && <select className="gk-input gk-step__other" aria-label={t('Another squad')} value={others.some(item => item.id === squadId) ? squadId : ''}
                    onChange={event => event.target.value && setPicked(Number(event.target.value))}>
                    <option value="">{t('Another squad…')}</option>
                    {others.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>}
            </div>}
            {playsThatDay && <p className="gk-step__warn">{t('{squad} already plays that day', { squad: squad.name })}</p>}
            <label className="gk-visually-hidden" htmlFor={noteId}>{t('A word for their coach')}</label>
            <textarea id={noteId} className="gk-input" rows={2} maxLength={2000} value={note} placeholder={t('A word for their coach (optional)')} onChange={event => setNote(event.target.value)} />
            <p className="gk-step__preview">{squad
                ? t('Offers {squad} to {club}. They choose one offer; nothing is agreed until they accept.', { squad: squad.name, club: listing.club_name })
                : t('Choose the squad that would play.')}</p>
            <SendError error={error} changed={changed} reload={reload} />
            <div className="gk-step__actions">
                <Button variant="primary" disabled={!squad || busy} onClick={() => void send(() => offerToPlay(listing, squad!.id, note.trim()),
                    t('{squad} offered to {club}. They choose one offer; you will see their answer here.', { squad: squad!.name, club: listing.club_name }), t('The offer could not be sent.'))}>
                    {busy ? t('Sending…') : t('Offer to play')}
                </Button>
            </div>
        </section>
    );
}

/**
 * A club's invitation to play, answered inside the match drawer: the squad that accepts (the one they asked for, when
 * they did), what accepting does, then Accept, or Decline after a second press.
 */
export function AnswerStep({ listing, squads, reload }: { listing: Match; squads: Squad[]; reload: () => void }) {
    const t = useWorldCopy();
    const available = squads.filter(squad => squad.club_id === listing.requested_club_id && (!listing.requested_squad_id || squad.id === listing.requested_squad_id));
    const [picked, setPicked] = useState<number>();
    const squadId = picked ?? listing.requested_squad_id ?? (available.length === 1 ? available[0].id : undefined);
    const squad = available.find(item => item.id === squadId);
    const [declining, setDeclining] = useState(false);
    const { busy, error, changed, send } = useSend(reload);
    return (
        <section className="gk-step" aria-label={t('Answer the invitation')}>
            <h4 className="gk-step__title">{t('{club} invited you to play', { club: listing.club_name })}</h4>
            {available.length > 1 && <div className="gk-step__row" role="group" aria-label={t('Your squad')}>
                {available.map(item => <button key={item.id} type="button" className="gk-chip" aria-pressed={item.id === squadId} onClick={() => setPicked(item.id)}>{item.name}</button>)}
            </div>}
            {available.length === 0
                ? <p className="gk-step__warn">{t('None of the squads you arrange for can accept. Ask your club’s leadership.')}</p>
                : <p className="gk-step__preview">{squad
                    ? t('Accepting adds the match to the schedule of {squad} and opens a conversation between both coaching teams.', { squad: squad.name })
                    : t('Choose the squad that would play.')}</p>}
            <SendError error={error} changed={changed} reload={reload} />
            <div className="gk-step__actions">
                {declining ? <>
                    <Button variant="danger" disabled={busy} onClick={() => void send(() => answerInvitation(listing, { accept: false }), t('Invitation declined. {club} is told.', { club: listing.club_name }), t('The answer could not be sent.'))}>{t('Decline the invitation')}</Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setDeclining(false)}>{t('Keep it')}</Button>
                </> : <>
                    <Button variant="primary" disabled={!squad || busy} onClick={() => void send(() => answerInvitation(listing, { accept: true, squadId: squad!.id }), t('Invitation accepted. The match is in the schedule of {squad}.', { squad: squad!.name }), t('The answer could not be sent.'))}>
                        {busy ? t('Sending…') : t('Accept invitation')}
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setDeclining(true)}>{t('Decline')}</Button>
                </>}
            </div>
        </section>
    );
}

/** A match of ours still without a referee: the line that opens the referees who fit it (People › Referees, for this match). */
export function RefereeLine({ listing }: { listing: Match }) {
    const t = useWorldCopy();
    const replacement = listing.referee_status === 'REPLACEMENT_NEEDED';
    if (!needsReferee(listing)) return null;
    return (
        <Link className="gk-step-line" data-tone={replacement ? 'danger' : undefined} to={`/world/people?tab=referees&match=${listing.event_id}`}>
            <span>{replacement ? t('A replacement referee is needed') : t('Referee needed')}</span><b>{t('Find a referee')}</b><ArrowRight aria-hidden="true" />
        </Link>
    );
}

/**
 * A match of ours whose ground is not settled: the line to the match page's step that uses a reservation for it, or,
 * when its reservation no longer fits, to the venue that holds it (another one cannot be used until that is changed).
 */
export function GroundLine({ listing, now }: { listing: Match; now: number }) {
    const t = useWorldCopy();
    const attention = listing.venue_status === 'NEEDS_ATTENTION';
    if (!(attention || listing.venue_status === 'NEEDED')) return null;
    if (holdsGround(listing) && listing.can_arrange && isActive(listing, now)) return (
        <Link className="gk-step-line" data-tone={attention ? 'danger' : undefined} to={`/stadiums/${listing.booking!.venue_id}`}>
            <span>{attention ? t('The ground needs attention') : t(listing.location_name ? 'Ground not booked yet' : 'Ground to arrange')}</span><b>{t('Change the reservation')}</b><ArrowRight aria-hidden="true" />
        </Link>
    );
    if (!canUseReservation(listing, isActive(listing, now))) return null;
    return (
        <Link className="gk-step-line" data-tone={attention ? 'danger' : undefined} to={`/match-exchange/${listing.event_id}?ground=reserve`}>
            <span>{attention ? t('The ground needs attention') : t(listing.location_name ? 'Ground not booked yet' : 'Ground to arrange')}</span><b>{t('Use a reservation')}</b><ArrowRight aria-hidden="true" />
        </Link>
    );
}
