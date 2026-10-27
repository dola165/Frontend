import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { ClubPicker } from '../ClubPicker';
import { fetchClubsForAge, fetchClubsNearYou, type NearbyClub } from '../startApi';
import { followClubs } from '../../actions/follow';
import { DEFAULT_TOWN, TOWNS, townByName } from '../towns';
import { WelcomeFrame, type WelcomeStepProps } from '../WelcomeFrame';
import { ActionButton } from '../../actions/ActionButton';

/** Adding a child from the welcome opens over Home, where the welcome has closed. */
const HOME = { pathname: '/home', search: '' };

const THIS_YEAR = new Date().getFullYear();
/** Birth years a parent can pick: children of 3 to 18. */
const YEARS = Array.from({ length: 16 }, (_, index) => THIS_YEAR - 3 - index);

/**
 * Step 2 of Play football. For me: the town (filled in) and clubs near it that fit the person's age, to follow. For my
 * child: the child's birth year and the town, clubs whose programmes take that age. Both land on World's clubs with the
 * same age and town, so the list goes on from what was shown; with none shown for that age, on the town's clubs. Only
 * the age is kept, never a child.
 */
export function PlayStep({ who, facts, land, back, close }: WelcomeStepProps & { who: 'me' | 'child' }) {
    const copy = useJourneyCopy();
    const saved = facts.place?.source === 'SAVED' ? facts.place.name : null;
    const [picked, setTown] = useState<string | null>(null);
    const town = picked ?? saved ?? DEFAULT_TOWN.name;
    const [year, setYear] = useState<number | null>(null);
    const age = who === 'me' ? facts.age : year ? THIS_YEAR - year : null;
    // Clubs for this age and town; a child's list waits for the year.
    const query = who === 'child' && age == null ? null : `${age ?? ''}|${town}`;
    const [loaded, setLoaded] = useState<{ query: string; clubs: NearbyClub[] } | null>(null);
    const clubs = query == null ? [] : loaded?.query === query ? loaded.clubs : null;
    const [chosen, setChosen] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (query == null) return;
        const controller = new AbortController();
        (age != null ? fetchClubsForAge(age, town, controller.signal) : fetchClubsNearYou(12, 'NEAREST', controller.signal))
            .then(found => { if (!controller.signal.aborted) setLoaded({ query, clubs: found }); })
            .catch(() => { if (!controller.signal.aborted) setLoaded({ query, clubs: [] }); });
        return () => controller.abort();
    }, [age, query, town]);

    const toggle = (id: number) => setChosen(current => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next; });
    // The same source as the list above (clubs for this age in this town), never an emptier one.
    const destination = useMemo(() => {
        const params = new URLSearchParams({ near: town });
        if (age != null && clubs?.length) params.set('age', String(age));
        return `/world/clubs?${params}`;
    }, [age, clubs?.length, town]);
    const finish = async () => {
        setBusy(true); setFailed(false);
        const missed = await followClubs((clubs ?? []).filter(club => chosen.has(club.id)));
        setBusy(false);
        if (missed) { setFailed(true); return; }
        const kept = picked && picked !== saved ? townByName(picked) : null;
        land(who, destination, { ...(kept ? { town: { ...kept, countryCode: 'GE' } } : {}), ...(who === 'child' && age != null ? { childAge: age } : {}) });
    };

    const yearField = who === 'child' && <label className="gk-welcome__field">
        <span>{copy('Born in', 'დაბადების წელი')}</span>
        <select className="gk-input" value={year ?? ''} onChange={event => setYear(Number(event.target.value) || null)}>
            <option value="">{copy('Pick the year', 'აირჩიეთ წელი')}</option>
            {YEARS.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
    </label>;
    return <WelcomeFrame position={2} onClose={close} back={back}
        title={who === 'me' ? copy('Clubs near you', 'კლუბები თქვენთან ახლოს') : copy('Clubs for your child', 'კლუბები თქვენი შვილისთვის')}
        hint={who === 'me' ? copy('Follow the ones you like.', 'გამოიწერეთ, რომლებიც მოგწონთ.') : copy('Clubs with a programme for that age.', 'კლუბები, რომლებსაც ამ ასაკისთვის პროგრამა აქვთ.')}
        footer={<Button variant="primary" disabled={busy} onClick={() => void finish()}>
            {busy && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}
            {who === 'me' ? copy('Show clubs near me', 'ახლომდებარე კლუბების ნახვა') : copy('Show clubs for this age', 'ამ ასაკის კლუბების ნახვა')}
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
        {who === 'child' && <ActionButton action="add_child" look="row" at={HOME} hint={copy('Their player card, for joining a squad', 'მოთამაშის ბარათი გუნდში შესასვლელად')}
            onClick={event => { event.preventDefault(); land('child', event.currentTarget.pathname + event.currentTarget.search, age != null ? { childAge: age } : {}); }} />}
        <ClubPicker clubs={clubs} chosen={chosen} onToggle={toggle} label={copy('Clubs to follow', 'გამოსაწერი კლუბები')}
            empty={who === 'child' && age == null ? copy('Pick the year to see clubs.', 'აირჩიეთ წელი, რომ კლუბები ნახოთ.') : copy('No clubs here yet. World shows more.', 'აქ კლუბები ჯერ არ არის. მეტს მსოფლიოში ნახავთ.')} />
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('Some follows did not go through. Try again.', 'ზოგი გამოწერა ვერ შესრულდა. სცადეთ ხელახლა.')}</p>}
    </WelcomeFrame>;
}
