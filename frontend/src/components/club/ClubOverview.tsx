import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarDays, Flag, Globe2, GraduationCap, LayoutGrid, LockKeyhole, MapPin, Shirt, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import { connectedWorkspaces } from '../layout/connectedWorkspaces';
import { accessibleClubs } from '../layout/clubAccess';
import { ClubFamilyBriefing } from './ClubFamilyBriefing';
import { MediaImage } from '../ui/MediaImage';
import { ClubSponsors } from './ClubPresentation';
import { ClubOpportunitySpotlight, ClubOpportunityRail } from './ClubOpportunitySpotlight';
import {useClubOpportunityPreview} from './useClubOpportunityPreview';
import { useOverviewSource } from '../../features/clubs/useOverviewSource';
import { overviewFixtures, overviewLead, overviewProgrammes } from '../../features/clubs/overviewPolicy';
import { money, programmeAge, programmePrice, safePublicUrl, type TrainingProgramme } from '../../features/clubs/presentation';
import { staffTitle, trainingPath, type PublicSquad, type PublicStaff } from '../../features/clubs/publicJourney';
import type { PublicFacility } from '../../features/clubs/ClubPlaceCard';
import type { ScheduleEventOccurrence } from '../../features/schedule/api';
import { ClubUpdates } from './ClubUpdates';
import { formatDate } from '../../utils/formatting';
import './club-overview.css';

