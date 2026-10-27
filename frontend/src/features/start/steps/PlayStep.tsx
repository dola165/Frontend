import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { refreshAccess } from '../../../hooks/useCan';
import { AddChild } from '../../parents/AddChild';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ClubPicker } from '../ClubPicker';
import { fetchClubsForAge, fetchClubsNearYou, type NearbyClub } from '../startApi';
import { followClubs } from '../../actions/follow';
import { DEFAULT_TOWN, TOWNS, townByName } from '../towns';
import { WelcomeFrame, type WelcomeStepProps } from '../WelcomeFrame';

const THIS_YEAR = new Date().getFullYear();
/** Birth years a parent can pick: children of 3 to 18. */
const YEARS = Array.from({ length: 16 }, (_, index) => THIS_YEAR - 3 - index);

/**
 * Step 2 of Play football, where the answer is shown and acted on (owner, 27 October): nobody is dropped on a page
 * they don't know yet. For me: the town (filled in) and the clubs near it that fit the person's age, each with its
 * programme for that age; a heart follows, then Home. For my child: the birth year and the town, the clubs with a
 * programme for that age, then "Add your child" (the existing add-child form, the year already given) and Parent Hub
 * with the child chosen (`part=add` in the address); skipping it lands on Home. Only the age is kept until a child is added.
 */
export function PlayStep({ who, facts, land, back, close, part, openPart }: WelcomeStepProps & { who: 'me' | 'child' }) {
    const copy = useJourneyCopy();
    const saved = facts.place?.source === 'SAVED' ? facts.place.name : null;
    const [picked, setTown] = useState<string | null>(null);
    const town = picked ?? saved ?? DEFAULT_TOWN.name;
    const [year, setYear] = useState<number | null>(null);
    const age = who === 'me' ? facts.age : year ? THIS_YEAR - year : null;
    // Clubs for this age and town; a child's list waits for the year.
    const query = who === 'child' && age == null ? null : `${age ?? ''}|${town}`;
    // `nearest`: no club lists a programme for this age, so the nearest clubs are shown instead, and it says so.
    const [loaded, setLoaded] = useState<{ query: string; clubs: NearbyClub[]; nearest: boolean } | null>(null);
    const clubs = query == null ? [] : loaded?.query === query ? loaded.clubs : null;
    const [chosen, setChosen] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    // Add your child is a screen of its own in the address (`part=add`), so Back returns to the clubs.
    const adding = who === 'child' && part === 'add';

    useEffect(() => {
        if (query == null) return;
        const controller = new AbortController();
        const nearest = () => fetchClubsNearYou(12, 'NEAREST', controller.signal).then(clubs => ({ clubs, nearest: true }));
        (age != null ? fetchClubsForAge(age, town, controller.signal).then(clubs => (clubs.length ? { clubs, nearest: false } : nearest())) : nearest())
            .then(found => { if (!controller.signal.aborted) setLoaded({ query, ...found }); })
            .catch(() => { if (!controller.signal.aborted) setLoaded({ query, clubs: [], nearest: false }); });
        return () => controller.abort();
    }, [age, query, town]);

    const toggle = (id: number) => setChosen(current => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next; });
    const kept = picked && picked !== saved ? townByName(picked) : null;
    const extra = { ...(kept ? { town: { ...kept, countryCode: 'GE' } } : {}), ...(who === 'child' && age != null ? { childAge: age } : {}) };
    /** Follows the hearted clubs, then lands on `to` (Home when null), or for a child goes on to adding them. */
    const finish = async (to: string | null) => {
        setBusy(true); setFailed(false);
        const missed = await followClubs((clubs ?? []).filter(club => chosen.has(club.id)));
        setBusy(false);
        if (missed) { setFailed(true); return; }
        if (who === 'child' && !to) openPart('add'); else land(who, to, extra);
    };

    if (adding) return <WelcomeFrame position={2} size="choose" onClose={() => land('child', null, extra)} back={() => openPart(null)}
        title={copy('Add your child', 'დაამატეთ თქვენი შვილი')} hint={copy('Their private player card, for joining a squad.', 'მისი პირადი მოთამაშის ბარათი, გუნდში შესასვლელად.')}
        footer={<Button variant="ghost" onClick={() => land('child', null, extra)}>{copy('Not now', 'ახლა არა')}</Button>}>
        <AddChild inline birthYear={year} onCreated={childId => { refreshAccess(); land('child', `/parent?player=${childId}`, extra); }} />
    </WelcomeFrame>;

    const following = chosen.size > 0;
    const yearField = who === 'child' && <label className="gk-welcome__field">
        <span>{copy('Born in', 'დაბადების წელი')}</span>
        <select className="gk-input" value={year ?? ''} onChange={event => setYear(Number(event.target.value) || null)}>
            <option value="">{copy('Pick the year', 'აირჩიეთ წელი')}</option>
            {YEARS.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
    </label>;
    return <WelcomeFrame position={2} onClose={close} back={back}
        title={who === 'me' ? copy('Clubs near you', 'კლუბები თქვენთან ახლოს') : copy('Clubs for your child', 'კლუბები თქვენი შვილისთვის')}
        hint={who === 'me' ? copy('Tap the heart on the ones you like.', 'მონიშნეთ გული, რომლებიც მოგწონთ.') : copy('Clubs with a programme for that age.', 'კლუბები, რომლებსაც ამ ასაკისთვის პროგრამა აქვთ.')}
        footer={<Button variant="primary" disabled={busy || (who === 'child' && age == null)} onClick={() => void finish(null)}>
            {busy && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}
            {who === 'me' ? (following ? copy('Follow and finish', 'გამოწერა და დასრულება') : copy('Finish', 'დასრულება'))
                : (following ? copy('Follow and continue', 'გამოწერა და გაგრძელება') : copy('Continue', 'გაგრძელება'))}
        </Button>}>
        <div className="gk-welcome__fields">
            {yearField}
            <label className="gk-welcome__field">
                <span>{copy('Town', 'ქალაქი')}</span>
                <select className="gk-input" value={town} onChange={event => setTown(event.target.value)}>
                    {!townByName(town) && <option value={town}>{town}</option>}
                    {TOWNS.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
                </select>
            </label>
        </div>
        {loaded?.query === query && loaded.nearest && age != null && clubs?.length ? <p className="gk-welcome__hint">{copy('None list a group for this age yet. These are the nearest.', 'ამ ასაკის ჯგუფი ჯერ არცერთს არ აქვს. ეს უახლოესებია.')}</p> : null}
        <ClubPicker clubs={clubs} chosen={chosen} onToggle={toggle} label={copy('Clubs to follow', 'გამოსაწერი კლუბები')}
            empty={who === 'child' && age == null ? copy('Pick the year to see clubs.', 'აირჩიეთ წელი, რომ კლუბები ნახოთ.') : copy('No clubs here yet. Try another town.', 'აქ კლუბები ჯერ არ არის. სცადეთ სხვა ქალაქი.')} />
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('Some follows did not go through. Try again.', 'ზოგი გამოწერა ვერ შესრულდა. სცადეთ ხელახლა.')}</p>}
        <button type="button" className="gk-welcome__quiet" disabled={busy} onClick={() => void finish(`/world/map?near=${encodeURIComponent(town)}`)}>{copy('See all on the map', 'ყველას ნახვა რუკაზე')}</button>
    </WelcomeFrame>;
}
