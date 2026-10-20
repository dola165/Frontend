import { useEffect, useState } from 'react';
import { Check, Loader2, LocateFixed, MapPin } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Crest } from '../../world/Crest';
import { fetchClubsNear, fetchSavedTown, followClub, saveStart, unfollowClub, type NearbyClub } from '../startApi';
import { DEFAULT_TOWN, locateTown, TOWNS, townByName, type Town } from '../towns';

/**
 * Clubs near the person's town (the one given at sign-up, which the device's location guessed; else the capital, and
 * the device can be asked again), each followed or unfollowed with one tap. A follow that fails goes back and says so.
 */
export function FollowStep() {
    const copy = useJourneyCopy();
    const userId = useAuth().user?.id;
    const [town, setTown] = useState<Town | null>(null);
    const [found, setFound] = useState<{ town: string; clubs: NearbyClub[] } | null>(null);
    const [following, setFollowing] = useState<Map<number, boolean>>(new Map());
    const [busy, setBusy] = useState<Set<number>>(new Set());
    const [failed, setFailed] = useState(false);
    const [locating, setLocating] = useState<'idle' | 'locating' | 'failed'>('idle');

    useEffect(() => {
        if (!userId) return;
        const controller = new AbortController();
        fetchSavedTown(userId, controller.signal)
            .catch(() => null)
            .then(saved => { if (!controller.signal.aborted) setTown(current => current ?? saved ?? DEFAULT_TOWN); });
        return () => controller.abort();
    }, [userId]);
    useEffect(() => {
        if (!town) return;
        const controller = new AbortController();
        fetchClubsNear(town, 6, controller.signal).then(clubs => {
            if (controller.signal.aborted) return;
            setFound({ town: town.name, clubs });
            setFollowing(new Map(clubs.map(club => [club.id, Boolean(club.isFollowedByMe)])));
        }).catch(() => { if (!controller.signal.aborted) setFound({ town: town.name, clubs: [] }); });
        return () => controller.abort();
    }, [town]);

    const choose = (next: Town) => {
        setTown(next);
        if (userId) void saveStart(userId, { town: next }).catch(() => undefined);
    };
    const findMe = async () => {
        setLocating('locating');
        const located = await locateTown();
        if (located) { choose(located); setLocating('idle'); } else setLocating('failed');
    };
    const toggle = async (club: NearbyClub) => {
        const on = !following.get(club.id);
        setFailed(false);
        setBusy(current => new Set(current).add(club.id));
        setFollowing(current => new Map(current).set(club.id, on));
        try { await (on ? followClub(club.id) : unfollowClub(club.id)); }
        catch { setFollowing(current => new Map(current).set(club.id, !on)); setFailed(true); }
        finally { setBusy(current => { const next = new Set(current); next.delete(club.id); return next; }); }
    };

    const clubs = found && town && found.town === town.name ? found.clubs : null;
    return <>
        <div className="gk-welcome__town">
            <label className="gk-welcome__town-pick">
                <MapPin aria-hidden="true" />
                <span className="gk-visually-hidden">{copy('Your town', 'თქვენი ქალაქი')}</span>
                <select className="gk-input" value={town?.name ?? ''} disabled={!town} onChange={event => choose(townByName(event.target.value) ?? DEFAULT_TOWN)}>
                    {!town && <option value="">{copy('Finding your town…', 'ვეძებთ თქვენს ქალაქს…')}</option>}
                    {TOWNS.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
                </select>
            </label>
            <button type="button" className="gk-chip" disabled={locating === 'locating'} onClick={() => void findMe()}>
                {locating === 'locating' ? <Loader2 className="gk-welcome__spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}{copy('Use my location', 'ჩემი მდებარეობით')}
            </button>
        </div>
        {locating === 'failed' && <p role="status" className="gk-welcome__note">{copy('Your location is not available. Pick your town.', 'მდებარეობა მიუწვდომელია. აირჩიეთ ქალაქი.')}</p>}
        {clubs === null ? <p role="status" className="gk-welcome__note"><Loader2 className="gk-welcome__spin" aria-hidden="true" /> {copy('Finding clubs near you…', 'ვეძებთ კლუბებს თქვენს გვერდით…')}</p>
            : clubs.length === 0 ? <p className="gk-welcome__note">{copy(`No clubs near ${town?.name} yet.`, `${town?.name}-თან კლუბები ჯერ არ არის.`)}</p>
            : <ul className="gk-welcome__list" aria-label={copy('Clubs near you', 'კლუბები თქვენთან ახლოს')}>{clubs.map(club => {
                const on = following.get(club.id) === true;
                return <li key={club.id} className="gk-welcome__row">
                    <Crest src={club.logoUrl} name={club.name} size={40} />
                    <span className="gk-welcome__text"><strong>{club.name}</strong><small>{[club.cityName, copy(`${club.km} km`, `${club.km} კმ`)].filter(Boolean).join(' · ')}</small></span>
                    <button type="button" className="gk-btn gk-btn--sm gk-welcome__follow" data-on={on || undefined} aria-pressed={on} disabled={busy.has(club.id)} onClick={() => void toggle(club)}>
                        {on && <Check aria-hidden="true" />}{on ? copy('Following', 'მიჰყვებით') : copy('Follow', 'მიყოლა')}
                    </button>
                </li>;
            })}</ul>}
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('That follow did not go through. Try again.', 'მიყოლა ვერ მოხერხდა. სცადეთ ხელახლა.')}</p>}
    </>;
}
