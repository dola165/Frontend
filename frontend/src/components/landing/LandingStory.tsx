import { visualColors } from '../../styles/visualColors';
import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Heart, MapPin, MoveUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LandingReveal } from './LandingReveal';
import { LandingParallax } from './LandingParallax';
import { LandingRoleScene } from './LandingRoleScene';
import { LandingConstellation } from './LandingConstellation';
import { LandingAtmosphere } from './LandingAtmosphere';
import { LandingLightRails } from './LandingLightField';
import { LandingFootballWeek } from './LandingFootballWeek';
import { LandingMatchday } from './LandingMatchday';
import { LandingCompetitions, LandingQuestions, LandingVolunteering } from './LandingCommunity';

const roles = [
    { id: 'player', label: 'I want to play', title: 'Your next chapter\nstarts with a club.', body: 'From your first training session to your next challenge. Discover academies, schools, and grassroots clubs, see what they’re about, and find a place that fits you.', link: 'Find your club', to: '/world', tags: ['Clubs near you', 'Age groups & teams', 'Tryouts & opportunities'] },
    { id: 'club', label: 'I run a club', title: 'Less chasing.\nMore coaching.', body: 'Bring your people, squads, and schedules together. Give your club a home where the work behind the badge stays connected to the football on the pitch.', link: 'Build your club’s home', to: '/signup', tags: ['People & squads', 'Training & matches', 'One club workspace'] },
    { id: 'supporter', label: 'I love the game', title: 'Every club has a story.\nBe part of it.', body: 'Follow the clubs that matter to you. Get closer to the people, conversations, and everyday moments that make football more than ninety minutes.', link: 'Meet the clubs', to: '/clubs', tags: ['Club updates', 'Conversations', 'Ways to get involved'] },
] as const;

