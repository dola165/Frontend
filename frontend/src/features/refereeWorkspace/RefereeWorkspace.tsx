import { ClubAppointments } from './ClubAppointments';
import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, Compass, Flag, LayoutDashboard, RefreshCw, UserRound, ArrowRight, Clock3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRefereeHistory as useLoad } from '../matchExchange/useRefereeHistory';
import { useAction, useClock } from '../matchExchange/hooks';
import { remove, when, type Appointment, type RefereeHub } from '../matchExchange/api';
import { LoadState, Status } from '../matchExchange/shared';
import { ExactRefereeAppointment, RefereeAppointmentHistory, RefereeOfferHistory } from '../matchExchange/RefereeOutcomeHistory';
import { AppointmentCard } from '../matchExchange/AppointmentCard';
import { OfficialOpportunities } from '../matchExchange/OfficialRequests';
import { ExtensionSurface } from '../capabilities/ExtensionBoundary';
import { TournamentRefereeInbox } from '../tournaments/components/TournamentRefereeInbox';
import { CareerForm, CareerTimeline, ProfileEditor } from './ProfileTools';
import { refereeStage, workspaceSection } from './domain';
import { RefereeWorkspaceContext } from './WorkspaceContext';
import { Availability, AvailabilityDialog } from './Availability';
import { MatchPanel } from './MatchPanel';
import './referee-workspace.css';

const sections = [
  ['overview', 'Overview', LayoutDashboard, '#overview'],
  ['assignments', 'My assignments', Flag, '#invitations'],
  ['opportunities', 'Find matches', Compass, '#open-requests'],
  ['availability', 'Availability', CalendarDays, '#availability'],
  ['profile', 'Referee profile', UserRound, '#profile'],
] as const;
const filterNames = { invitations: 'Invitations', upcoming: 'Upcoming & live', 'follow-ups': 'Reports to finish', history: 'History' };

