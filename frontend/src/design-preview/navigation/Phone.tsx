import { useState } from 'react';
import { Inbox, MessageSquare, Pin, Search, Sparkles } from 'lucide-react';
import { BrandMark } from '../../components/layout/BrandMark';
import { layoutFor, type AltId, type Person, type ScreenId } from './model';
import { PinsSheet, Screen } from './Screens';

/** One clickable phone at 390 × 844: the top bar, the page, and the bottom tabs exactly as wide as a phone gives them. */
export function Phone({ alt, person, ka }: { alt: AltId; person: Person; ka: boolean }) {
    const layout = layoutFor(alt, person, ka);
    const [screen, setScreen] = useState<ScreenId>('home');
    const [sheet, setSheet] = useState(false);
    const press = (id: ScreenId, isSheet?: boolean) => { if (isSheet) setSheet(open => !open); else { setSheet(false); setScreen(id); } };
    const tabFor = (id: ScreenId) => layout.tabs.find(tab => tab.id === id);
    // The club reached from My squads keeps My squads lit; Messages from the top bar lights no tab.
    const current = tabFor(screen) ? screen : screen === 'my-club' && tabFor('my-squads') ? 'my-squads' : null;
    return (
        <div className="nav-phone" data-alt={alt}>
            <header className="nav-top">
                <span className="nav-brand"><BrandMark /></span>
                <span className="nav-top__actions">
                    <button type="button" aria-label="Search"><Search size={19} /></button>
                    <button type="button" aria-label="Agent Dola" className="nav-dola"><Sparkles size={19} /></button>
                    {layout.topPins && <button type="button" aria-label="Pins" aria-pressed={sheet} onClick={() => setSheet(open => !open)}><Pin size={19} /></button>}
                    <button type="button" aria-label="Inbox"><Inbox size={19} /><i>22</i></button>
                    {layout.topMessages && <button type="button" aria-label="Messages" aria-pressed={screen === 'messages'} onClick={() => press('messages')}><MessageSquare size={19} /><i>3</i></button>}
                    <span className="nav-avatar">{person.initials}</span>
                </span>
            </header>
            <main className="nav-screen" key={screen}><Screen id={screen} person={person} ka={ka} clubLink={layout.clubInSquads} go={press} /></main>
            {sheet && <><div className="nav-scrim" onClick={() => setSheet(false)} /><PinsSheet ka={ka} /></>}
            <nav className="nav-tabs" style={{ gridTemplateColumns: `repeat(${layout.tabs.length}, minmax(0, 1fr))` }}>
                {layout.tabs.map(tab => {
                    const on = tab.sheet ? sheet : current === tab.id && !sheet;
                    return <button key={tab.id} type="button" className="nav-tab" aria-current={on ? 'page' : undefined} onClick={() => press(tab.id, tab.sheet)}>
                        <tab.icon size={22} strokeWidth={on ? 2.1 : 1.8} /><span className="nav-tab__label">{tab.label}</span>
                        {tab.badge && <i className="nav-tab__count">{tab.badge}</i>}
                    </button>;
                })}
            </nav>
        </div>
    );
}
