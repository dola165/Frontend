import { useClubProfileSearchParams } from '../../../features/clubs/clubProfilePreviewContext';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Search } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { MediaImage } from '../../ui/MediaImage';
import { staffMatchesSquad, staffTitle, type PublicStaff } from '../../../features/clubs/publicJourney';
import type { ClubManagementTab } from '../ClubManagementModal';
import '../club-public.css';

const areas = [{ id: '', name: 'Everyone' }, { id: 'coaching', name: 'Coaching' }, { id: 'care', name: 'Player care' }, { id: 'operations', name: 'Club operations' }, { id: 'officials', name: 'Match officials' }];
const staffAreas = (p: PublicStaff) => {
  const roles = p.responsibilities.flatMap(r => r.specialisations).join(' ');
  const result: string[] = [];
  if (p.role === 'COACH' || /COACH|STRENGTH|ANALYST/.test(roles)) result.push('coaching');
  if (/PHYSIO|MEDICAL|NUTRITION|WELFARE/.test(roles)) result.push('care');
  if (/REFEREE/.test(roles)) result.push('officials');
  if (/MANAGER|SECRETARY|FINANCE|EQUIPMENT|SCOUT/.test(roles) || ['OWNER','CLUB_ADMIN'].includes(p.role) || !result.length) result.push('operations');
  return result;
};
export function TabPeople({ clubId, clubName, isOwnClubAdmin }: { clubId: number; clubName: string; isOwnClubAdmin: boolean; onOpenManageClub?: (tab: ClubManagementTab) => void }) {
  const [params, setParams] = useClubProfileSearchParams();
  const search = params.get('q') ?? '', squad = params.get('squad') ?? '', area = params.get('staff') ?? '';
  const [result, setResult] = useState<{ scope: string; people: PublicStaff[]; error: boolean } | null>(null), [attempt, setAttempt] = useState(0);
  const scope = `${clubId}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    void apiClient.get<PublicStaff[]>(`/clubs/${clubId}/staff-directory`, { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setResult({ scope, people: r.data, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ scope, people: [], error: true }); });
    return () => controller.abort();
  }, [clubId, scope]);
  const people = useMemo(() => result?.scope === scope ? result.people : [], [result, scope]);
  const squads = [...new Map(people.flatMap(p => p.responsibilities.filter(r => r.squadId != null).map(r => [r.squadId!, r.squadName ?? 'Training group'] as const))).entries()];
  const filtered = people.filter(p => staffMatchesSquad(p, squad) && (!area || staffAreas(p).includes(area)) && `${p.fullName} ${staffTitle(p)} ${p.responsibilities.map(r => `${r.title} ${r.squadName ?? ''} ${r.specialisations.join(' ')}`).join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const filter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const clear = () => { const next = new URLSearchParams(params); ['q','squad','staff'].forEach(k => next.delete(k)); setParams(next, { replace: true }); };
  return <section className="club-public"><header className="cp-heading"><div className="cp-heading-title"><span className="cp-section-icon" data-tone="blue"><Users size={26}/></span><div><p className="cp-eyebrow">The people behind the club</p><h2>Coaches & staff</h2><p>Find the people who coach, support and organise life at {clubName}.</p></div></div>{isOwnClubAdmin && <Link className="cp-button" to={`/clubs/${clubId}/workspace?tab=staff-duties`}>Manage staff<ArrowRight size={16}/></Link>}</header>
    {result?.scope !== scope ? <p role="status">Loading staff…</p> : result.error ? <p role="alert">The staff directory could not load. <button type="button" className="cp-text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></p> : <>
      {people.length > 0 && <><div className="cp-filter-tabs" aria-label="Staff responsibilities">{areas.filter(a => !a.id || people.some(p => staffAreas(p).includes(a.id))).map(a => <button key={a.id} type="button" aria-pressed={area === a.id} onClick={() => filter('staff', a.id)}>{a.name}<span>{people.filter(p => !a.id || staffAreas(p).includes(a.id)).length}</span></button>)}</div><div className="cp-finder"><label><Search size={17}/><input aria-label="Find a coach or responsibility" placeholder="Name, responsibility or training group" value={search} onChange={e => filter('q', e.target.value)}/></label><select aria-label="Staff training group" value={squad} onChange={e => filter('squad', e.target.value)}><option value="">All training groups</option>{squad && !squads.some(([id]) => String(id) === squad) && <option value={squad}>Selected training group</option>}{squads.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>{(search || squad || area) && <button className="cp-text-button" onClick={clear}>Clear filters</button>}</div>{squad && <p className="cp-filter-note">Staff assigned to this group, plus people working across the club.</p>}</>}
      {filtered.length === 0 ? <div className="cp-empty"><h3>{people.length ? 'No matching staff' : 'Meet the team soon'}</h3><p>{people.length ? 'Try a different name, responsibility or training group.' : 'The club has not published its staff directory yet.'}</p>{people.length > 0 && <button className="cp-button" onClick={clear}>Show everyone</button>}</div> : <div className="cp-staff-grid">{filtered.map(p => <article className="cp-card cp-person" data-area={staffAreas(p)[0]} key={p.userId}><div className="cp-person-header">{p.avatarUrl ? <MediaImage className="cp-avatar" src={resolveMediaUrl(p.avatarUrl)} alt=""/> : <span className="cp-avatar" aria-hidden="true">{p.fullName.split(' ').filter(n => n !== '·').slice(0,2).map(n => n[0]).join('')}</span>}<div><h3>{p.fullName}</h3><p className="cp-muted">{staffTitle(p)}</p></div></div>{p.responsibilities.length > 0 && <ul aria-label="Published responsibilities">{p.responsibilities.map((r, i) => <li key={`${r.title}-${r.squadId}-${i}`}><strong>{r.title}</strong><span>{r.squadName ?? 'Across the club'}{r.endsOn ? ` · Until ${r.endsOn}` : ''}</span></li>)}</ul>}{p.bio && <details className="cp-person-bio"><summary>About {p.fullName}</summary><p className="cp-muted cp-prose">{p.bio}</p></details>}<Link to={`/profile/${p.userId}`} className="cp-link-label">View profile<ArrowRight size={16}/></Link></article>)}</div>}
    </>}
  </section>;
}