export function RefereeWorkspace() {
  const { sessionId } = useAuth();
  return <Workspace key={sessionId}/>;
}
function Workspace() {
  const location = useLocation(), navigate = useNavigate(), now = useClock();
  const { data: hub, error, reload } = useLoad<RefereeHub>('/referees/me');
  const [opened, setOpened] = useState<number | null>(null), [availability, setAvailability] = useState<Appointment | null>(null);
  const [search, setSearch] = useState(''), [editing, setEditing] = useState(false), [adding, setAdding] = useState(false);
  const [revision, setRevision] = useState(0);
  const changed = useCallback(() => { reload(); setRevision(n => n+1); }, [reload]);
  const section = workspaceSection(location.hash), activeFilter = location.hash.slice(1) in filterNames ? location.hash.slice(1) as keyof typeof filterNames : 'invitations';
  const [visited, setVisited] = useState([section]);
  if (!visited.includes(section)) setVisited([...visited,section]);
  const { run, busy, feedback } = useAction(reload);
  const openMatch = (id: number) => setOpened(id);
  const addAvailability = (a?: Appointment) => a ? setAvailability(a) : navigate('#availability');
  if (!hub) return <main className="mx-page"><h1>Referee workspace</h1><LoadState error={error} reload={reload}/></main>;
  const profile = hub.profile, appointments = hub.appointments;
  const grouped = (kind: keyof typeof filterNames) => appointments.filter(a => refereeStage(a,now) === kind).sort((a,b) => Date.parse(a.starts_at_iso)-Date.parse(b.starts_at_iso));
  const invitations = grouped('invitations'), upcoming = grouped('upcoming'), reports = grouped('follow-ups');
  const exact = /^#appointment-([1-9]\d*)$/.exec(location.hash)?.[1];
  const filtered = grouped(activeFilter).filter(a => `${a.title} ${a.club_name} ${a.opponent_name || ''} ${a.location_name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <RefereeWorkspaceContext.Provider value={{openMatch,addAvailability}}><main className="mx-page rw-workspace">
    <header className="rw-heading"><div className="rw-identity"><span className="rw-emblem"><Flag size={27}/></span><div><p className="rw-eyebrow">Officiating</p><h1>Referee workspace</h1><p>Your matches, decisions and preparation, together.</p></div></div><div className="rw-heading-actions"><button onClick={changed} aria-label="Refresh referee workspace"><RefreshCw size={16}/></button><Link to="/calendar">Open full schedule ↗</Link>{profile && <Link to={`/profile/${profile.user_id}`}>View public profile ↗</Link>}</div></header>
    <div className="rw-layout"><aside className="rw-sidebar"><nav aria-label="Referee workspace">{sections.map(([id,name,Icon,hash]) => <Link key={id} to={hash} aria-current={section === id ? 'page' : undefined}><Icon size={18}/><span>{name}</span>{id === 'assignments' && invitations.length+reports.length>0 && <b>{invitations.length+reports.length}</b>}</Link>)}</nav><div className="rw-sidebar-note"><strong>{profile?.full_name || 'Your referee profile'}</strong><p>{profile ? profile.published ? 'Listed in the referee directory' : 'Directory listing is private' : 'Set up your officiating details to get started.'}</p></div></aside>
    <div className="rw-content">{error && <p role="alert" className="mx-error">{error} <button onClick={reload}>Retry workspace</button></p>}
      {!profile ? <section><h2>Start with your officiating details</h2><p className="mx-muted">Save your preferences, then add availability and respond to invitations here. Your football role remains managed through your account.</p><Link to="/account/roles">Manage football roles ↗</Link><ProfileEditor profile={null} onSaved={reload}/></section> : <>
      <section hidden={section !== 'overview'} className="rw-section" aria-label="Referee overview"><header className="rw-section-heading"><div><p className="rw-eyebrow">Your working day</p><h2>Ready for the next whistle</h2><p>Start with what needs your attention.</p></div><span className="rw-today">{new Date(now).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</span></header>
        <ClubAppointments/><div className="rw-summary">{[[invitations.length,'Invitations','#invitations','amber'],[upcoming.length,'Upcoming & live','#upcoming','blue'],[reports.length,'Reports to finish','#follow-ups','violet']].map(([count,name,hash,tone]) => <Link key={String(hash)} to={String(hash)} data-tone={tone}><span>{name}</span><strong>{count}</strong><ArrowRight size={18}/></Link>)}</div>
        <div className="rw-overview-grid"><section className="mx-panel"><h2><ClipboardCheck size={19}/> Needs your attention</h2>{!invitations.length && !reports.length ? <div className="rw-empty"><ClipboardCheck size={28}/><h3>You’re up to date</h3><p>Invitations and unfinished reports will appear here.</p></div> : [...invitations,...reports].slice(0,5).map(a => <AssignmentRow key={a.id} appointment={a} reason={refereeStage(a,now)==='invitations' ? 'Reply to invitation' : 'Finish match report'} open={openMatch}/>)}{invitations.length+reports.length>5 && <Link to="#invitations">See all assignments →</Link>}</section>
          <section className="mx-panel"><h2><Clock3 size={19}/> Next on your calendar</h2>{upcoming.length ? upcoming.slice(0,3).map(a => <AssignmentRow key={a.id} appointment={a} open={openMatch}/>) : <p className="mx-muted">Your accepted upcoming matches appear here.</p>}<Link className="rw-inline-link" to="#availability">Manage my availability <ArrowRight size={16}/></Link>{!hub.availability.length && <p className="rw-hint">No future availability is set. Add a window so you can accept a match.</p>}</section></div>
        <section className="rw-discover"><Compass size={24}/><div><h3>Find your next match</h3><p>Browse paid and volunteer requests, then follow your offers in one place.</p></div><Link to="#open-requests">Browse requests <ArrowRight size={17}/></Link></section>
      </section>
      {visited.includes('assignments') && <section hidden={section !== 'assignments'} className="rw-section" aria-label="My referee assignments"><header className="rw-section-heading"><div><h2>My assignments</h2><p>Respond, prepare, coordinate and finish your reports here.</p></div></header>
        <nav className="rw-segments" aria-label="Assignment views">{Object.entries(filterNames).map(([id,name]) => <Link key={id} to={'#'+id} aria-current={!exact && activeFilter === id ? 'page' : undefined}>{name}{id !== 'history' && <span>{grouped(id as keyof typeof filterNames).length}</span>}</Link>)}</nav>
        <ExtensionSurface capability="tournamentRefereeManagement"><TournamentRefereeInbox/></ExtensionSurface>
        {exact ? <ExactRefereeAppointment key={exact+':'+revision} appointmentId={Number(exact)} reloadAppointment={reload}/> : activeFilter === 'history' ? <><p className="mx-muted">Past decisions and submitted reports. Open a match to review its result and recorded outcome.</p>{grouped('history').filter(a => a.inbox_section === 'CURRENT').map(a => <AppointmentCard key={a.id} appointment={a} reload={reload}/>)}<RefereeAppointmentHistory reloadAppointment={reload}/></> : <><label className="rw-search">Find an assignment<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Match, club or ground"/></label>{filtered.length ? <div className="rw-stack">{filtered.map(a => <AppointmentCard key={a.id} appointment={a} reload={reload}/>)}</div> : <section className="rw-empty mx-panel"><Flag size={28}/><h3>{search ? 'No matching assignments' : `No ${filterNames[activeFilter].toLowerCase()}`}</h3><p>{search ? 'Try another match, club or ground.' : activeFilter==='invitations' ? 'Invitations from clubs will appear here. You can also offer to officiate an open request.' : 'You can review previous appointments in History.'}</p></section>}</>}
      </section>}
      {visited.includes('opportunities') && <section hidden={section !== 'opportunities'} className="rw-section" aria-label="Find referee matches"><header className="rw-section-heading"><div><h2>Find matches</h2><p>Choose a request, review its terms and track what happens next.</p></div></header><nav className="rw-segments" aria-label="Referee opportunities"><Link to="#open-requests" aria-current={location.hash==='#open-requests' ? 'page' : undefined}>Open requests</Link><Link to="#offers" aria-current={location.hash.startsWith('#offer') ? 'page' : undefined}>My offers & outcomes</Link></nav>{location.hash.startsWith('#offer') ? <RefereeOfferHistory/> : <OfficialOpportunities availability={hub.availability} onChanged={reload}/>}</section>}
      {visited.includes('availability') && <section hidden={section !== 'availability'} className="rw-section" aria-label="Referee availability"><header className="rw-section-heading"><div><h2>Availability</h2><p>Make time for football around your other commitments.</p></div></header><Availability hub={hub} reload={reload} openMatch={openMatch}/></section>}
      {visited.includes('profile') && <section hidden={section !== 'profile'} className="rw-section" aria-label="Referee profile settings"><header className="rw-section-heading"><div><h2>Your referee profile</h2><p>Control how clubs find you and keep your officiating details up to date.</p></div></header>{editing ? <><button className="rw-inline-link" onClick={()=>setEditing(false)}>Close editor</button><ProfileEditor profile={profile} onSaved={()=>{setEditing(false);reload();}}/></> : <section className="mx-panel"><div className="rw-card-heading"><h3>Officiating details</h3><Status value={profile.published ? 'PUBLISHED' : 'PRIVATE'}/></div><p className="rw-prose">{profile.biography || 'Add a short introduction for clubs.'}</p><p>{profile.service_area || 'Service area not set'} · {profile.travel_km} km travel</p><p>{[profile.accepts_paid ? `Paid · from ${profile.fee} ${profile.currency}` : '',profile.accepts_volunteer ? 'Open to volunteering' : ''].filter(Boolean).join(' · ') || 'Invitation preferences not set'}</p><button className="mx-primary" onClick={()=>setEditing(true)}>Edit referee details</button></section>}{feedback}<CareerTimeline profile={profile} onRemove={!busy ? id => void run(()=>remove(`/referees/me/career/${id}`),'Entry removed') : undefined}/>{adding ? <><button onClick={()=>setAdding(false)}>Cancel adding experience</button><CareerForm reload={()=>{setAdding(false);reload();}}/></> : <button className="rw-inline-link" onClick={()=>setAdding(true)}>Add career, qualification or volunteering</button>}<p className="mx-muted">Qualifications and manually added experience are self-reported. Match appointments and reports keep their existing access controls.</p></section>}
      </>}
    </div></div>
    {opened != null && <MatchPanel key={opened} eventId={opened} onClose={()=>setOpened(null)} onChanged={changed} refreshVersion={revision}/>}
    {availability && <AvailabilityDialog appointment={availability} onClose={()=>setAvailability(null)} onSaved={changed}/>}
  </main></RefereeWorkspaceContext.Provider>;
}
function AssignmentRow({ appointment: a, open, reason }: { appointment: Appointment; open: (id:number)=>void; reason?:string }) {
  return <button className="rw-assignment-row" onClick={()=>open(a.event_id)}><span className="rw-date"><strong>{new Date(a.starts_at_iso).getDate()}</strong><small>{new Date(a.starts_at_iso).toLocaleDateString(undefined,{month:'short'})}</small></span><span><strong>{a.title}</strong><small>{reason || when(a.starts_at_iso)} · {a.duty.replaceAll('_',' ').toLowerCase()}</small><small>{a.location_name}</small></span><ArrowRight size={17}/></button>;
}

