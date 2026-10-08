import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Flag, Heart, HeartHandshake, Megaphone, Shirt, Trophy, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LandingReveal } from './LandingReveal';
import { LandingLightRails } from './LandingLightField';

const volunteerWays = [
    { title: 'Coach & mentor', detail: 'Pass on your experience. Find volunteer coaching openings and help the next generation enjoy the game.', icon: UsersRound },
    { title: 'Make matchday happen', detail: 'Be the welcoming face, the extra pair of hands, or the official who gives their time. Help a club turn plans into a day to remember.', icon: Flag },
    { title: 'Keep a club moving', detail: 'Bring your skills behind the scenes. Explore club support roles, read what’s needed, and follow the application or contact route in each opening.', icon: HeartHandshake },
] as const;

export function LandingVolunteering() {
    const [selected,setSelected] = useState(0);
    const current = volunteerWays[selected];
    return <section className="landing-volunteer landing-chapter" id="landing-volunteer" aria-labelledby="landing-volunteer-title"><LandingLightRails variant="orbit" /><div className="landing-wrap">
        <LandingReveal><p className="landing-eyebrow">05 / Give something back</p><h2 id="landing-volunteer-title">Your time can change<br /><em>someone’s game.</em></h2></LandingReveal>
        <div className="volunteer-grid"><div className="volunteer-intro"><p>Someone laid out the cones. Someone welcomed a new family. Someone stayed after the final whistle.</p><p>Football grows because people show up for each other. Whether you have coaching experience, practical skills, or simply the heart to help, there’s a way to get involved.</p><Link className="landing-button" to="/roles?engagement=VOLUNTEER">Find a way to give back <ArrowUpRight size={17}/></Link><span>Small contributions. A lasting place in the community.</span></div>
            <div className="volunteer-interactive"><div className="volunteer-orbit" aria-hidden="true"><span className="volunteer-ring"/><span className="volunteer-ring second"/><span className="volunteer-core"><Heart size={43} strokeWidth={1}/></span>{volunteerWays.map(({icon:Icon},index)=><span className={`volunteer-satellite satellite-${index} ${selected===index?'is-selected':''}`} key={index}><Icon size={24}/></span>)}</div><div className="volunteer-selector" role="group" aria-label="Ways to volunteer">{volunteerWays.map(({title},index)=><button key={title} type="button" aria-pressed={selected===index} aria-controls="volunteer-way" onClick={()=>setSelected(index)}>{title}</button>)}</div><div className="volunteer-way" id="volunteer-way" aria-live="polite"><strong>{current.title}</strong><p>{current.detail}</p></div></div>
        </div>
    </div></section>;
}

export function LandingCompetitions() {
    const [format,setFormat] = useState<'groups'|'knockout'>('knockout');
    return <section className="landing-competitions landing-chapter" id="landing-competitions" aria-labelledby="landing-competitions-title"><LandingLightRails variant="horizon" /><div className="landing-wrap">
        <div className="competition-grid"><LandingReveal className="landing-chapter-copy"><p className="landing-eyebrow">06 / Something to play for</p><h2 id="landing-competitions-title">From the first entry<br /><em>to the final whistle.</em></h2><p>Give your competition a home. Bring club, squad, and guest-team entries together, set your stages and fixtures, and carry results through the draw, standings, and next round.</p><p>For organizers, a clearer view of the competition. For clubs and supporters, a story worth following.</p><Link className="landing-text-link" to="/tournaments">Explore tournaments <ArrowUpRight size={18}/></Link></LandingReveal>
            <div className="competition-visual"><div className="competition-format" role="group" aria-label="Preview competition formats"><button type="button" aria-pressed={format==='knockout'} onClick={()=>setFormat('knockout')}>Knockout</button><button type="button" aria-pressed={format==='groups'} onClick={()=>setFormat('groups')}>Group stage</button></div><div className="competition-example" aria-live="polite" aria-label={`${format==='knockout'?'Knockout bracket':'Group standings'} illustration`}>
                {format==='knockout'?<div className="competition-bracket"><div className="bracket-round"><small>SEMI-FINALS</small>{[0,1].map((n)=><div className="bracket-fixture" key={n}><span><i className={`bracket-badge badge-${n*2}`}/>Squad {n===0?'A':'C'} <b>{n===0?'2':'0'}</b></span><span><i className={`bracket-badge badge-${n*2+1}`}/>Squad {n===0?'B':'D'} <b>1</b></span></div>)}</div><div className="bracket-connector"/><div className="bracket-round bracket-final"><small>THE FINAL</small><Trophy size={32} strokeWidth={1}/><div className="bracket-fixture"><span><i className="bracket-badge badge-0"/>Squad A <b>—</b></span><span><i className="bracket-badge badge-3"/>Squad D <b>—</b></span></div></div></div>:<div className="competition-table"><div className="competition-table-head"><span>GROUP A</span><span>P</span><span>GD</span><span>PTS</span></div>{['A','B','C','D'].map((team,index)=><div key={team}><span><i className={`bracket-badge badge-${index}`}/><strong>Squad {team}</strong></span><span>3</span><span>{[4,1,-1,-4][index]}</span><b>{[7,5,3,1][index]}</b></div>)}</div>}
            </div><span className="landing-illustration-caption">A COMPETITION, ILLUSTRATED</span></div></div>
        <div className="community-links"><Link to="/roles"><UsersRound size={20}/><span><strong>Find your next opportunity.</strong><small>Coaching, playing, paid work, and ways to help.</small></span><ArrowUpRight size={17}/></Link><Link to="/campaigns"><Megaphone size={20}/><span><strong>Get behind a club’s ambition.</strong><small>Read the stories. Follow campaigns. Spread the word.</small></span><ArrowUpRight size={17}/></Link><Link to="/store"><Shirt size={20}/><span><strong>Wear your connection.</strong><small>Explore club merchandise and discover what’s available.</small></span><ArrowUpRight size={17}/></Link></div>
    </div></section>;
}

const questions = [
    ['Is GrassKickZ just for players?', 'Football needs a whole community. Players, parents, coaches, club leaders, referees, venue operators, organizers, volunteers, and supporters all have a place here. Start with the part of the game that matters to you.'],
    ['Can I be involved in more than one way?', 'Yes. Your account can carry several football roles. Your club appointment, squad, family connection, or accepted match invitation gives you access to the relevant work and conversations.'],
    ['How does my family get connected?', 'Your academy establishes your child’s player record and invites the appropriate guardian to give consent. Once that relationship and squad placement are in place, Parent Hub helps you follow their football week.'],
    ['Do I need to join before exploring?', 'You can explore public clubs, the football map, stadiums, competitions, and opportunities first. Create an account when you’re ready to participate, follow your community, or use your football workspace.'],
    ['How do I volunteer?', 'Browse volunteer openings and read what the club needs. Some roles take an application; others ask you to contact the club directly. Referees can also indicate that they are open to volunteer appointments.'],
] as const;

export function LandingQuestions() {
    return <section className="landing-questions landing-wrap" aria-labelledby="landing-questions-title"><div><p className="landing-eyebrow">A few things worth knowing</p><h2 id="landing-questions-title">Find your feet.<br /><em>Then find your people.</em></h2><Link className="landing-text-link" to="/signup">Make yourself at home <ArrowRight size={17}/></Link></div><div className="landing-question-list">{questions.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>;
}
