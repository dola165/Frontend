import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, ButtonLink } from '../../../../design/primitives';
import { getAuthFlow } from '../../../../utils/authRedirect';
import { pagePath } from '../../../pages/create/entry';
import { useCreatePage } from '../../../pages/create/useCreatePage';
import type { SimilarPage } from '../../../pages/api';
import { CREST_PAIRS, crestDataUrl, defaultCrest, paint, type CrestColour } from '../../../pages/model/crest';
import { useJourneyCopy } from '../../../squadCommunication/journeyCopy';
import { DEFAULT_TOWN, TOWNS, townByName, type Town } from '../../towns';
import { WelcomeFrame, type WelcomeStepProps } from '../../WelcomeFrame';
import './club-step.css';
import type { FoundClub } from './FindClub';

const COLOUR_WORDS: Record<CrestColour, [string, string]> = {
    red: ['Red', 'წითელი'], maroon: ['Maroon', 'შინდისფერი'], orange: ['Orange', 'ნარინჯისფერი'], gold: ['Gold', 'ოქროსფერი'], yellow: ['Yellow', 'ყვითელი'],
    green: ['Green', 'მწვანე'], forest: ['Forest green', 'მუქი მწვანე'], sky: ['Sky blue', 'ცისფერი'], blue: ['Blue', 'ლურჯი'], navy: ['Navy', 'მუქი ლურჯი'],
    purple: ['Purple', 'იისფერი'], black: ['Black', 'შავი'], white: ['White', 'თეთრი'],
};

/**
 * Starting a club from the welcome, through the app's one create action: the name, the town already filled in (the
 * person's saved town, else the sign-up town) and the club's colours, drawn as its crest while they type. Start my club
 * creates it and opens its page; "Already in a club?" turns the step into a search.
 */
export function StartClub({ facts, finish, back, close, name: typed, onFind }: WelcomeStepProps & { name: string; onFind: (query: string, club?: FoundClub | null) => void }) {
    const copy = useJourneyCopy();
    const nameId = useId(), townId = useId();
    const { create, busy, error, clearError, unanswered, otherClub } = useCreatePage();
    const [name, setName] = useState(typed);
    const saved = facts.place?.source === 'SAVED' ? facts.place.name : null;
    const [picked, setPicked] = useState<string | null>(null);
    const townName = picked ?? saved ?? townByName(getAuthFlow().town)?.name ?? DEFAULT_TOWN.name;
    const place = facts.place;
    const town: Town = townByName(townName) ?? (place && place.name === townName && place.latitude != null && place.longitude != null
        ? { name: place.name, latitude: place.latitude, longitude: place.longitude } : DEFAULT_TOWN);
    const [pair, setPair] = useState<number | null>(null);
    const drawn = defaultCrest(name || '?');
    const design = pair == null ? drawn : { ...drawn, primary: CREST_PAIRS[pair][0], secondary: CREST_PAIRS[pair][1] };
    const [exists, setExists] = useState<SimilarPage | null>(null);
    const ready = name.trim().length >= 2 && !busy;

    const start = async () => {
        if (!ready) return;
        setExists(null);
        const outcome = await create({ kind: 'CLUB', name, town, crest: design });
        // Creating opened the new page already; the welcome only has to end.
        if (outcome.kind === 'created') finish('club');
        if (outcome.kind === 'exists') setExists(outcome.match);
    };
    const onKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') { event.preventDefault(); void start(); } };
    const words = (colour: CrestColour) => copy(...COLOUR_WORDS[colour]);

    return <WelcomeFrame position={2} size="choose" onClose={close} back={back} title={copy('Start your club', 'დააარსეთ თქვენი კლუბი')}
        hint={copy('Its page is ready in a minute. You can change everything later.', 'გვერდი ერთ წუთში მზად იქნება. ყველაფრის შეცვლა მოგვიანებით შეგიძლიათ.')}
        footer={<Button variant="primary" disabled={!ready} onClick={() => void start()}>
            {busy && <Loader2 className="gk-welcome__spin" aria-hidden="true" />}{copy('Start my club', 'კლუბის დაარსება')}
        </Button>}>
        <div className="gk-wclub">
            <div className="gk-wclub__crest">
                <img src={crestDataUrl(design)} alt={copy('Your crest', 'თქვენი ემბლემა')} width={132} height={132} />
                <div className="gk-wclub__colours" role="radiogroup" aria-label={copy('Club colours', 'კლუბის ფერები')}>
                    {CREST_PAIRS.map(([main, second], index) => {
                        const chosen = pair == null ? main === drawn.primary && second === drawn.secondary : pair === index;
                        return <button key={`${main}-${second}`} type="button" role="radio" aria-checked={chosen} className="gk-wclub__colour"
                            style={{ '--c1': paint(main), '--c2': paint(second) } as CSSProperties} aria-label={`${words(main)}, ${words(second)}`} title={`${words(main)}, ${words(second)}`}
                            onClick={() => setPair(index)} />;
                    })}
                </div>
            </div>
            <div className="gk-wclub__fields">
                <label className="gk-welcome__field" htmlFor={nameId}>{copy('Club name', 'კლუბის სახელი')}</label>
                <input id={nameId} className="gk-input gk-wclub__name" value={name} maxLength={120} autoComplete="organization" autoFocus placeholder={copy('e.g. Rustavi Lions', 'მაგ. რუსთავის ლომები')}
                    onChange={event => { setName(event.target.value); clearError(); setExists(null); }} onKeyDown={onKey} />
                <label className="gk-welcome__field" htmlFor={townId}>{copy('Town', 'ქალაქი')}</label>
                <select id={townId} className="gk-input" value={townName} onChange={event => setPicked(event.target.value)}>
                    {!townByName(townName) && <option value={townName}>{townName}</option>}
                    {TOWNS.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
                </select>
                {exists && <div className="gk-notice" role="status">
                    <span>{copy(`${exists.name} is already on GrassKickZ.`, `${exists.name} უკვე არის GrassKickZ-ზე.`)}</span>
                    {exists.ref.type === 'club'
                        ? <Button size="sm" onClick={() => onFind(exists.name, { id: exists.ref.id, name: exists.name, logoUrl: exists.crestUrl, cityName: exists.town })}>{copy('Join it', 'შეუერთდით')}</Button>
                        : <ButtonLink size="sm" to={pagePath(exists.ref)}>{copy('Open', 'გახსნა')}</ButtonLink>}
                </div>}
                {otherClub}
                {(error || unanswered) && <p className={`gk-notice${error ? ' gk-notice--warning' : ''}`} role="alert">
                    {error || copy('The last try was not answered. Try again with the same name; it never makes two clubs.', 'ბოლო მცდელობას პასუხი არ მოჰყოლია. სცადეთ იმავე სახელით; ორი კლუბი არ შეიქმნება.')}
                </p>}
            </div>
        </div>
        <button type="button" className="gk-welcome__quiet" onClick={() => onFind(name.trim())}>{copy('Already in a club?', 'უკვე კლუბში ხართ?')}</button>
    </WelcomeFrame>;
}