type Entry = { canOpenWorkspace?: boolean; canManageStaff?: boolean; invitationOnly?: boolean };
type Source = { loading: boolean; failed: boolean; retry: () => void };
function SourceState({ source, children }: { source: Source; children: ReactNode }) {
    return source.loading ? <p className="co-status" role="status">Loading…</p> : source.failed
        ? <p className="co-status" role="alert">This information couldn’t be loaded. <button onClick={source.retry}>Try again</button></p> : children;
}
function Heading({ eyebrow, title, to, action }: { eyebrow: string; title: string; to?: string; action?: string }) {
    return <header className="co-heading"><div><p className="co-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{to && <Link className="co-link" to={to}>{action}<ArrowRight size={16}/></Link>}</header>;
}
type OverviewProps = { club: ClubProfile; entry?: Entry | null; opportunityItems?: ReturnType<typeof useClubOpportunityPreview> };
export function ClubOverview(props: OverviewProps) {
    return props.opportunityItems ? <OverviewContent {...props} opportunityItems={props.opportunityItems}/> : <StandaloneOverview {...props}/>;
}
function StandaloneOverview(props: OverviewProps) {
    const opportunityItems = useClubOpportunityPreview(props.club.id);
    return <OverviewContent {...props} opportunityItems={opportunityItems}/>;
}
function OverviewContent({ club, entry, opportunityItems }: OverviewProps & {opportunityItems:ReturnType<typeof useClubOpportunityPreview>}) {
    const { user } = useAuth();
    const base = `/clubs/${club.id}`;
    const programmes = overviewProgrammes(club.presentation?.programmes);
    const lead = overviewLead(club.id, user?.role, user?.navigationCapabilities);
    const connection = accessibleClubs(user?.navigationCapabilities).find(c => c.id === club.id);
    const personal = connectedWorkspaces(user?.navigationCapabilities).filter(w => w.group === 'Personal work' && !['club.work','admin.console'].includes(w.key.split(':')[0]));
    const people = useOverviewSource<PublicStaff[]>(`${base}/staff-directory`);
    // A fixed window per mount avoids refetching all sources on every render.
    const [window] = useState(() => {
        const start = new Date(); const end = new Date(start); end.setDate(end.getDate() + 30);
        const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,19);
        return `from=${local(start)}&to=${local(end)}`;
    });
    const schedule = useOverviewSource<{ events: ScheduleEventOccurrence[] }>(`/schedule/clubs/${club.id}/events?${window}`);
    const fixtures = overviewFixtures(schedule.data?.events ?? []);
    const website = safePublicUrl(club.websiteUrl);
    const showWork = Boolean(connection || entry?.canOpenWorkspace);
    const training = programmes.length > 0 && <TrainingPreview clubId={club.id} programmes={programmes}/>;
    return <div className="club-overview">
        {showWork && <section className="co-work" aria-label="Your connection to this club"><header><span className="co-work-icon"><LayoutGrid size={22}/></span><div><p className="co-eyebrow">Your connection</p><h2>{entry?.invitationOnly ? 'An invitation to your next chapter.' : 'Your club. Your next move.'}</h2><p>{entry?.invitationOnly ? 'Review the appointment and its responsibilities in your workspace.' : connection?.relationships.join(' · ') || 'Your club responsibilities'}</p></div><span className="co-private"><LockKeyhole size={13}/>Only shown to you</span></header><div className="co-work-links">
            {entry?.canOpenWorkspace && <Link className="co-button co-primary" to={`${base}/workspace`}>{entry.invitationOnly ? 'Review invitation' : 'Open club workspace'}<ArrowUpRight size={17}/></Link>}
            {entry?.canManageStaff && !entry.invitationOnly && personal.length < 3 && <Link className="co-button" to={`${base}/workspace?tab=staff-duties`}><Users size={16}/>Staff & responsibilities</Link>}
            {personal.map(w=><Link className="co-button" key={w.key} to={w.path}>{w.label}<ArrowUpRight size={16}/></Link>)}
            <Link className="co-link" to="/workspaces">All my work<ArrowRight size={16}/></Link>
        </div></section>}
        <div className="co-grid"><div className="co-main">
            {lead === 'family' && <ClubFamilyBriefing clubId={club.id} showUpdates={false}/> }
            {lead === 'training' && training}
            {lead === 'teams' && <SquadPreview clubId={club.id}/>}
            <ClubUpdates clubId={club.id} clubName={club.name} publishing={Boolean(entry?.canManageStaff && !entry.invitationOnly)}/>
            <ClubOpportunitySpotlight clubId={club.id} items={opportunityItems}/>
            {lead !== 'training' && training}
            {!programmes.length && <section className="co-training-note"><Flag size={23}/><div><h3>Find your place in the game.</h3><p>Explore the teams or ask the club about training and joining.</p></div><Link className="co-link" to={`${base}?tab=teams`}>Training & teams<ArrowRight size={16}/></Link></section>}
            <ClubEssentials clubId={club.id} programmes={programmes.length} people={people.data?.length}/>

        </div><aside className="co-rail" aria-label="Club information">
            <section className="co-fixtures"><Heading eyebrow="Coming up" title="On the pitch." to={`${base}?tab=schedule`} action="Schedule"/><SourceState source={schedule}>{fixtures.length ? fixtures.map(f=><Link className="co-fixture" to={`${base}?tab=schedule`} key={`${f.occurrenceId}:${f.startsAt}`}><CalendarDays size={22}/><div><time dateTime={f.startsAt}>{formatDate(f.startsAt,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time><h3>{f.title}</h3><p>{f.challengeStatus && f.challengeStatus !== 'ACCEPTED' ? 'Awaiting confirmation' : f.locationName || 'View match details'}</p></div><ArrowUpRight size={16}/></Link>):<p className="co-muted">No public fixtures in the next 30 days. Check the schedule for other activities.</p>}</SourceState></section>
            <section className="co-rail-section co-staff-preview"><Heading eyebrow="People behind the club" title="Coaches & staff"/><SourceState source={people}>{people.data?.length ? people.data.slice(0,3).map(p=><Link className="co-person-row" key={p.userId} to={`/profile/${p.userId}`}><span className="co-avatar">{p.avatarUrl?<MediaImage src={p.avatarUrl} alt=""/>:p.fullName.slice(0,2).toUpperCase()}</span><span><strong>{p.fullName}</strong><small>{staffTitle(p)}</small></span><ArrowUpRight size={15}/></Link>):<p className="co-muted">The club’s published staff will appear here.</p>}</SourceState><Link className="co-link" to={`${base}?tab=people`}>Meet the team<ArrowRight size={16}/></Link></section>
            <ClubSponsors presentation={club.presentation}/>
            <ClubOpportunityRail clubId={club.id} items={opportunityItems}/>
            <section className="co-rail-section"><p className="co-eyebrow">At a glance</p><h2>{club.name}</h2>{club.addressText && <p className="co-contact"><MapPin size={17}/>{club.addressText}</p>}{club.foundedYear && <p className="co-muted">Established {club.foundedYear}</p>}{website&&<a className="co-link" href={website} target="_blank" rel="noopener noreferrer"><Globe2 size={16}/>Club website<ArrowUpRight size={15}/></a>}<Link className="co-link" to={`${base}?tab=contact`}>Get in touch<ArrowUpRight size={16}/></Link></section>
        </aside></div>
    </div>;
}

function TrainingPreview({ clubId, programmes }: { clubId: number; programmes: TrainingProgramme[] }) {
    return <section className="co-training-preview" aria-label="Training programmes and fees">
        <header className="co-heading"><div className="co-training-heading"><span className="co-training-icon"><GraduationCap size={24}/></span><div><p className="co-eyebrow">Training at the club</p><h2>Programmes & fees</h2></div></div><Link className="co-link" to={trainingPath(clubId)}>All training<ArrowRight size={16}/></Link></header>
        <p className="co-training-intro">Compare age groups, weekly training and prices. Explore each programme for its squads and timetable.</p>
        <div className="co-training-list">{programmes.slice(0,3).map((p,i) => <Link className="co-training-programme" key={p.id ?? i} to={trainingPath(clubId,{programme:p.id})}>
            <div className="co-training-details"><span className="co-training-age"><Shirt size={15}/>{programmeAge(p)}</span><h3>{p.name}</h3><div className="co-training-meta"><span><CalendarDays size={14}/>{p.sessionsPerWeek ? `${p.sessionsPerWeek} ${p.sessionsPerWeek === 1 ? 'session' : 'sessions'} / week` : 'Frequency not published'}</span>{Boolean(p.squadIds?.length) && <span><Users size={14}/>{p.squadIds!.length} training {p.squadIds!.length === 1 ? 'group' : 'groups'}</span>}</div></div>
            <div className="co-training-fee"><span className="co-eyebrow">Training fee</span><strong>{programmePrice(p)}</strong>{p.trialAmount != null && <small>Trial: {Number(p.trialAmount) === 0 ? 'Free' : money(p.trialAmount,p.currency)}</small>}<span className="co-training-action">Squads & timetable<ArrowUpRight size={16}/></span></div>
        </Link>)}</div>
        <footer className="co-training-footer"><span>{programmes.length} published {programmes.length === 1 ? 'programme' : 'programmes'}</span><p>Full details include additional fees and how to enquire.</p></footer>
    </section>;
}

function SquadPreview({clubId}:{clubId:number}) {
    const squads=useOverviewSource<PublicSquad[]>(`/clubs/${clubId}/squads`);
    return <section><Heading eyebrow="Meet your next opposition" title="Good teams make a better game." to={`/clubs/${clubId}?tab=schedule`} action="Fixtures"/><SourceState source={squads}>{squads.data?.length ? <div className="co-squads">{squads.data.slice(0,4).map(s=><Link key={s.id} to={trainingPath(clubId,{squad:s.id})}><Shirt size={23}/><span><strong>{s.name}</strong><small>{s.category}</small></span><ArrowUpRight size={17}/></Link>)}</div>:<p className="co-muted">Explore the club’s teams or get in touch to discuss a match.</p>}</SourceState></section>;
}
function ClubEssentials({clubId, programmes, people}:{clubId:number;programmes:number;people?:number}) {
    const places=useOverviewSource<PublicFacility[]>(`/clubs/${clubId}/facilities`);
    return <nav className="co-club-facts" aria-label="Club essentials">
        <Link to={`/clubs/${clubId}?tab=teams`}><Flag size={21}/><span><strong>Training & teams</strong><small>{programmes ? `${programmes} published ${programmes === 1 ? 'programme' : 'programmes'} · prices, squads & timetables` : 'Squads, training and joining information'}</small></span></Link>
        <Link to={`/clubs/${clubId}?tab=facilities`}><MapPin size={21}/><span><strong>Venues & facilities</strong><small>{places.data?.[0]?.title || (places.loading ? 'Loading locations…' : places.failed ? 'Explore published locations' : 'No locations published yet')}{places.data && places.data.length > 1 && ` · ${places.data.length} locations`}</small></span></Link>
        <Link to={`/clubs/${clubId}?tab=people`}><Users size={21}/><span><strong>Coaches & staff</strong><small>{people ? `${people} ${people === 1 ? 'person' : 'people'} · responsibilities & profiles` : 'Published staff and responsibilities'}</small></span></Link>
    </nav>;
}
