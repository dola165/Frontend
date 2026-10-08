import { ClubPreviewQueryContext, useClubProfileSearchParams } from '../../../features/clubs/clubProfilePreviewContext';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Search, LayoutGrid, List, Network } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { MediaImage } from '../../ui/MediaImage';
import { staffMatchesSquad, staffTitle, type PublicStaff, type PublicResponsibility } from '../../../features/clubs/publicJourney';
import type { ClubManagementTab } from '../ClubManagementModal';
import '../club-public.css';
import '../club-profile-refinement.css';

const areas = [{ id: '', name: 'Everyone' }, { id: 'coaching', name: 'Coaching' }, { id: 'analysis', name: 'Analysis & scouting' }, { id: 'performance', name: 'Sports science' }, { id: 'care', name: 'Medical & player care' }, { id: 'operations', name: 'Club operations' }, { id: 'officials', name: 'Match officials' }];
const responsibilityAreas = (codes: string[]) => {
  const roles = codes.join(' '), result: string[] = [];
  if (/COACH|STRENGTH/.test(roles)) result.push('coaching');
  if (/ANALYST|ANALYSIS|SCOUT/.test(roles)) result.push('analysis');
  if (/SPORTS_SCIEN|STRENGTH|NUTRITION|PERFORMANCE_DIRECTOR/.test(roles)) result.push('performance');
  if (/PHYSIO|MEDICAL|THERAP|REHABILITATION|NUTRITION|WELFARE/.test(roles)) result.push('care');
  if (/REFEREE/.test(roles)) result.push('officials');
  if (/MANAGER|SECRETARY|FINANCE|EQUIPMENT|EDUCATION|TEAM_SUPPORT/.test(roles) || !result.length) result.push('operations');
  return result;
};
const staffAreas = (person: PublicStaff) => person.responsibilities.length
  ? [...new Set(person.responsibilities.flatMap(r => responsibilityAreas(r.specialisations)))]
  : person.role === 'COACH' ? ['coaching'] : ['operations'];
