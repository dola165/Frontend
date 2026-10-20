import { useEffect, useId, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../design/primitives';
import { fetchSimilar } from '../../pages/api';
import { claimHref, createHref, ownClub, pagePath } from '../../pages/create/entry';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { Crest } from '../../world/Crest';
import { fetchClubsNear, fetchSavedTown, type NearbyClub } from '../startApi';
import { DEFAULT_TOWN, type Town } from '../towns';
import type { StepProps } from '../WelcomeDialog';

const HOME = { pathname: '/home', search: '' };
interface Found { key: string; name: string; town: string | null; crestUrl: string | null; to: string; action: 'open' | 'mine' | 'claim' }

/**
 * Coach or club staff: find the club first, so nobody makes a second page of it. The clubs near the person's town show
 * at once; typing searches every page. A known club opens (to ask to join), an unclaimed one goes to the claim flow,
 * and only then "Create your club's page" (whose sheet checks for look-alikes again).
 */
export function ClubStep({ leave }: StepProps) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    const userId = user?.id;
    const club = ownClub(user?.navigationCapabilities);
    const inputId = useId();
    const [town, setTown] = useState<Town>(DEFAULT_TOWN);
    const [name, setName] = useState('');
    const [near, setNear] = useState<Found[] | null>(null);
    const [matches, setMatches] = useState<{ query: string; items: Found[] } | null>(null);
    const query = name.trim();

    useEffect(() => {
        if (!userId) return;
        const controller = new AbortController();
        void (async () => {
            const saved = await fetchSavedTown(userId, controller.signal).catch(() => null);
            const around = saved ?? DEFAULT_TOWN;
            if (!controller.signal.aborted) setTown(around);
            const clubs = await fetchClubsNear(around, 4, controller.signal).catch(() => [] as NearbyClub[]);
            if (!controller.signal.aborted) setNear(clubs.map(item => ({ key: `club-${item.id}`, name: item.name, town: item.cityName ?? null, crestUrl: item.logoUrl ?? null, to: `/clubs/${item.id}`, action: 'open' })));
        })();
        return () => controller.abort();
    }, [userId]);
    useEffect(() => {
        if (query.length < 3) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetchSimilar(query, town.name, controller.signal).then(items => {
                if (controller.signal.aborted) return;
                setMatches({ query, items: items.filter(item => item.kind === 'CLUB').map(item => ({
                    key: `${item.ref.type}-${item.ref.id}`, name: item.name, town: item.town || null, crestUrl: item.crestUrl,
                    to: item.mine ? pagePath(item.ref) : item.claim === 'UNCLAIMED' ? claimHref(HOME, item.ref, 'start') : pagePath(item.ref),
                    action: item.mine ? 'mine' : item.claim === 'UNCLAIMED' ? 'claim' : 'open',
                })) });
            }).catch(() => undefined);
        }, 300);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [query, town.name]);

    if (club) return <ul className="gk-welcome__list" aria-label={copy('Your club', 'თქვენი კლუბი')}>
        <Row item={{ key: 'own', name: club.name, town: null, crestUrl: null, to: `/clubs/${club.id}`, action: 'mine' }} leave={leave} />
    </ul>;
    const searching = query.length >= 3;
    const shown = searching ? (matches?.query === query ? matches.items : null) : near;
    return <>
        <label className="gk-welcome__search" htmlFor={inputId}>
            <Search aria-hidden="true" />
            <span className="gk-visually-hidden">{copy('Club name', 'კლუბის სახელი')}</span>
            <input id={inputId} className="gk-input" value={name} maxLength={120} autoComplete="organization" placeholder={copy('Club name', 'კლუბის სახელი')} onChange={event => setName(event.target.value)} />
        </label>
        <p className="gk-welcome__label">{searching ? copy('On GrassKickZ', 'GrassKickZ-ზე') : copy(`Near ${town.name}`, `${town.name}-თან ახლოს`)}</p>
        {shown === null ? <p role="status" className="gk-welcome__note">{copy('Looking…', 'ვეძებთ…')}</p>
            : shown.length === 0 ? <p className="gk-welcome__note">{searching ? copy('No club with this name yet.', 'ამ სახელით კლუბი ჯერ არ არის.') : copy('No clubs near you yet.', 'ახლოს კლუბები ჯერ არ არის.')}</p>
            : <ul className="gk-welcome__list" aria-label={copy('Clubs', 'კლუბები')}>{shown.map(item => <Row key={item.key} item={item} leave={leave} />)}</ul>}
        <div className="gk-welcome__create">
            <span>{copy('Not here?', 'აქ არ არის?')}</span>
            <Button variant="primary" onClick={() => leave(createHref(HOME, 'CLUB', 'start'))}><Plus aria-hidden="true" />{copy('Create your club’s page', 'შექმენით კლუბის გვერდი')}</Button>
        </div>
    </>;
}

function Row({ item, leave }: { item: Found; leave: (to: string) => void }) {
    const copy = useJourneyCopy();
    const label = item.action === 'claim' ? copy('Claim it', 'ეს ჩემია') : item.action === 'mine' ? copy('Open yours', 'თქვენის გახსნა') : copy('Open', 'გახსნა');
    return <li className="gk-welcome__row">
        <Crest src={item.crestUrl} name={item.name} size={40} />
        <span className="gk-welcome__text"><strong>{item.name}</strong>{(item.town || item.action === 'claim') && <small>{[item.town, item.action === 'claim' ? copy('Unclaimed', 'დაუკავებელი') : null].filter(Boolean).join(' · ')}</small>}</span>
        <Button size="sm" variant={item.action === 'claim' ? 'primary' : 'secondary'} onClick={() => leave(item.to)}>{label}</Button>
    </li>;
}
