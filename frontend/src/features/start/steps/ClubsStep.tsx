import { useEffect, useState } from 'react';
import { Button, SearchInput, Skeleton } from '../../../design/primitives';
import { ChoiceTiles } from '../../../design/ChoiceTiles';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Crest } from '../../world/Crest';
import { countryOf, inGeorgian } from '../setupWords';
import { fetchClubsNearYou, followClub, searchClubs, unfollowClub, type NearbyClub } from '../startApi';
import type { WelcomeFacts } from '../useWelcomeFacts';

const SHOWN = 8;

/**
 * Step 3: clubs as tiles, in the person's own country: the most followed first, then those near a town they gave
 * (without repeats); a search on top finds any club by name. A tap picks; Next follows what is picked and unfollows
 * what was un-picked. Nothing is picked but the clubs the person already follows.
 */
export function ClubsStep({ facts, register }: { facts: WelcomeFacts; register: (save: (() => Promise<boolean>) | null) => void }) {
    const copy = useJourneyCopy();
    const town = facts.place?.source === 'SAVED' ? facts.place.name : null;
    const [lists, setLists] = useState<{ popular: NearbyClub[]; near: NearbyClub[] } | null>(null);
    const [found, setFound] = useState<NearbyClub[] | null>(null);
    const [query, setQuery] = useState('');
    const [seen, setSeen] = useState<Map<number, NearbyClub>>(new Map());
    const [picked, setPicked] = useState<Set<number>>(new Set());
    const [more, setMore] = useState({ popular: false, near: false });
    const [failed, setFailed] = useState(false);
    const searching = query.trim().length >= 2;

    // Every club shown is remembered with whether the person followed it when it first appeared.
    const remember = (clubs: NearbyClub[]) => {
        setSeen(current => { const next = new Map(current); clubs.forEach(club => { if (!next.has(club.id)) next.set(club.id, club); }); return next; });
        setPicked(current => { const next = new Set(current); clubs.forEach(club => { if (club.following) next.add(club.id); }); return next; });
    };

    useEffect(() => {
        if (!facts.place) return;
        const controller = new AbortController();
        Promise.all([fetchClubsNearYou(24, 'POPULAR', controller.signal), town ? fetchClubsNearYou(24, 'NEAREST', controller.signal) : Promise.resolve([])])
            .then(([popular, near]) => { if (!controller.signal.aborted) { remember([...popular, ...near]); setLists({ popular, near }); } })
            .catch(() => { if (!controller.signal.aborted) setLists({ popular: [], near: [] }); });
        return () => controller.abort();
    }, [facts.place, town]);

    useEffect(() => {
        if (!searching) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            searchClubs(query.trim(), controller.signal).then(clubs => { remember(clubs); setFound(clubs); }).catch(() => { if (!controller.signal.aborted) setFound([]); });
        }, 300);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [query, searching]);

    // Next follows what is picked and unfollows what was un-picked; nothing else changes.
    useEffect(() => {
        register(async () => {
            setFailed(false);
            const changes = [...seen.values()].filter(club => picked.has(club.id) !== club.following);
            try {
                await Promise.all(changes.map(club => (picked.has(club.id) ? followClub(club.id) : unfollowClub(club.id))));
                setSeen(current => new Map([...current].map(([id, club]) => [id, { ...club, following: picked.has(id) }])));
                return true;
            } catch { setFailed(true); return false; }
        });
        return () => register(null);
    });

    const toggle = (id: string) => setPicked(current => { const next = new Set(current); const club = Number(id); if (next.has(club)) next.delete(club); else next.add(club); return next; });
    const tiles = (clubs: NearbyClub[]) => clubs.map(club => {
        const followers = club.followers + (picked.has(club.id) === club.following ? 0 : picked.has(club.id) ? 1 : -1);
        return {
            id: String(club.id), label: club.name, icon: <Crest src={club.logoUrl} name={club.name} size={36} />,
            hint: [club.cityName, copy(`${followers} ${followers === 1 ? 'follower' : 'followers'}`, `${followers} გამომწერი`)].filter(Boolean).join(' · '),
        };
    });
    const chosen = [...picked].map(String);
    const group = (title: string, clubs: NearbyClub[], key: 'popular' | 'near') => clubs.length > 0 && <section className="gk-setup-group" aria-label={title}>
        <h3>{title}</h3>
        <ChoiceTiles compact items={tiles(more[key] ? clubs : clubs.slice(0, SHOWN))} chosen={chosen} onToggle={toggle} label={title} />
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
                : found.length ? <ChoiceTiles compact items={tiles(found)} chosen={chosen} onToggle={toggle} label={copy('Clubs found', 'ნაპოვნი კლუბები')} />
                : <p className="gk-setup__hint">{copy('No club by that name yet.', 'ასეთი სახელის კლუბი ჯერ არ არის.')}</p>
            : !lists ? loading
            : lists.popular.length === 0 ? <p className="gk-setup__hint">{copy('No clubs here yet. Search for one by name.', 'აქ კლუბები ჯერ არ არის. მოძებნეთ სახელით.')}</p>
            : <>
                {group(copy(`Popular in ${country}`, `პოპულარული ${inGeorgian(country)}`), lists.popular, 'popular')}
                {town && group(copy(`Near ${town}`, `${town}-თან ახლოს`), near, 'near')}
            </>}
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('Some follows did not go through. Try again.', 'ზოგიერთი გამოწერა ვერ შესრულდა. სცადეთ ხელახლა.')}</p>}
    </div>;
}
