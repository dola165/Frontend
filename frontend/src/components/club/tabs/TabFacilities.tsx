import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import type { ClubProfile } from '../../../pages/ClubProfilePage';
import type { PublicSquad } from '../../../features/clubs/publicJourney';
import { useClubProfileSearchParams } from '../../../features/clubs/clubProfilePreviewContext';
import { FacilityCard, type PublicFacility } from '../../../features/clubs/ClubPlaceCard';
import { placeType } from '../../../features/clubs/clubPlaceTypes';
import '../club-public.css';
import '../club-profile-refinement.css';
export { FacilityCard } from '../../../features/clubs/ClubPlaceCard';
export type { PublicFacility } from '../../../features/clubs/ClubPlaceCard';

export function TabFacilities({ club, isOwnClubAdmin }: { club: ClubProfile; isOwnClubAdmin: boolean }) {
  const [params, setParams] = useClubProfileSearchParams(), squad = params.get('squad') ?? '';
  const [result, setResult] = useState<{ scope: string; facilities: PublicFacility[]; squads: PublicSquad[]; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0), scope = `${club.id}:${attempt}`;
  useEffect(() => {
    const c = new AbortController();
    void Promise.all([apiClient.get<PublicFacility[]>(`/clubs/${club.id}/facilities`, { signal: c.signal }),apiClient.get<PublicSquad[]>(`/clubs/${club.id}/squads`, { signal: c.signal })])
      .then(([r,squads]) => { if (!c.signal.aborted) setResult({ scope, facilities: r.data, squads:squads.data, error: '' }); })
      .catch(() => { if (!c.signal.aborted) setResult({ scope, facilities: [], squads:[], error: 'Locations could not be loaded.' }); });
    return () => c.abort();
  }, [club.id, scope]);
  const facilities = result?.scope === scope ? result.facilities : [];
  const groups = result?.scope===scope ? result.squads.map(s=>[String(s.id),s.name]) : [];
  const filtered = facilities.filter(f => !squad || f.squadId == null || String(f.squadId) === squad);
  const select = (value: string) => { const next = new URLSearchParams(params); if (value) next.set('squad', value); else next.delete('squad'); setParams(next, { replace: true }); };
  return <section className="club-public cp-facilities"><header className="cp-heading"><div className="cp-heading-title"><span className="cp-section-icon" data-tone="amber"><MapPin size={26}/></span><div><p className="cp-eyebrow">Know before you go</p><h2>Venues & facilities</h2><p>Playing venues for matches and training, and facilities that support the club.</p></div></div>{isOwnClubAdmin && <Link className="cp-button" to={`/clubs/${club.id}/workspace?tab=facilities`}>Manage locations<ArrowRight size={16}/></Link>}</header>
    {(groups.length > 0 || squad) && <div className="cp-filters cp-facility-filter"><label><span>Locations for</span><select aria-label="Facility training group" value={squad} onChange={e => select(e.target.value)}><option value="">All squads</option>{squad && !groups.some(([id]) => id === squad) && <option value={squad}>Selected squad</option>}{groups.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>{squad && <button className="cp-text-button" onClick={() => select('')}>Show all locations</button>}{result?.scope === scope && !result.error && <span className="cp-muted">{filtered.length} {filtered.length === 1 ? 'location' : 'locations'}{squad ? ' · Includes club-wide grounds' : ''}</span>}</div>}
    {result?.scope !== scope ? <p role="status">Loading facilities…</p> : result.error ? <p role="alert">{result.error} <button className="cp-text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></p> : filtered.length === 0 ? <div className="cp-empty"><h3>Confirm your location</h3><p>{squad ? 'No published location is assigned to this group.' : 'The club has not published its venues or facilities yet.'} Contact the club before your first visit.</p><Link className="cp-back" to={`/clubs/${club.id}?tab=contact`}>Contact the club<ArrowRight size={16}/></Link></div> : <>{[
      {type:'VENUE',title:'Venues',description:'Grounds, stadiums and halls where the club plays or trains.'},
      {type:'FACILITY',title:'Facilities',description:'Supporting spaces such as gyms, changing rooms, medical rooms and clubhouses.'},
      {type:'UNCLASSIFIED',title:'Other club locations',description:isOwnClubAdmin?'These existing entries need a venue or facility type. Choose it when editing the location.':'Additional locations published by the club.'}
    ].map(group=>{const places=filtered.filter(p=>placeType(p)===group.type);return places.length>0&&<section className="club-place-section" key={group.type} aria-label={group.title}><header><h3>{group.title}</h3><p>{group.description}</p></header><div className="club-places-grid">{places.map(f=><FacilityCard key={f.id} facility={f} clubId={club.id}/>)}</div></section>;})}</>}
    <div className="cp-location-footer"><MapPin size={18}/><p>Use the location confirmed for your session. A club’s postal address may be different from its training ground.</p><Link to={`/clubs/${club.id}?tab=contact`}>Club contact<ArrowRight size={16}/></Link></div>
  </section>;
}
