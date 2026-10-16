import { useState } from 'react';
import { CalendarDays, ChevronRight, Cone, MapPin, Plus, Search, Settings, Shield, Store } from 'lucide-react';
import { crestPalette as paint } from '../../styles/visualColors';
import { PINS, type Child, type Club, type Person, type ScreenId } from './model';

const copy = (ka: boolean) => (en: string, georgian: string) => ka ? georgian : en;
const Crest = ({ club }: { club: Pick<Club, 'short' | 'tone'> }) => <span className="nav-crest" style={{ background: club.tone }}>{club.short}</span>;
const Face = ({ child, size = 32 }: { child: Child; size?: number }) => <span className="nav-face" style={{ background: child.tone, width: size, height: size }}>{child.name[0]}</span>;
const clubOf = (person: Person, name: string) => person.clubs.find(club => club.name === name) ?? { short: '?', tone: paint.navy };

/** A squad as the coach sees it: crest, name, the next session. */
function SquadRow({ person, squad, ka }: { person: Person; squad: Person['squads'][number]; ka: boolean }) {
    const t = copy(ka);
    return <div className="nav-row"><Crest club={clubOf(person, squad.club)} /><span><strong>{squad.name}</strong><small><Cone size={11} /> {t('Training · Tue 18:00', 'ვარჯიში · სამ 18:00')}</small></span><ChevronRight size={14} /></div>;
}
function ChildRow({ child, ka }: { child: Child; ka: boolean }) {
    const t = copy(ka);
    return <div className="nav-row"><Face child={child} /><span><strong>{child.name}, {child.age}</strong><small>{child.club ? <><CalendarDays size={11} /> {t('Training · Wed 17:00', 'ვარჯიში · ოთხ 17:00')}</> : t('No club yet', 'კლუბი ჯერ არ არის')}</small></span><ChevronRight size={14} /></div>;
}
function NoClub({ ka }: { ka: boolean }) {
    const t = copy(ka);
    return <div className="nav-tiles"><div className="nav-tile"><Search size={18} />{t('Find your club', 'იპოვეთ კლუბი')}</div><div className="nav-tile"><Plus size={18} />{t('Start your club', 'შექმენით კლუბი')}</div></div>;
}
function ClubPage({ club, ka }: { club: Club; ka: boolean }) {
    const t = copy(ka);
    return <><div className="nav-cover" style={{ background: `linear-gradient(135deg, ${club.tone}, ${paint.forest})` }} /><div className="nav-clubhead"><Crest club={club} /><strong>{club.name}</strong></div><div className="nav-chips"><span>{t('Posts', 'პოსტები')}</span><span>{t('Teams', 'გუნდები')}</span><span>{t('About', 'შესახებ')}</span></div><div className="nav-post" /></>;
}

/** The squads, grouped by club when there are several; with the club one tap away where the layout says so. */
function MySquads({ person, ka, clubLink, onClub }: { person: Person; ka: boolean; clubLink: boolean; onClub: () => void }) {
    const clubs = [...new Set(person.squads.map(squad => squad.club))];
    return <>{clubs.map(name => <section key={name} className="nav-group">
        {(clubs.length > 1 || clubLink) && <button type="button" className="nav-grouphead" onClick={onClub} disabled={!clubLink}><Crest club={clubOf(person, name)} /><span>{name}</span>{clubLink && <ChevronRight size={13} />}</button>}
        {person.squads.filter(squad => squad.club === name).map(squad => <SquadRow key={squad.id} person={person} squad={squad} ka={ka} />)}
    </section>)}</>;
}

/** Alternative B: one place for everything the person looks after, switched by faces and crests at the top. */
function MyFootball({ person, ka }: { person: Person; ka: boolean }) {
    const t = copy(ka);
    const choices = [
        ...(person.squads.length ? [{ id: 'squads', label: t('My squads', 'ჩემი გუნდები'), mark: <span className="nav-mark"><Cone size={14} /></span> }] : []),
        ...person.children.map(child => ({ id: child.id, label: child.name, mark: <Face child={child} size={22} /> })),
        ...person.clubs.map(club => ({ id: club.id, label: club.short, mark: <Crest club={club} /> })),
    ];
    const [chosen, setChosen] = useState(choices[0]?.id);
    if (!choices.length) return <><h2 className="nav-title">{t('My football', 'ჩემი ფეხბურთი')}</h2><NoClub ka={ka} /></>;
    const child = person.children.find(item => item.id === chosen), club = person.clubs.find(item => item.id === chosen);
    return <>
        <div className="nav-switch" role="tablist">{choices.map(choice => <button key={choice.id} type="button" role="tab" aria-selected={choice.id === chosen} onClick={() => setChosen(choice.id)}>{choice.mark}<span>{choice.label}</span></button>)}</div>
        {chosen === 'squads' ? <MySquads person={person} ka={ka} clubLink={false} onClub={() => undefined} />
            : child ? <><ChildRow child={child} ka={ka} /><div className="nav-week">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <span key={i} data-on={i === 2 || i === 5 || undefined}>{day}</span>)}</div></>
                : club ? <ClubPage club={club} ka={ka} /> : null}
    </>;
}

