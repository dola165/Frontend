import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button, SearchInput, Skeleton } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Crest } from '../../world/Crest';
import { followClub, searchClubs, unfollowClub, type NearbyClub } from '../startApi';
import type { WelcomeFacts } from '../useWelcomeFacts';
import { countryOf, inGeorgian } from '../setupWords';

const SHOWN = 8;

/**
 * Step 3: clubs near the person, in their own country, nearest first from a town they gave; a search finds any other
 * club by name. Each row follows or unfollows with one tap; a follow that fails goes back and says so.
 */
export function ClubsStep({ facts }: { facts: WelcomeFacts }) {
    const copy = useJourneyCopy();
    const [query, setQuery] = useState('');
    const [found, setFound] = useState<NearbyClub[] | null>(null);
    const [all, setAll] = useState(false);
    const [busy, setBusy] = useState<Set<number>>(new Set());
    const [failed, setFailed] = useState(false);
    const searching = query.trim().length >= 2;

    useEffect(() => {
        if (!searching) { setFound(null); return; }
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            searchClubs(query.trim(), controller.signal).then(setFound).catch(() => { if (!controller.signal.aborted) setFound([]); });
        }, 300);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [query, searching]);

    const toggle = async (club: NearbyClub) => {
        const on = !club.following;
        const mark = (following: boolean) => {
            facts.setFollowing(club.id, following);
            setFound(current => current?.map(item => item.id === club.id ? { ...item, following, followers: Math.max(0, item.followers + (following ? 1 : -1)) } : item) ?? null);
        };
        setFailed(false);
        setBusy(current => new Set(current).add(club.id));
        mark(on);
        try { await (on ? followClub(club.id) : unfollowClub(club.id)); }
        catch { mark(!on); setFailed(true); }
        finally { setBusy(current => { const next = new Set(current); next.delete(club.id); return next; }); }
    };

    const near = facts.clubs ?? [];
    const rows = searching ? found : all ? near : near.slice(0, SHOWN);
    const place = facts.place;
    const where = !place ? null : place.source === 'SAVED' ? copy(`Near ${place.name}`, `${place.name}-თან ახლოს`) : copy(`In ${countryOf(place)}`, inGeorgian(countryOf(place)));
    return <div className="gk-setup__form">
        <SearchInput aria-label={copy('Search clubs by name', 'კლუბების ძებნა სახელით')} placeholder={copy('Search clubs by name', 'კლუბების ძებნა სახელით')} value={query} onChange={event => setQuery(event.target.value)} />
        {!searching && where && <p className="gk-setup__hint">{where}</p>}
        {rows === null || !facts.ready
            ? <div role="status" aria-label={copy('Loading clubs', 'კლუბები იტვირთება')} className="gk-stack gk-stack--tight"><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div>
            : rows.length === 0
                ? <p className="gk-setup__hint">{searching ? copy('No club by that name yet.', 'ასეთი სახელის კლუბი ჯერ არ არის.') : copy('No clubs near you yet. Search for one by name.', 'ახლოს კლუბები ჯერ არ არის. მოძებნეთ სახელით.')}</p>
                : <ul className="gk-setup-clubs" aria-label={searching ? copy('Clubs found', 'ნაპოვნი კლუბები') : copy('Clubs near you', 'კლუბები თქვენთან ახლოს')}>
                    {rows.map(club => {
                        const at = [club.cityName, club.km != null ? copy(`${club.km} km`, `${club.km} კმ`) : null].filter(Boolean).join(' · ');
                        const followers = copy(`${club.followers} ${club.followers === 1 ? 'follower' : 'followers'}`, `${club.followers} გამომწერი`);
                        return <li key={club.id} className="gk-setup-club">
                            <Crest src={club.logoUrl} name={club.name} size={36} />
                            <span className="gk-setup-club__text"><strong>{club.name}</strong><small>{[at, followers].filter(Boolean).join(' · ')}</small></span>
                            <Button size="sm" variant={club.following ? 'ghost' : 'secondary'} aria-pressed={club.following} disabled={busy.has(club.id)} onClick={() => void toggle(club)}>
                                {club.following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{club.following ? copy('Following', 'მიჰყვებით') : copy('Follow', 'მიყოლა')}
                            </Button>
                        </li>;
                    })}
                </ul>}
        {!searching && !all && near.length > SHOWN && <Button variant="ghost" size="sm" onClick={() => setAll(true)}>{copy('Show more', 'მეტის ჩვენება')}</Button>}
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('That follow did not go through. Try again.', 'მიყოლა ვერ მოხერხდა. სცადეთ ხელახლა.')}</p>}
    </div>;
}
