import { useClubProfileSearchParams } from '../../../features/clubs/clubProfilePreviewContext';
import { FacilityDirectionsPanel } from '../../../features/clubs/FacilityDirectionsPanel';
import type { PublicSquad } from '../../../features/clubs/publicJourney';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Navigation, Footprints, Backpack, Users } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import type { ClubProfile } from '../../../pages/ClubProfilePage';
import '../club-public.css';

export interface PublicFacility { id: number; title: string; details: Record<string, string>; squadId?: number | null; squadName?: string | null }
export function FacilityCard({ facility, clubId }: { facility: PublicFacility; clubId?: number }) {
  const d = facility.details;
  const [directions,setDirections]=useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photos = [...new Set((d.photos ?? '').split(/\r?\n/).map(s => s.trim()).filter(s => { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }))];
  const hasGuidance = ['arrival','transport','accessibility','amenities','collection','whatToBring','contact'].some(k => d[k]);
  const image = photos[0] && failedPhoto !== photos[0] ? photos[0] : null;
  return <article className="cp-facility" id={`facility-${facility.id}`}>
    <div className="cp-facility-top"><div className="cp-facility-intro"><div className="cp-meta"><span className="cp-tag" data-tone="amber">{({ OWNED: 'Club facility', RENTED: 'Rented venue', SHARED: 'Shared venue', REGULAR_USE: 'Regular training location' } as Record<string,string>)[d.relationship] ?? 'Training location'}</span><span>{facility.squadName || (facility.squadId ? 'Assigned training group' : 'Club-wide location')}</span></div><h3>{facility.title}</h3>{d.description && <p className="cp-prose">{d.description}</p>}<p className="cp-facility-address"><MapPin size={17}/>{d.address || 'Ask the club for the address'}</p><div className="cp-facility-actions">{clubId && facility.id>0 && <button type="button" className="cp-button cp-button-primary" onClick={()=>setDirections(true)}><Navigation size={16}/>Get directions</button>}{d.venueId && /^\d+$/.test(d.venueId) && <Link to={`/stadiums/${d.venueId}`} className="cp-button">Venue details<ArrowRight size={16}/></Link>}</div></div>
      {image ? <img className="cp-facility-photo" src={image} alt={`${facility.title} — venue photo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedPhoto(image)}/> : <div className="cp-ground-placeholder" aria-hidden="true"><div className="cp-pitch"><i/><span/><b/></div><span>Football starts here</span></div>}
    </div>
    <div className="cp-facility-guidance"><section><h4><Footprints size={18}/>Getting there</h4><p>{d.arrival || 'Confirm the entrance and meeting point with the club.'}</p>{d.transport && <p>{d.transport}</p>}{d.accessibility && <p><strong>Accessibility</strong><br/>{d.accessibility}</p>}</section><section><h4><Backpack size={18}/>At the ground</h4><p>{d.amenities || 'Ask about changing facilities, toilets and where parents can wait.'}</p>{d.whatToBring && <p><strong>What to bring</strong><br/>{d.whatToBring}</p>}</section><section><h4><Users size={18}/>Meeting & collection</h4><p>{d.collection || 'Agree collection arrangements with your coach.'}</p>{d.contact && <p><strong>Public contact</strong><br/>{d.contact}</p>}</section></div>
    {!hasGuidance && <div className="cp-facility-empty"><strong>Visiting for the first time?</strong><p>The address is published; arrival and collection guidance has not been added yet. Confirm your session and meeting point before travelling.</p></div>}
    {photos.length > 1 && <details className="cp-facility-empty"><summary>More venue photos ({photos.length - 1})</summary><div className="cp-programme-grid">{photos.slice(1).map((photo, i) => <img key={photo} src={photo} alt={`${facility.title} — additional venue photo ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" className="cp-facility-photo"/>)}</div></details>}
    {directions&&clubId&&<FacilityDirectionsPanel clubId={clubId} facilityId={facility.id} title={facility.title} address={d.address} onClose={()=>setDirections(false)}/>}
  </article>;
}
export function TabFacilities({ club, isOwnClubAdmin }: { club: ClubProfile; isOwnClubAdmin: boolean }) {
  const [params, setParams] = useClubProfileSearchParams(), squad = params.get('squad') ?? '';
  const [result, setResult] = useState<{ scope: string; facilities: PublicFacility[]; squads: PublicSquad[]; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0), scope = `${club.id}:${attempt}`;
  useEffect(() => {
    const c = new AbortController();
    void Promise.all([apiClient.get<PublicFacility[]>(`/clubs/${club.id}/facilities`, { signal: c.signal }),apiClient.get<PublicSquad[]>(`/clubs/${club.id}/squads`, { signal: c.signal })])
      .then(([r,squads]) => { if (!c.signal.aborted) setResult({ scope, facilities: r.data, squads:squads.data, error: '' }); })
      .catch(() => { if (!c.signal.aborted) setResult({ scope, facilities: [], squads:[], error: 'Facilities could not be loaded.' }); });
    return () => c.abort();
  }, [club.id, scope]);
  const facilities = result?.scope === scope ? result.facilities : [];
  const groups = result?.scope===scope ? result.squads.map(s=>[String(s.id),s.name]) : [];
  const filtered = facilities.filter(f => !squad || f.squadId == null || String(f.squadId) === squad);
  const select = (value: string) => { const next = new URLSearchParams(params); if (value) next.set('squad', value); else next.delete('squad'); setParams(next, { replace: true }); };
  return <section className="club-public"><header className="cp-heading"><div className="cp-heading-title"><span className="cp-section-icon" data-tone="amber"><MapPin size={26}/></span><div><p className="cp-eyebrow">Know before you go</p><h2>Training locations</h2><p>Find the entrance, plan the journey and know where to meet your coach.</p></div></div>{isOwnClubAdmin && <Link className="cp-button" to={`/clubs/${club.id}/workspace?tab=facilities`}>Manage facilities<ArrowRight size={16}/></Link>}</header>
    {(groups.length > 0 || squad) && <div className="cp-filters"><select aria-label="Facility training group" value={squad} onChange={e => select(e.target.value)}><option value="">All locations</option>{squad && !groups.some(([id]) => id === squad) && <option value={squad}>Selected training group</option>}{groups.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>{squad && <button className="cp-text-button" onClick={() => select('')}>Show all locations</button>}<span className="cp-muted">Includes club-wide locations. Confirm the venue for your session.</span></div>}
    {result?.scope !== scope ? <p role="status">Loading facilities…</p> : result.error ? <p role="alert">{result.error} <button className="cp-text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></p> : filtered.length === 0 ? <div className="cp-empty"><h3>Confirm your training location</h3><p>{squad ? 'No published location is assigned to this group.' : 'The club has not published its facilities yet.'} Contact the club before your first visit.</p><Link className="cp-back" to={`/clubs/${club.id}?tab=contact`}>Contact the club<ArrowRight size={16}/></Link></div> : <div className="cp-stack">{filtered.map(f => <FacilityCard key={f.id} facility={f} clubId={club.id}/>)}</div>}
    <div className="cp-location-footer"><MapPin size={18}/><p>Use the location confirmed for your session. A club’s postal address may be different from its training ground.</p><Link to={`/clubs/${club.id}?tab=contact`}>Club contact<ArrowRight size={16}/></Link></div>
  </section>;
}