export function LandingStory({ motionPaused = false, onPlay }: { motionPaused?: boolean; onPlay?: () => void }) {
    const [role, setRole] = useState(0);
    const current = roles[role];
    return <>
        <section className="landing-origin" id="the-game" aria-labelledby="landing-origin-title">
            <LandingLightRails />
            <LandingParallax className="landing-origin-image" depth={.08} disabled={motionPaused}><img src="/landing/after-the-whistle.png" width="1536" height="1024" alt="Players sharing an evening game on a neighborhood football ground under floodlights" loading="lazy" decoding="async" /></LandingParallax><div className="landing-origin-shade" /><div className="landing-floodlight" aria-hidden="true" /><span className="landing-origin-registration" aria-hidden="true">GRASSROOTS. REAL CONNECTIONS.</span>
            <div className="landing-wrap landing-origin-content"><LandingReveal><p className="landing-eyebrow">01 / The feeling we’re here for</p><h2 id="landing-origin-title">Football starts<br /><em>somewhere.</em></h2><p className="landing-origin-body">A patch of grass. A familiar face.<br />Someone saying, “Come play with us.”</p><p className="landing-origin-small">GrassKickZ helps you find that place.<br />Then connects everything that grows around it.</p></LandingReveal><div className="landing-ground-note"><span className="landing-crosshair" /><span>It was never just about the pitch.<br /><strong>It’s about finding your people.</strong></span></div></div>
            <div className="landing-origin-bottom landing-wrap"><span>From the first kick to the next chapter</span><span>Stay close to the game <ArrowDown size={14} /></span></div>
        </section>
        <div className="landing-story-nav"><div className="landing-wrap"><strong>ONE GAME. A WHOLE COMMUNITY.</strong><nav aria-label="Explore the GrassKickZ story"><a href="#landing-audiences">Your people</a><a href="#landing-week">The football week</a><a href="#landing-matchday">Matchday</a><a href="#landing-volunteer">Volunteering</a><a href="#landing-competitions">Competitions</a></nav></div></div>
        <section className="landing-belong landing-wrap" id="landing-audiences" aria-labelledby="landing-belong-title">
            <LandingLightRails variant="horizon" />
            <LandingReveal><div className="landing-section-heading"><div><p className="landing-eyebrow">02 / Find your people</p><h2 id="landing-belong-title">Different roles.<br /><em>Same love of the game.</em></h2></div><p>You don’t need to know your whole journey.<br />Just where you’d like to start.</p></div></LandingReveal>
            <LandingAtmosphere><LandingConstellation selected={role} onSelect={setRole} paused={motionPaused} /></LandingAtmosphere>
            <div className="landing-role-panel" role="tabpanel" id="landing-role-panel" aria-labelledby={`landing-role-${current.id}`}><div className="landing-role-copy" key={`copy-${current.id}`}><span className="landing-role-number">0{role + 1}</span><h3>{current.title}</h3><p>{current.body}</p><ul>{current.tags.map(tag => <li key={tag}><Check size={14} />{tag}</li>)}</ul><Link className="landing-text-link" to={current.to}>{current.link} <ArrowRight size={18} /></Link></div><LandingRoleScene role={current.id} key={`scene-${current.id}`} /></div>
        </section>
        <LandingFootballWeek />
        <LandingMatchday />
        <LandingVolunteering />
        <LandingCompetitions />
        <section className="landing-path-section" id="landing-pillars" aria-labelledby="landing-path-title"><div className="landing-wrap">
            <LandingReveal><div className="landing-section-heading"><div><p className="landing-eyebrow">07 / Make it your own</p><h2 id="landing-path-title">A small first step.<br /><em>A whole new world.</em></h2></div><Link className="landing-text-link" to="/world">Start exploring <ArrowUpRight size={18} /></Link></div></LandingReveal>
            <div className="landing-journey-grid">
                <LandingReveal className="landing-journey-card landing-discover-card"><div className="landing-contour-art" aria-hidden="true"><svg viewBox="0 0 450 230" fill="none"><path d="M-20 166 Q90 -50 206 90 T480 30 M-20 191 Q90 -25 206 115 T480 55 M-20 216 Q90 0 206 140 T480 80 M-20 241 Q90 25 206 165 T480 105 M-20 266 Q90 50 206 190 T480 130" stroke="currentColor" /><path className="landing-map-trail" d="M94 188 Q100 130 172 128 T319 64" stroke={visualColors.landingStoryPaint53} strokeWidth="3" strokeDasharray="5 6" /><circle cx="319" cy="64" r="13" fill={visualColors.landingStoryPaint53} stroke={visualColors.landingStoryPaint54} strokeWidth="5" /><circle cx="94" cy="188" r="6" fill={visualColors.landingStoryPaint53} /></svg><span className="landing-art-label"><MapPin size={13} /> Your next home ground</span></div><div className="landing-journey-copy"><span className="landing-eyebrow">Start with a place</span><h3>A world worth exploring.</h3><p>Pick your area. Find a club that fits your age, ambition, and way of playing.</p><Link to="/world" aria-label="Explore the football map"><ArrowUpRight size={21} /></Link></div></LandingReveal>
                <LandingReveal delayMs={70} className="landing-journey-card landing-connect-card"><div className="landing-connect-art" aria-hidden="true"><div className="landing-story-post"><span className="landing-mini-badge">G</span><div><strong>The moments between matches</strong><span>Your club. Your community.</span></div><Heart size={17} /></div><div className="landing-voice">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div><span className="landing-art-label">Keep the conversation going</span></div><div className="landing-journey-copy"><span className="landing-eyebrow">Stay for the people</span><h3>Closer to your club.</h3><p>Follow the updates, share the moments, and keep in touch long after the final whistle.</p><Link to="/clubs" aria-label="Meet football clubs"><ArrowUpRight size={21} /></Link></div></LandingReveal>
                <LandingReveal delayMs={140} className="landing-journey-card landing-build-card"><div className="landing-tactics-art" aria-hidden="true"><div className="landing-tactics-pitch">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div><span className="landing-art-label">Everyone moving in the same direction</span></div><div className="landing-journey-copy"><span className="landing-eyebrow">Build something together</span><h3>Behind every good team.</h3><p>People, plans, and a lot of heart. Bring the everyday work of your club into one place.</p><Link to="/signup" aria-label="Create your GrassKickZ account"><ArrowUpRight size={21} /></Link></div></LandingReveal>
            </div>
        </div></section>
        <LandingQuestions />
        {onPlay && <section className="landing-extra-time landing-wrap" aria-labelledby="landing-extra-title"><div><p className="landing-eyebrow">A little extra time?</p><h2 id="landing-extra-title">For the love<br />of the <em>game.</em></h2></div><button type="button" className="landing-kickoff" onClick={onPlay} aria-label="Open Playground"><span className="landing-kickoff-orbit" aria-hidden="true" /><span className="landing-football" aria-hidden="true">⬢</span><span className="landing-kickoff-label">Step onto the pitch <MoveUpRight size={18} /></span></button></section>}
        <section className="landing-final" aria-labelledby="landing-final-title"><LandingLightRails variant="horizon" /><div className="landing-final-pitch" aria-hidden="true"><span /></div><LandingReveal className="landing-wrap"><p className="landing-eyebrow">There’s a place for you here</p><h2 id="landing-final-title">The game’s better<br /><em>with you in it.</em></h2><p>Find a club. Meet your people. Make it yours.</p><div className="landing-final-actions"><Link className="landing-button landing-button-primary" to="/signup">Join GrassKickZ <ArrowUpRight size={18} /></Link><Link className="landing-text-link" to="/world">Take a look around <ArrowRight size={18} /></Link></div><span className="landing-final-note">Explore first. Join when it feels right.</span></LandingReveal></section>
    </>;
}
