import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button, SearchInput, Skeleton } from '../../../design/primitives';
import { ActionTiles } from '../../../design/ChoiceTiles';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Crest } from '../../world/Crest';
import { countryOf, inGeorgian } from '../setupWords';
import { fetchClubsNearYou, followClub, searchClubs, unfollowClub, type NearbyClub } from '../startApi';
import type { WelcomeFacts } from '../useWelcomeFacts';

const SHOWN = 8;

/**
 * Step 3: clubs as tiles, in the person's own country: the most followed first, then those near a town they gave
 * (without repeats); a search on top finds any club by name. Each tile has the app's Follow button, which follows at
 * once and unfollows on a second tap; the rest of the tile does nothing. A follow that fails goes back and says so.
 */
export function ClubsStep({ facts }: { facts: WelcomeFacts }) {
    const copy = useJourneyCopy();
    const town = facts.place?.source === 'SAVED' ? facts.place.name : null;
    const [lists, setLists] = useState<{ popular: NearbyClub[]; near: NearbyClub[] } | null>(null);
    const [found, setFound] = useState<NearbyClub[] | null>(null);
    const [query, setQuery] = useState('');
    // What changed here, over each club as it was loaded: following now, and the follower count with it.
    const [changed, setChanged] = useState<Map<number, boolean>>(new Map());
    const [busy, setBusy] = useState<Set<number>>(new Set());
    const [more, setMore] = useState({ popular: false, near: false });
    const [failed, setFailed] = useState(false);
    const searching = query.trim().length >= 2;

    useEffect(() => {
        if (!facts.place) return;
        const controller = new AbortController();
        Promise.all([fetchClubsNearYou(24, 'POPULAR', controller.signal), town ? fetchClubsNearYou(24, 'NEAREST', controller.signal) : Promise.resolve([])])
            .then(([popular, near]) => { if (!controller.signal.aborted) setLists({ popular, near }); })
            .catch(() => { if (!controller.signal.aborted) setLists({ popular: [], near: [] }); });
        return () => controller.abort();
    }, [facts.place, town]);

    useEffect(() => {
        if (!searching) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            searchClubs(query.trim(), controller.signal).then(setFound).catch(() => { if (!controller.signal.aborted) setFound([]); });
        }, 300);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [query, searching]);

    const following = (club: NearbyClub) => changed.get(club.id) ?? club.following;
    const mark = (id: number, value: boolean) => setChanged(current => new Map(current).set(id, value));
    const toggle = async (club: NearbyClub) => {
        const on = !following(club);
        setFailed(false);
        setBusy(current => new Set(current).add(club.id));
        mark(club.id, on);
        try { await (on ? followClub(club.id) : unfollowClub(club.id)); }
        catch { mark(club.id, !on); setFailed(true); }
        finally { setBusy(current => { const next = new Set(current); next.delete(club.id); return next; }); }
    };
    const tiles = (clubs: NearbyClub[]) => clubs.map(club => {
        const now = following(club);
        const followers = club.followers + (now === club.following ? 0 : now ? 1 : -1);
        return {
            id: String(club.id), label: club.name, icon: <Crest src={club.logoUrl} name={club.name} size={36} />,
            hint: [club.cityName, copy(`${followers} ${followers === 1 ? 'follower' : 'followers'}`, `${followers} გამომწერი`)].filter(Boolean).join(' · '),
            action: <Button size="sm" aria-pressed={now} disabled={busy.has(club.id)} aria-label={copy(`${now ? 'Following' : 'Follow'} ${club.name}`, `${club.name} — ${now ? 'გამოწერილია' : 'გამოწერა'}`)} onClick={() => void toggle(club)}>
                {now ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{now ? copy('Following', 'გამოწერილია') : copy('Follow', 'გამოწერა')}
            </Button>,
        };
    });
    const group = (title: string, clubs: NearbyClub[], key: 'popular' | 'near') => clubs.length > 0 && <section className="gk-setup-group" aria-label={title}>
        <h3>{title}</h3>
        <ActionTiles items={tiles(more[key] ? clubs : clubs.slice(0, SHOWN))} label={title} />
        {!more[key] && clubs.length > SHOWN && <Button variant="ghost" size="sm" onClick={() => setMore(current => ({ ...current, [key]: true }))}>{copy('Show more', 'მეტის ჩვენება')}</Button>}
    </section>;

    const country = facts.place ? countryOf(facts.place) : '';
    const popularShown = lists ? (more.popular ? lists.popular : lists.popular.slice(0, SHOWN)).map(club => club.id) : [];
    const near = lists ? lists.near.filter(club => !popularShown.includes(club.id)) : [];
    const loading = <div role="status" aria-label={copy('Loading clubs', 'კლუბები იტვირთება')} className="gk-setup__loading"><Skeleton height={56} /><Skeleton height={56} /></div>;
    return <div className="gk-setup__form">
        <SearchInput aria-label={copy('Search clubs by name', 'კლუბების ძებნა სახელით')} placeholder={copy('Search clubs by name', 'კლუბების ძებნა სახელით')} value={query}
            onChange={event => { setQuery(event.target.value); if (event.target.value.trim().length < 2) setFound(null); }} />
        {searching
            ? found === null ? loading
                : found.length ? <ActionTiles items={tiles(found)} label={copy('Clubs found', 'ნაპოვნი კლუბები')} />
                : <p className="gk-setup__hint">{copy('No club by that name yet.', 'ასეთი სახელის კლუბი ჯერ არ არის.')}</p>
            : !lists ? loading
            : lists.popular.length === 0 ? <p className="gk-setup__hint">{copy('No clubs here yet. Search for one by name.', 'აქ კლუბები ჯერ არ არის. მოძებნეთ სახელით.')}</p>
            : <>
                {group(copy(`Popular in ${country}`, `პოპულარული ${inGeorgian(country)}`), lists.popular, 'popular')}
                {town && group(copy(`Near ${town}`, `${town}-თან ახლოს`), near, 'near')}
            </>}
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('That follow did not go through. Try again.', 'გამოწერა ვერ შესრულდა. სცადეთ ხელახლა.')}</p>}
    </div>;
}