export function Screen({ id, person, ka, clubLink, go }: { id: ScreenId; person: Person; ka: boolean; clubLink: boolean; go: (id: ScreenId) => void }) {
    const t = copy(ka);
    switch (id) {
        case 'home': return <><div className="nav-composer">{t('Share an update…', 'გააზიარეთ სიახლე…')}</div>{['FC Dinamo Tbilisi Academy', 'Koba Gelashvili'].map((name, i) => <article key={name} className="nav-feedpost"><div className="nav-row nav-row--quiet"><span className="nav-face" style={{ background: i ? paint.purple : paint.blue }}>{name[0]}</span><span><strong>{name}</strong><small>{t('2 hours ago', '2 საათის წინ')}</small></span></div><p>{i ? t('Great session with the U14s tonight.', 'კარგი ვარჯიში იყო დღეს.') : t('U16 Boys finished the week with a sharp possession session.', 'U16-მა კვირა კარგი ვარჯიშით დაასრულა.')}</p><div className={i ? 'nav-post nav-post--short' : 'nav-post'} /></article>)}</>;
        case 'world': return <><div className="nav-map"><MapPin size={18} style={{ left: '30%', top: '40%' }} /><MapPin size={18} style={{ left: '62%', top: '28%' }} /><MapPin size={18} style={{ left: '48%', top: '66%' }} /></div><div className="nav-chips"><span>{t('Clubs', 'კლუბები')}</span><span>{t('Matches', 'მატჩები')}</span><span>{t('Trials', 'სინჯები')}</span></div></>;
        case 'my-squads': return <><h2 className="nav-title">{t('My squads', 'ჩემი გუნდები')}</h2><MySquads person={person} ka={ka} clubLink={clubLink} onClub={() => go('my-club')} /></>;
        case 'my-club': return person.clubs[0] ? <ClubPage club={person.clubs[0]} ka={ka} /> : <><h2 className="nav-title">{t('My Club', 'ჩემი კლუბი')}</h2><NoClub ka={ka} /></>;
        case 'parent': return <><h2 className="nav-title">{t('Parent Hub', 'მშობლის სივრცე')}</h2><div className="nav-faces">{person.children.map(child => <Face key={child.id} child={child} size={40} />)}</div>{person.children.map(child => <ChildRow key={child.id} child={child} ka={ka} />)}</>;
        case 'my-football': return <MyFootball person={person} ka={ka} />;
        case 'messages': return <><h2 className="nav-title">{t('Messages', 'მიმოწერა')}</h2>{['Koba Gelashvili', 'Nino Lomidze', 'Davit Arveladze', 'U14 Boys coaching staff'].map((name, i) => <div className="nav-row" key={name}><span className="nav-face" style={{ background: [paint.purple, paint.maroon, paint.blue, paint.green][i] }}>{name[0]}</span><span><strong>{name}</strong><small>{t('See you at training', 'ვარჯიშზე შევხვდებით')}</small></span></div>)}</>;
        case 'you': return <><div className="nav-row"><span className="nav-face" style={{ background: paint.purple, width: 40, height: 40 }}>{person.initials}</span><span><strong>{person.name}</strong><small>{t('Your profile', 'თქვენი პროფილი')}</small></span></div>
            <h3 className="nav-subtitle">{t('Pinned', 'მიმაგრებული')}</h3>{PINS(ka).map(pin => <div className="nav-row nav-row--quiet" key={pin}><Store size={14} /><span><strong>{pin}</strong></span></div>)}
            <h3 className="nav-subtitle">{t('Your club', 'თქვენი კლუბი')}</h3>{person.clubs.length ? person.clubs.map(club => <button type="button" className="nav-row nav-row--quiet" key={club.id} onClick={() => go('my-club')}><Crest club={club} /><span><strong>{club.name}</strong></span><ChevronRight size={14} /></button>) : <div className="nav-row nav-row--quiet"><Shield size={14} /><span><strong>{t('Find your club', 'იპოვეთ კლუბი')}</strong></span></div>}
            <div className="nav-row nav-row--quiet"><Settings size={14} /><span><strong>{t('Settings', 'პარამეტრები')}</strong></span></div></>;
        default: return null;
    }
}

export function PinsSheet({ ka }: { ka: boolean }) {
    const t = copy(ka);
    return <div className="nav-sheet"><strong>{t('Your pins', 'თქვენი პინები')}</strong>{PINS(ka).map(pin => <div className="nav-row nav-row--quiet" key={pin}><Store size={14} /><span><strong>{pin}</strong></span></div>)}<div className="nav-row nav-row--quiet"><Plus size={14} /><span><strong>{t('Pin this page', 'ამ გვერდის მიმაგრება')}</strong></span></div></div>;
}
