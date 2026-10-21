import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, ClipboardCheck, Home, Image, Inbox, Warehouse } from 'lucide-react';
import { MediaImage } from '../components/ui/MediaImage';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { fetchVenue, type BookingKind, type Venue } from '../features/venues/api';
import { VenueListingEditor, VenuePitchEditor } from '../features/venues/VenueEditors';
import { VenueBookingFlow } from '../features/venues/VenueBookingFlow';
import { VenueOwnerHome, VenueRequestInbox, VenueSetup } from '../features/venues/VenueOwnerHome';
import { VenueOperations } from '../features/venues/VenueOperations';
import { localDate, ownerView, type OwnerView } from '../features/venues/ownerWorkflow';
import { today, validDate } from '../features/venues/utils';
import '../features/venues/venues.css';
import '../features/venues/venue-owner.css';

export function StadiumWorkspacePage() {
  const { organizationId } = useParams(), { sessionId } = useAuth();
  if (!organizationId || !/^\d+$/.test(organizationId)) return <main className="venue-page venue-empty"><h1>Stadium not found</h1><Link to="/stadiums">Explore stadiums</Link></main>;
  return <StadiumWorkspace key={`${organizationId}-${sessionId}`} id={Number(organizationId)}/>;
}
function StadiumWorkspace({ id }: { id: number }) {
  const [params, setParams] = useSearchParams();
  const [venue, setVenue] = useState<Venue | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const tab = ownerView(params.get('view'));
  const [visited, setVisited] = useState<OwnerView[]>([tab]);
  const [date, setDate] = useState(''), [adding, setAdding] = useState<BookingKind | null>(null), [receipt, setReceipt] = useState(''), [calendarRevision, setCalendarRevision] = useState(0);
  const [editorTarget, setEditorTarget] = useState<{ step: number; token: number } | undefined>();
  useEffect(() => {
    const controller = new AbortController();
    void fetchVenue(id, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setVenue(data); setError('');
      setDate(current => current || (validDate(params.get('date') || '') ? params.get('date')! : today(data.timezone)));
    }).catch(err => { if (!controller.signal.aborted) setError(extractApiErrorMessage(err, 'Your venue workspace could not load.')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // Search parameters change workspace views without reloading saved venue details.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reload]);
  const navigate = (next: OwnerView, step?: number) => {
    setVisited(v => [...new Set([...v, tab, next])]);
    const nextParams = new URLSearchParams(params); nextParams.set('view', next); setParams(nextParams);
    if (step !== undefined) setEditorTarget({ step, token: Date.now() });
  };
  function add(kind: BookingKind) { setAdding(kind); setReceipt(''); navigate('calendar'); }
  if (loading) return <main className="venue-page venue-empty" role="status">Opening your venue workspace…</main>;
  if (!venue) return <main className="venue-page venue-empty"><h1>Workspace unavailable</h1><p role="alert">{error}</p><button className="venue-button" onClick={() => { setLoading(true); setReload(r => r+1); }}>Try again</button></main>;
  if (!venue.capabilities?.canManageVenueBookings) return <main className="venue-page venue-empty"><h1>This workspace belongs to the venue team</h1><p>You need current venue operations access to organise this stadium.</p><Link className="venue-button" to={`/stadiums/${id}`}>View stadium page</Link></main>;
  const configure = !!venue.capabilities?.canConfigureVenue, intake = !!venue.capabilities?.enabledActivities.includes('VENUE');
  const activeTab = (!configure && ['listing','pitches','setup'].includes(tab)) || (venue.promotionBlocked && ['listing','setup'].includes(tab)) ? 'overview' : tab;
  const tabs = [{id:'overview',label:'Overview',icon:Home},{id:'calendar',label:'Calendar & reservations',icon:CalendarDays},{id:'requests',label:'Requests',icon:Inbox},...(configure ? [{id:'pitches',label:'Pitches',icon:Warehouse},...(!venue.promotionBlocked ? [{id:'listing',label:'Stadium page',icon:Image},{id:'setup',label:'Setup & handover',icon:ClipboardCheck}] : [])] : [])];
  return <main className="venue-page venue-workspace">
    <div className="venue-breadcrumb"><Link to="/my-organizations"><ArrowLeft size={15}/>My venues</Link><span>/ Venue workspace</span></div>
    <header className="venue-workspace-heading"><div><p className="venue-eyebrow">{venue.city || 'Your venue'} · {configure ? 'Venue management' : 'Venue operations'}</p><h1>{venue.displayName}</h1><p>{configure ? 'Bookings, pitches and the people who keep them running.' : 'Manage reservations, respond to requests and block unavailable time.'}</p></div><div className="venue-inline"><span className={`venue-status venue-status--${venue.published && intake && !venue.promotionBlocked ? 'confirmed' : 'pending'}`}>{venue.promotionBlocked ? 'Public promotion restricted' : !intake ? 'New bookings paused' : venue.published ? 'Published' : 'Draft'}</span>{venue.capabilities?.canConfigureActivities && <Link className="venue-button" to={`/organizations/${venue.id}/workspace?tab=settings`}>Activities & venue team</Link>}{!venue.promotionBlocked && <Link className="venue-button" to={`/stadiums/${venue.id}`}>View stadium<ArrowUpRight size={16}/></Link>}</div></header>
    {venue.promotionBlocked && <p className="venue-notice" role="status">This venue’s public promotion is restricted. Existing bookings can still be managed.</p>}
    {!intake && <p className="venue-notice" role="status">New venue bookings are paused. Keep managing existing reservations and closures here.</p>}
    <div className="venue-workspace-layout">
    <aside className="venue-workspace-sidebar">
      <div className="venue-workspace-identity">{venue.logoUrl && !venue.promotionBlocked ? <MediaImage src={resolveMediaUrl(venue.logoUrl)} alt=""/> : <Warehouse size={28}/>}<div><strong>{venue.displayName}</strong><span>Private workspace</span></div></div>
      <nav aria-label="Stadium workspace">{[{label:'Daily operations', ids:['overview','calendar','requests']},{label:'Your venue',ids:['pitches','listing','setup']}].filter(group => tabs.some(item => group.ids.includes(item.id))).map(group => <section key={group.label}><p className="venue-eyebrow">{group.label}</p>{tabs.filter(item => group.ids.includes(item.id)).map(item => <button key={item.id} aria-current={activeTab === item.id ? 'page' : undefined} aria-pressed={activeTab === item.id} className={activeTab === item.id ? 'is-active' : ''} onClick={() => navigate(item.id as OwnerView)}><item.icon size={17}/>{item.label}</button>)}</section>)}</nav>
      {venue.capabilities?.canEditProfile && <Link className="venue-workspace-organization" to={`/organizations/${venue.id}/workspace?tab=profile`}><Building2 size={18}/><span><strong>{venue.capabilities.canConfigureActivities ? 'Organization & team' : 'Organization profile'}</strong><small>{venue.capabilities.canConfigureActivities ? 'Profile, people and permissions' : 'Identity and contact details'}</small></span><ArrowUpRight size={14}/></Link>}
    </aside>
    <div className="venue-workspace-content">
    {receipt && <p className="venue-success" role="status">{receipt}</p>}
    {activeTab === 'overview' && <VenueOwnerHome key={calendarRevision} venue={venue} active navigate={navigate} add={add}/>}
    {activeTab === 'requests' && <VenueRequestInbox venue={venue} active/>}
    {activeTab === 'setup' && <VenueSetup venue={venue} navigate={navigate} add={add}/>}
    {configure && !venue.promotionBlocked && (visited.includes('listing') || activeTab === 'listing') && <div hidden={activeTab !== 'listing'}><VenueListingEditor venue={venue} onSave={setVenue} target={editorTarget}/></div>}
    {configure && (visited.includes('pitches') || activeTab === 'pitches') && <div hidden={activeTab !== 'pitches'}><VenuePitchEditor venue={venue} onSave={setVenue}/></div>}
    <div hidden={activeTab !== 'calendar'}>{adding ? <VenueBookingFlow venue={venue} date={date || today(venue.timezone)} initialKind={adding} onCancel={() => setAdding(null)} onSave={saved => { setAdding(null); setCalendarRevision(n => n+1); if (saved[0]) setDate(localDate(saved[0].startsAt,venue.timezone)); setReceipt(saved.length ? `${saved.length} ${saved[0].kind === 'CLOSURE' ? 'closure' : 'confirmed booking'}${saved.length > 1 ? 's' : ''} added to your calendar.` : 'Your calendar entry was saved.'); }}/> : <VenueOperations venue={venue} active={activeTab === 'calendar'} date={date || today(venue.timezone)} setDate={setDate} add={add} revision={calendarRevision}/>}</div>
    </div></div>
  </main>;
}

