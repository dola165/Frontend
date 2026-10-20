import { useEffect, useId, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../design/primitives';
import { fetchSimilar } from '../../pages/api';
import { claimHref, createHref, ownClub, pagePath } from '../../pages/create/entry';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { WelcomeFacts } from '../useWelcomeFacts';
import type { StepProps } from '../WelcomeDialog';
import { ClubCard, type CardClub } from './ClubCard';

const HOME = { pathname: '/home', search: '' };
interface Found { key: string; club: CardClub; to: string; action: 'open' | 'mine' | 'claim' }

/**
 * Coach or club staff: find the club first, so nobody makes a second page of it. The clubs near the person (their own
 * country) show at once; typing searches every page, here or abroad. A known club opens (to ask to join), an unclaimed
 * one goes to the claim flow, and an adult can still create the club's page (its sheet checks for look-alikes again).
 */
export function ClubStep({ leave, facts }: StepProps & { facts: WelcomeFacts }) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    const club = ownClub(user?.navigationCapabilities);
    const inputId = useId();
    const [name, setName] = useState('');
    const [matches, setMatches] = useState<{ query: string; items: Found[] } | null>(null);
    const query = name.trim();

    useEffect(() => {
        if (query.length < 3) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetchSimilar(query, null, controller.signal).then(items => {
                if (controller.signal.aborted) return;
                setMatches({ query, items: items.filter(item => item.kind === 'CLUB').map(item => ({
                    key: `${item.ref.type}-${item.ref.id}`,
                    club: { name: item.name, logoUrl: item.crestUrl, cityName: item.town || null, note: item.claim === 'UNCLAIMED' ? copy('Unclaimed', 'დაუკავებელი') : null },
                    to: item.mine ? pagePath(item.ref) : item.claim === 'UNCLAIMED' ? claimHref(HOME, item.ref, 'start') : pagePath(item.ref),
                    action: item.mine ? 'mine' : item.claim === 'UNCLAIMED' ? 'claim' : 'open',
                })) });
            }).catch(() => undefined);
        }, 300);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [query, copy]);

    const label = (action: Found['action']) => action === 'claim' ? copy('Claim it', 'ეს ჩემია') : action === 'mine' ? copy('Open yours', 'თქვენის გახსნა') : copy('Open', 'გახსნა');
    if (club) return <ul className="gk-welcome__cards" aria-label={copy('Your club', 'თქვენი კლუბი')}>
        <ClubCard club={{ name: club.name, logoUrl: null }} index={0} action={<Button variant="primary" onClick={() => leave(`/clubs/${club.id}`)}>{label('mine')}</Button>} />
    </ul>;

    const searching = query.length >= 3;
    const near: Found[] = (facts.clubs ?? []).map(item => ({ key: `club-${item.id}`, club: item, to: `/clubs/${item.id}`, action: 'open' }));
    const shown = searching ? (matches?.query === query ? matches.items : null) : near;
    return <>
        <div className="gk-welcome__bar">
            <label className="gk-welcome__search" htmlFor={inputId}>
                <Search aria-hidden="true" />
                <span className="gk-visually-hidden">{copy('Club name', 'კლუბის სახელი')}</span>
                <input id={inputId} className="gk-input" value={name} maxLength={120} autoComplete="organization" placeholder={copy('Search every club by name', 'მოძებნეთ ნებისმიერი კლუბი სახელით')} onChange={event => setName(event.target.value)} />
            </label>
            {facts.adult && <Button variant="primary" onClick={() => leave(createHref(HOME, 'CLUB', 'start'))}><Plus aria-hidden="true" />{copy('Create your club’s page', 'შექმენით კლუბის გვერდი')}</Button>}
        </div>
        {shown === null ? <p role="status" className="gk-welcome__note">{copy('Looking…', 'ვეძებთ…')}</p>
            : shown.length === 0 ? (searching ? <p className="gk-welcome__note">{copy('No club with this name yet.', 'ამ სახელით კლუბი ჯერ არ არის.')}</p> : null)
            : <ul className="gk-welcome__cards" aria-label={searching ? copy('Clubs found', 'ნაპოვნი კლუბები') : copy('Clubs near you', 'კლუბები თქვენთან ახლოს')}>
                {shown.map((item, index) => <ClubCard key={item.key} club={item.club} index={index}
                    action={<Button variant={item.action === 'claim' ? 'primary' : 'secondary'} onClick={() => leave(item.to)}>{label(item.action)}</Button>} />)}
            </ul>}
    </>;
}
