import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, Lock, Plus } from 'lucide-react';
import { Avatar } from '../../../../design/primitives';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { useMapContextPoints } from '../../directory/mapExtras';
import { SELECTED, SHOWN } from '../../directory/useDirectoryState';
import { first, type DirectoryQuery } from '../../directory/types';
import { fixtureDay, fixtureTime, hoursUntil } from '../../format';
import { peekOf, usePeek } from '../../peek/usePeek';
import { StageDock } from '../../stage/WorldStage';
import { OPEN_SEAT, useSeats, type Seat } from './dugoutData';
import '../../scoreboard/scoreboard.css';

const FOLD = 'gk-world-dugout-folded';
const SHOWN_ROWS = 3;
const readFold = () => { try { return localStorage.getItem(FOLD) === '1'; } catch { return false; } };
const writeFold = (folded: boolean) => { try { if (folded) localStorage.setItem(FOLD, '1'); else localStorage.removeItem(FOLD); } catch { /* the fold is a convenience */ } };

/** A match day's state in words, with its dot: what the seat needs, and how urgently. */
function seatState(seat: Seat, t: ReturnType<typeof useWorldCopy>) {
    const { match, referee } = seat;
    if (match.referee_status === 'REPLACEMENT_NEEDED') return { tone: 'danger', text: t('Referee withdrew') };
    if (referee?.status === 'INVITED' || match.referee_status === 'INVITED') return { tone: 'neutral', text: referee?.name ? t('Waiting for {name}', { name: referee.name.split(' ')[0] }) : t('Referee invited') };
    if (!OPEN_SEAT.has(match.referee_status)) return { tone: 'quiet', text: t('Referee set') };
    return { tone: (hoursUntil(match.starts_at_iso) ?? Infinity) < 72 ? 'danger' : 'warning', text: t('Find a referee') };
}

/** One match day: when, your squad and the other side, the referee seat, and its state. */
function DugoutRow({ seat, chosen, onChoose }: { seat: Seat; chosen: boolean; onChoose: () => void }) {
    const t = useWorldCopy();
    const peek = usePeek();
    const { match, referee } = seat;
    const state = seatState(seat, t);
    const empty = OPEN_SEAT.has(match.referee_status) && !referee;
    const locked = match.referee_responsibility === 'OPPONENT' && match.can_arrange_official === false;
    // When the guest arranges the referee, the match day is the guest's: their squad, against the host.
    const guest = match.referee_responsibility === 'OPPONENT';
    const squad = guest ? match.opponent_squad_name ?? match.squad_name : match.squad_name;
    const other = guest ? match.club_name : match.opponent_name;
    const label = t('Referee for {squad}, {when}: {state}', { squad, when: `${fixtureDay(match.starts_at_iso, match.timezone)} ${fixtureTime(match.starts_at_iso, match.timezone)}`, state: state.text });
    return (
        <li className="gk-dugout__row" data-chosen={chosen || undefined}>
            <span className="gk-sb__when"><b>{fixtureTime(match.starts_at_iso, match.timezone)}</b><small>{fixtureDay(match.starts_at_iso, match.timezone)}</small></span>
            {guest ? <Crest name={match.opponent_name ?? squad} size={24} /> : <Crest src={match.club_logo_url} name={match.club_name} size={24} />}
            <span className="gk-dugout__match"><strong>{squad}</strong><small>{other ? t('v {opponent}', { opponent: other }) : t('Opponent wanted')}</small></span>
            {locked ? <span className="gk-dugout__seat" data-locked title={t('The other club arranges the referee')} aria-label={label} role="img"><Lock aria-hidden="true" /></span>
                : empty ? <button type="button" className="gk-dugout__seat" data-empty aria-pressed={chosen} aria-label={label} onClick={onChoose}><Plus aria-hidden="true" /></button>
                : <button type="button" className="gk-dugout__seat" data-status={referee?.status ?? match.referee_status} aria-label={label} onClick={() => referee ? peek.open(peekOf('person', referee.id)) : onChoose()}>
                    <Avatar name={referee?.name ?? '?'} size={30} />
                </button>}
            <Link className="gk-sb__wait gk-dugout__state" data-tone={state.tone} to={`/match-exchange/${match.event_id}`}>{state.text}<ArrowRight aria-hidden="true" /></Link>
        </li>
    );
}

/**
 * The Dugout: a coach's coming match days that need a referee, docked on the map. Pressing an empty seat chooses
 * that match: the referees below become the bench for it (its format, who reaches its ground) and its ground shows on
 * the map. It folds to its header, and the fold is remembered.
 */
export function Dugout({ query }: { query: DirectoryQuery; refresh: () => void }) {
    const t = useWorldCopy();
    const { seats, open, invited, complete, shown, loading, error, retry } = useSeats();
    const [, setParams] = useSearchParams();
    const [folded, setFolded] = useState(readFold);
    const [all, setAll] = useState(false);
    const chosen = first(query, 'match');
    const chosenSeat = seats.find(seat => String(seat.match.event_id) === chosen);
    const ground = chosenSeat?.match.location_lat != null && chosenSeat.match.location_lng != null
        ? [{ id: `ground:${chosenSeat.match.event_id}`, lat: chosenSeat.match.location_lat, lng: chosenSeat.match.location_lng, tone: 'match' as const, label: chosenSeat.match.location_name || t('The ground') }] : undefined;
    useMapContextPoints(ground);
    if (!shown) return null;
    const choose = (id: number) => setParams(current => {
        const next = new URLSearchParams(current);
        if (next.get('match') === String(id)) next.delete('match'); else next.set('match', String(id));
        ['format', 'free', SELECTED, SHOWN].forEach(key => next.delete(key));
        return next;
    }, { replace: true, preventScrollReset: true });
    const toggle = () => { setFolded(value => { writeFold(!value); return !value; }); };
    const visible = all ? seats : seats.slice(0, SHOWN_ROWS);
    return (
        <StageDock>
            <section className="gk-dugout" data-folded={folded || undefined} aria-label={t('Your match days needing a referee')}>
                <header className="gk-dugout__head">
                    <span className="gk-dugout__title">{t('Your match days')}</span>
                    <span className="gk-dugout__count">{loading ? '…' : error ? t('Could not load') : open ? open === 1 ? t('1 match needs a referee') : t('{count} matches need a referee', { count: open })
                        : invited ? t('{count} invited, no answer yet', { count: invited }) : complete ? t('Every match has its referee') : t('No open seats in your next match days')}</span>
                    <button type="button" className="gk-dugout__fold" aria-expanded={!folded} onClick={toggle} aria-label={folded ? t('Show your match days') : t('Fold your match days')}><ChevronDown aria-hidden="true" /></button>
                </header>
                {!folded && (error ? <p className="gk-dugout__note">{error} <button type="button" className="gk-browse__retry" onClick={retry}>{t('Try again')}</button></p>
                    : seats.length > 0 && <>
                        <ul className="gk-dugout__rows">{visible.map(seat => <DugoutRow key={seat.match.event_id} seat={seat} chosen={String(seat.match.event_id) === chosen} onChoose={() => choose(seat.match.event_id)} />)}</ul>
                        {seats.length > SHOWN_ROWS && <button type="button" className="gk-dugout__more" onClick={() => setAll(value => !value)}>{all ? t('Show fewer') : t('{count} more', { count: seats.length - SHOWN_ROWS })}</button>}
                    </>)}
            </section>
        </StageDock>
    );
}
