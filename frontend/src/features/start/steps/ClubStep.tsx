import { useEffect, useState } from 'react';
import { Link2, Loader2, Plus } from 'lucide-react';
import { Button, SearchInput } from '../../../design/primitives';
import { createHref } from '../../pages/create/entry';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ClubPicker } from '../ClubPicker';
import { fetchClubsNearYou, followClubs, searchClubs, type NearbyClub } from '../startApi';
import { WelcomeFrame, type WelcomeStepProps } from '../WelcomeFrame';

const HOME = { pathname: '/home', search: '' };

/**
 * Step 2 of A club: find your club, the nearest suggested and any found by name. Found: "Your club's admin adds you
 * with the staff link", and it is followed as the person opens it. Not found: Start your club, in the one create sheet.
 * Nobody asks to join as staff here (F2: staff join through the admin's link).
 */
export function ClubStep({ land, back, close }: WelcomeStepProps) {
    const copy = useJourneyCopy();
    const [query, setQuery] = useState('');
    const [near, setNear] = useState<NearbyClub[] | null>(null);
    const [found, setFound] = useState<NearbyClub[] | null>(null);
    const [chosen, setChosen] = useState<NearbyClub | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const searching = query.trim().length >= 2;

    useEffect(() => {
        const controller = new AbortController();
        fetchClubsNearYou(5, 'NEAREST', controller.signal).then(setNear).catch(() => { if (!controller.signal.aborted) setNear([]); });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        if (!searching) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => { searchClubs(query.trim(), controller.signal).then(setFound).catch(() => { if (!controller.signal.aborted) setFound([]); }); }, 300);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [query, searching]);

    const shown = searching ? found : near;
    const open = async () => {
        if (!chosen) return;
        setBusy(true); setFailed(false);
        const missed = await followClubs([chosen]);
        setBusy(false);
        if (missed) setFailed(true); else land('club', `/clubs/${chosen.id}`);
    };
    return <WelcomeFrame position={2} onClose={close} back={back} title={copy('Find your club', 'იპოვეთ თქვენი კლუბი')}
        footer={<>
            <Button variant="ghost" onClick={() => land('club', createHref(HOME, 'CLUB', 'start'))}><Plus aria-hidden="true" />{copy('Not here? Start your club', 'არ არის? დააარსეთ თქვენი კლუბი')}</Button>
            <Button variant="primary" disabled={!chosen || busy} onClick={() => void open()}>
                {busy && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}{copy('Follow and open', 'გამოწერა და გახსნა')}
            </Button>
        </>}>
        <SearchInput aria-label={copy('Club name', 'კლუბის სახელი')} placeholder={copy('Club name', 'კლუბის სახელი')} value={query}
            onChange={event => { setQuery(event.target.value); if (event.target.value.trim().length < 2) setFound(null); }} />
        <ClubPicker single clubs={shown} chosen={new Set(chosen ? [chosen.id] : [])} label={searching ? copy('Clubs found', 'ნაპოვნი კლუბები') : copy('Clubs near you', 'კლუბები თქვენთან ახლოს')}
            onToggle={id => setChosen(shown?.find(club => club.id === id) ?? null)}
            empty={searching ? copy('No club by that name yet.', 'ასეთი სახელის კლუბი ჯერ არ არის.') : copy('No clubs near you yet. Search by name.', 'თქვენთან ახლოს კლუბები ჯერ არ არის. მოძებნეთ სახელით.')} />
        {chosen && <p className="gk-welcome__note" role="status"><Link2 aria-hidden="true" />{copy('Your club’s admin adds you with the staff link.', 'კლუბის ადმინი დაგამატებთ თანამშრომლების ბმულით.')}</p>}
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('That follow did not go through. Try again.', 'გამოწერა ვერ შესრულდა. სცადეთ ხელახლა.')}</p>}
    </WelcomeFrame>;
}
