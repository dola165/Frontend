import { useState } from 'react';
import { ArrowRight, CalendarDays, Check, CheckCheck, MessageCircle, Shield, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LandingReveal } from './LandingReveal';
import { LandingLightRails } from './LandingLightField';

const perspectives = [
    { id: 'family', label: 'Players & families', title: 'Their football world.\nA little closer to yours.', body: 'Once your academy links your family, Parent Hub brings your child’s squads, coach updates, and upcoming sessions into view. Reply to attendance, acknowledge important news, and reach the coaching team from one place.', items: ['A home for each child’s football', 'Training and match attendance replies', 'Private conversations with the coaching team'], cta: 'Find your family’s club', to: '/clubs', icon: UsersRound },
    { id: 'coach', label: 'Coaches', title: 'Know who’s coming.\nKeep everyone in the loop.', body: 'Your squad is where the week comes together. Plan training, share instructions, see who has replied, and follow up on the updates that matter. Spend less time finding the conversation and more time with your team.', items: ['Squad sessions and attendance responses', 'Updates with clear acknowledgements', 'Team discussion and family conversations'], cta: 'Explore coaching opportunities', to: '/roles', icon: CalendarDays },
    { id: 'club', label: 'Club leadership', title: 'Behind the badge.\nOn top of the details.', body: 'Build the structure that lets your academy grow: player cards, guardian consent, staff appointments, squads, and recruitment. Give families a clear picture of your programmes, age groups, and published prices.', items: ['People, permissions, and player records', 'Tryouts, applications, and squad placement', 'Public programmes, sponsors, and academy links'], cta: 'Build your club’s home', to: '/signup', icon: Shield },
] as const;

export function LandingFootballWeek() {
    const [selected, setSelected] = useState(0);
    const current = perspectives[selected];
    return <section className="landing-week landing-chapter" id="landing-week" aria-labelledby="landing-week-title"><LandingLightRails variant="horizon" /><div className="landing-wrap">
        <LandingReveal><div className="landing-section-heading"><div><p className="landing-eyebrow">03 / The football week</p><h2 id="landing-week-title">Less keeping up.<br /><em>More showing up.</em></h2></div><p>From the academy office to the touchline.<br />The right people. The same picture.</p></div></LandingReveal>
        <div className="week-perspectives" role="tablist" aria-label="Explore the football week">{perspectives.map(({ id, label, icon: Icon }, index) => <button key={id} type="button" role="tab" id={`week-tab-${id}`} aria-controls="week-panel" aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % perspectives.length : event.key === 'ArrowLeft' ? (index + perspectives.length - 1) % perspectives.length : event.key === 'Home' ? 0 : event.key === 'End' ? perspectives.length - 1 : null;
            if (next !== null) { event.preventDefault(); setSelected(next); document.getElementById(`week-tab-${perspectives[next].id}`)?.focus(); }
        }}><Icon size={17} />{label}</button>)}</div>
        <div className="week-panel" id="week-panel" role="tabpanel" aria-labelledby={`week-tab-${current.id}`}>
            <div className="landing-chapter-copy" key={current.id}><h3>{current.title}</h3><p>{current.body}</p><ul className="landing-feature-list">{current.items.map(item => <li key={item}><Check size={14} />{item}</li>)}</ul><Link className="landing-text-link" to={current.to}>{current.cta} <ArrowRight size={17} /></Link></div>
            <div className="week-visual" data-perspective={current.id} aria-hidden="true">
                <div className="week-orbit" />
                <div className="week-board"><div className="week-board-head"><span className="week-board-mark"><current.icon size={18} /></span><span>{selected === 0 ? 'Parent Hub' : selected === 1 ? 'Your squad' : 'Club workspace'}</span><span className="week-board-dot" /></div>
                    <div className="week-days">{['M','T','W','T','F','S','S'].map((day,index) => <span className={index === 2 || index === 5 ? 'has-football' : ''} key={index}>{day}<i /></span>)}</div>
                    <div className="week-event"><span>WED<strong>18:30</strong></span><div><small>U12 · ON THE TRAINING GROUND</small><strong>Time to put the work in.</strong><p>Training · Your squad</p></div><Check size={18} /></div>
                    <div className="week-event week-event-match"><span>SAT<strong>10:00</strong></span><div><small>THE WEEKEND STARTS HERE</small><strong>Matchday, together.</strong><p>Friendly · Home ground</p></div><CalendarDays size={18} /></div>
                    <div className="week-board-foot"><span><UsersRound size={13} />{selected === 0 ? 'Your child. Their team.' : selected === 1 ? 'Your people. Your plan.' : 'One academy. Connected.'}</span><span>THE WEEK AHEAD</span></div>
                </div>
                <div className="week-message"><span><MessageCircle size={17} /></span><div><small>FROM THE COACHING TEAM</small><strong>{selected === 0 ? 'Everything you need for Saturday.' : selected === 1 ? 'The whole team, in the loop.' : 'Good communication starts here.'}</strong><p><CheckCheck size={13} /> Important updates. Clear replies.</p></div></div>
                <div className="week-reply"><Check size={14} /><span>{selected === 0 ? 'Attendance reply sent' : selected === 1 ? 'See who has acknowledged' : 'The right people, connected'}</span></div>
                <span className="landing-illustration-caption">A FOOTBALL WEEK, ILLUSTRATED</span>
            </div>
        </div>
    </div></section>;
}
