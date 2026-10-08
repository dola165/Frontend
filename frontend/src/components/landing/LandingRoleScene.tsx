import { visualColors } from '../../styles/visualColors';
import { ArrowUpRight, CalendarDays, Check, Heart, MapPin, MessageCircle, Search, Shield, UsersRound } from 'lucide-react';

function PlayerScene() {
    return <div className="landing-role-scene role-scene-player" data-role-scene="player" aria-hidden="true">
        <div className="role-scene-grid" />
        <div className="role-player-map"><svg viewBox="0 0 580 365" fill="none"><rect width="580" height="365" fill={visualColors.landingRoleScenePaint43} /><path d="M0 15Q100 130 220 40T580 80V0H0ZM0 270Q60 170 130 235T265 365H0Z" fill={visualColors.landingRoleScenePaint44} /><path d="M390-10Q280 110 400 200T390 400" stroke={visualColors.landingRoleScenePaint45} strokeWidth="33" /><path d="M390-10Q280 110 400 200T390 400" stroke={visualColors.landingRoleScenePaint46} strokeWidth="26" /><path d="M-20 150 580 240M90-20 200 390M250-20 65 350M455 0 220 390M-20 60 610 350M-20 300 590 30" stroke={visualColors.landingRoleScenePaint47} strokeWidth="6" /><path d="M-20 182 580 272M120-20 230 390M280-20 95 350M-20 92 610 382" stroke={visualColors.landingRoleScenePaint47} strokeWidth="2" /><path className="role-discovery-route" d="M120 270 198 176 280 194 380 103" stroke={visualColors.landingRoleScenePaint48} strokeWidth="3" strokeDasharray="5 6" /><circle cx="120" cy="270" r="8" fill={visualColors.landingRoleScenePaint49} stroke={visualColors.landingRoleScenePaint50} strokeWidth="3" />{[[198,176],[380,103],[472,273]].map(([x,y]) => <g key={x} transform={`translate(${x} ${y})`}><circle r="17" fill={visualColors.landingRoleScenePaint51} stroke={visualColors.landingRoleScenePaint52} strokeWidth="2" /><circle r="8" fill={visualColors.landingRoleScenePaint52} /><path d="m0-6 6 4-2 7h-8l-2-7Z" fill={visualColors.landingRoleScenePaint51} /></g>)}</svg></div>
        <div className="role-player-search"><Search size={15} /><span>Your next club is out there.</span><span className="role-key">↵</span></div>
        <div className="role-player-radius"><MapPin size={13} /> Start close. Go further.</div>
        <div className="role-player-club"><div className="role-player-badge"><Shield size={29} /></div><div><span>A PLACE TO GROW</span><strong>Find your home ground.</strong><p>Academies · Schools · Grassroots</p></div><ArrowUpRight size={18} /></div>
        <div className="role-scene-caption"><span>DISCOVER</span><i /><span>VISIT</span><i /><span>BELONG</span></div>
    </div>;
}

const squad = [[9,50],[28,15],[28,38],[28,62],[28,85],[53,24],[53,50],[53,76],[82,20],[82,50],[82,80]];
function ClubScene() {
    return <div className="landing-role-scene role-scene-club" data-role-scene="club" aria-hidden="true">
        <div className="role-scene-grid" />
        <div className="role-workspace"><div className="role-workspace-header"><span className="role-workspace-mark">G</span><strong>Club workspace</strong><span className="role-workspace-status"><i /> In sync</span></div>
            <div className="role-workspace-body"><div className="role-squad"><div className="role-panel-heading"><UsersRound size={13} /> Your squad <span>4–3–3</span></div><div className="role-squad-pitch"><span className="role-pitch-center" />{squad.map(([x,y],i) => <b key={i} style={{left:`${x}%`,top:`${y}%`}}>{i+1}</b>)}</div><div className="role-squad-footer"><span>People</span><span>Positions</span><span>Possibilities</span></div></div>
            <div className="role-week"><div className="role-panel-heading"><CalendarDays size={13} /> The week ahead</div><div className="role-week-days">{['M','T','W','T','F','S','S'].map((day,i)=><span key={i} className={i===1||i===5?'has-session':''}>{day}<i /></span>)}</div><div className="role-week-event"><span>ON THE TRAINING GROUND</span><strong>Build the rhythm.</strong><small>Training · The whole squad</small></div><div className="role-week-event role-week-event-match"><span>READY FOR MATCHDAY</span><strong>Put it into play.</strong><small>Matches · One shared plan</small></div></div></div>
        </div>
        <div className="role-workspace-note"><span><Check size={18} /></span><div><strong>Less admin. More football.</strong><small>Everyone knows where they need to be.</small></div></div>
        <div className="role-scene-caption"><span>YOUR PEOPLE</span><i /><span>YOUR PLANS</span><i /><span>ONE PLACE</span></div>
    </div>;
}

function SupporterScene() {
    return <div className="landing-role-scene role-scene-supporter" data-role-scene="supporter" aria-hidden="true">
        <div className="role-scene-grid" /><div className="role-fan-backcard"><span>THE CLUB. THE PEOPLE. THE MOMENTS.</span></div>
        <div className="role-community-story"><div className="role-community-heading"><span className="role-workspace-mark">G</span><div><strong>From the touchline</strong><span>A window into your club</span></div><span className="role-follow-chip"><Check size={11} /> Following</span></div><div className="role-story-photo"><img src="/landing/after-the-whistle.png" alt="" loading="lazy" /><div><span>THE MOMENTS BETWEEN MATCHES</span><strong>More than<br /><em>matchday.</em></strong></div></div><div className="role-story-footer"><Heart size={17} /><MessageCircle size={17} /><span>Every club has a story.</span></div></div>
        <div className="role-fan-conversation"><span className="role-fan-faces"><i>G</i><i><Heart size={14}/></i><i><UsersRound size={14}/></i></span><div><strong>You’re part of it.</strong><small>Follow the story. Find your people.</small></div></div>
        <div className="role-scene-caption"><span>FOLLOW</span><i /><span>CONNECT</span><i /><span>SUPPORT</span></div>
    </div>;
}

export function LandingRoleScene({ role }: { role: 'player' | 'club' | 'supporter' }) {
    return role === 'player' ? <PlayerScene /> : role === 'club' ? <ClubScene /> : <SupporterScene />;
}