const scopeLabel = (r: PublicResponsibility) => r.clubWide ? 'Across the club' : r.squadNames?.length ? r.squadNames.join(' · ') : r.squadName ?? 'Across the club';
function Avatar({ person }: { person: PublicStaff }) {
  return person.avatarUrl ? <MediaImage className="cp-avatar" src={resolveMediaUrl(person.avatarUrl)} alt=""/> : <span className="cp-avatar" aria-hidden="true">{person.fullName.split(' ').filter(n => n !== '·').slice(0, 2).map(n => n[0]).join('')}</span>;
}
function Responsibilities({ items }: { items: PublicResponsibility[] }) {
  return <ul className="cp-responsibilities" aria-label="Published responsibilities">{items.map((r, i) => <li key={`${r.title}-${i}`}><strong>{r.title}</strong><span>{scopeLabel(r)}</span>{r.endsOn && <small>Until {r.endsOn}</small>}</li>)}</ul>;
}
function PersonRow({ person, department, compact = false }: { person: PublicStaff; department?: string; compact?: boolean }) {
  const appointments = department ? person.responsibilities.filter(r => responsibilityAreas(r.specialisations).includes(department)) : person.responsibilities;
  if (compact) return <article className="cp-structure-person"><Avatar person={person}/><div className="cp-staff-row-content"><Link className="cp-person-name" to={`/profile/${person.userId}`}>{person.fullName}<ArrowRight size={13}/></Link><p className="cp-structure-role">{appointments.length ? [...new Set(appointments.map(r => r.title))].join(' · ') : staffTitle(person)}</p>{(appointments.length > 0 || person.bio) && <details className="cp-structure-details"><summary>Details</summary>{appointments.length > 0 && <Responsibilities items={appointments}/>}<p className="cp-prose">{person.bio}</p>{appointments.some(r => r.provenance === 'RECORDED_APPOINTMENT') && <p>Recorded club appointments · published by the staff member.</p>}</details>}</div></article>;
  return <article className="cp-staff-row"><Avatar person={person}/><div className="cp-staff-row-content"><Link className="cp-person-name" to={`/profile/${person.userId}`}>{person.fullName}<ArrowRight size={14}/></Link>{appointments.length ? <Responsibilities items={appointments}/> : <p className="cp-muted">{staffTitle(person)}</p>}{(person.bio || appointments.some(r => r.provenance === 'RECORDED_APPOINTMENT')) && <details className="cp-person-bio"><summary>About & appointments</summary>{person.bio && <p className="cp-prose">{person.bio}</p>}{appointments.some(r => r.provenance === 'RECORDED_APPOINTMENT') && <p className="cp-muted">Recorded club appointments · published by the staff member.</p>}</details>}</div></article>;
}
export function TabPeople({ clubId, clubName, isOwnClubAdmin }: { clubId: number; clubName: string; isOwnClubAdmin: boolean; onOpenManageClub?: (tab: ClubManagementTab) => void }) {
  const embedded = useContext(ClubPreviewQueryContext) !== null;
  const [params, setParams] = useClubProfileSearchParams();
  const search = params.get('q') ?? '', squad = params.get('squad') ?? '', area = params.get('staff') ?? '';
  const savedView = params.get('staffView');
  const view = savedView === 'cards' || savedView === 'list' || savedView === 'structure' ? savedView : embedded ? 'list' : 'structure';
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
  const squads = [...new Map(people.flatMap(p => p.responsibilities.flatMap(r => (r.squadIds ?? (r.squadId == null ? [] : [r.squadId])).map((id, i) => [id, r.squadNames?.[i] ?? r.squadName ?? 'Training group'] as const)))).entries()];
  const filtered = people.filter(p => staffMatchesSquad(p, squad) && (!area || staffAreas(p).includes(area)) && `${p.fullName} ${staffTitle(p)} ${p.responsibilities.map(r => `${r.title} ${r.squadNames?.join(' ') ?? r.squadName ?? ''} ${r.specialisations.join(' ')}`).join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const filter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const clear = () => { const next = new URLSearchParams(params); ['q', 'squad', 'staff'].forEach(k => next.delete(k)); setParams(next, { replace: true }); };
  return <section className="club-public cp-people"><header className="cp-heading"><div className="cp-heading-title"><span className="cp-section-icon" data-tone="blue"><Users size={26}/></span><div><p className="cp-eyebrow">The people behind the club</p><h2>Coaches & staff</h2><p>Meet the people and see where they contribute at {clubName}.</p></div></div>{isOwnClubAdmin && <Link className="cp-button" to={`/clubs/${clubId}/workspace?tab=staff-duties`}>Manage staff<ArrowRight size={16}/></Link>}</header>
    {result?.scope !== scope ? <p role="status">Loading staff…</p> : result.error ? <p role="alert">The staff directory could not load. <button type="button" className="cp-text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></p> : <>
      {people.length > 0 && <><div className="cp-people-toolbar"><div className="cp-view-switch" aria-label="Staff view">{([{ id: 'structure', label: 'Structure', Icon: Network }, { id: 'cards', label: 'Cards', Icon: LayoutGrid }, { id: 'list', label: 'List', Icon: List }] as const).map(({ id, label, Icon }) => <button type="button" key={id} aria-pressed={view === id} onClick={() => filter('staffView', id)}><Icon size={15}/>{label}</button>)}</div><span className="cp-muted">{filtered.length} {filtered.length === 1 ? 'person' : 'people'}</span></div><div className="cp-filter-tabs" aria-label="Staff responsibilities">{areas.filter(a => !a.id || people.some(p => staffAreas(p).includes(a.id))).map(a => <button key={a.id} type="button" aria-pressed={area === a.id} onClick={() => filter('staff', a.id)}>{a.name}<span>{people.filter(p => !a.id || staffAreas(p).includes(a.id)).length}</span></button>)}</div><div className="cp-finder"><label><Search size={17}/><input aria-label="Find a coach or responsibility" placeholder="Name, responsibility or squad" value={search} onChange={e => filter('q', e.target.value)}/></label><select aria-label="Staff training group" value={squad} onChange={e => filter('squad', e.target.value)}><option value="">All squads</option>{squad && !squads.some(([id]) => String(id) === squad) && <option value={squad}>Selected squad</option>}{squads.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>{(search || squad || area) && <button className="cp-text-button" onClick={clear}>Clear filters</button>}</div>{squad && <p className="cp-filter-note">Staff assigned to this squad, plus people working across the club.</p>}</>}
      {!filtered.length ? <div className="cp-empty"><h3>{people.length ? 'No matching staff' : 'Meet the team soon'}</h3><p>{people.length ? 'Try a different name, responsibility or squad.' : 'The club has not published its staff directory yet.'}</p>{people.length > 0 && <button className="cp-button" onClick={clear}>Show everyone</button>}</div>
        : view === 'structure' ? <div className={`cp-staff-structure${embedded ? '' : ' cp-staff-structure-compact'}`}><div className="cp-structure-root"><Network size={23}/><div><h3>{clubName}</h3><p>Departments & responsibilities</p></div></div><p className="cp-structure-note">Grouped by published responsibilities. People may contribute to more than one department.</p><div className="cp-departments">{areas.filter(a => a.id && (!area || a.id === area)).map(a => { const members = filtered.filter(p => staffAreas(p).includes(a.id)); return members.length ? <section className="cp-department" data-area={a.id} key={a.id}><header><h3>{a.name}</h3><span>{members.length}</span></header>{members.map(person => <PersonRow key={person.userId} person={person} department={a.id} compact={!embedded}/>)}</section> : null; })}</div></div>
        : view === 'list' ? <div className="cp-staff-list">{filtered.map(person => <PersonRow key={person.userId} person={person}/>)}</div>
        : <div className="cp-staff-grid">{filtered.map(p => <article className="cp-card cp-person" data-area={staffAreas(p)[0]} key={p.userId}><div className="cp-person-header"><Avatar person={p}/><div><h3>{p.fullName}</h3><p className="cp-muted">{staffTitle(p)}</p></div></div>{p.responsibilities.length > 0 && <Responsibilities items={p.responsibilities}/>}<details className="cp-person-bio"><summary>About {p.fullName}</summary>{p.bio && <p className="cp-muted cp-prose">{p.bio}</p>}{p.responsibilities.some(r => r.provenance === 'RECORDED_APPOINTMENT') && <p className="cp-muted">Recorded club appointments · published by the staff member.</p>}</details><Link to={`/profile/${p.userId}`} className="cp-link-label">View profile<ArrowRight size={16}/></Link></article>)}</div>}
    </>}
  </section>;
}
