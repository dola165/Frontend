import { useClubProfileSearchParams } from '../../../features/clubs/clubProfilePreviewContext';
import { SquadTrainingSchedule } from '../../../features/clubs/SquadTrainingSchedule';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, GraduationCap, MapPin, Search, Shield, Users } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import type { ClubProfile } from '../../../pages/ClubProfilePage';
import { currentProgramme, programmeAge, programmePrice, money, type TrainingProgramme } from '../../../features/clubs/presentation';
import { programmeMatchesAge, trainingPath, type ClubEnquiryContext, type PublicSquad } from '../../../features/clubs/publicJourney';
import '../club-public.css';
import '../club-profile-refinement.css';
import { TrainingVenues } from '../TrainingVenues';
import '../../chat/joining-conversation.css';
import { ClubJoiningActions } from '../ClubJoiningActions';

const readable = (value?: string) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : 'Ask about the group';
const feeText = (p: TrainingProgramme) => currentProgramme(p) ? programmePrice(p) : p.validFrom && p.validFrom > new Date().toLocaleDateString('en-CA') ? `Fees start ${p.validFrom}` : 'Ask for current fees';

export function TabTraining({ club, refreshKey = 0, onContact, isAuthenticated = false }: { club: ClubProfile; refreshKey?: number; onContact: (context: ClubEnquiryContext) => void; isAuthenticated?: boolean }) {
  const [params, setParams] = useClubProfileSearchParams();
  const selection = `${params.get('programme') || ''}:${params.get('squad') || ''}`;
  const priorSelection = useRef(selection), listPosition = useRef<{ y: number; href: string } | null>(null);
  useLayoutEffect(() => {
    if (priorSelection.current !== selection) {
      if (selection === ':' && listPosition.current) {
        Array.from(document.querySelectorAll<HTMLAnchorElement>('.cp-offer, .cp-team-row')).find(a => a.href === listPosition.current?.href)?.focus({ preventScroll: true });
      }
    }
    priorSelection.current = selection;
  }, [selection]);
  const selectTraining = (options: { programme?: number; squad?: number } = {}) => {
    const next = new URLSearchParams(new URL(trainingPath(club.id, options), window.location.origin).search);
    for (const key of ['age', 'q', 'player']) if (params.has(key)) next.set(key, params.get(key)!);
    return `/clubs/${club.id}?${next}`;
  };
  const [result, setResult] = useState<{ scope: string; squads: PublicSquad[]; failed: boolean } | null>(null), [attempt, setAttempt] = useState(0);
  const scope = `${club.id}:${refreshKey}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    void apiClient.get<PublicSquad[]>(`/clubs/${club.id}/squads`, { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setResult({ scope, squads: r.data, failed: false }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ scope, squads: [], failed: true }); });
    return () => controller.abort();
  }, [club.id, scope]);
  const programmes = club.presentation?.programmes.filter(p => p.published) ?? [];
  const selected = params.get('programme'), group = params.get('squad');
  const programme = programmes.find(p => String(p.id) === selected);
  const base = selectTraining(), loading = result?.scope !== scope;
  const squads = !loading ? result.squads : [], squad = squads.find(s => String(s.id) === group);
  const groupLinks = (ids?: number[]) => squads.filter(s => ids?.includes(s.id));
  const updateFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const age = /^\d{1,2}$/.test(params.get('age') ?? '') ? params.get('age')! : '', query = params.get('q') ?? '';
  const matched = programmes.filter(p => programmeMatchesAge(p, age) && `${p.name} ${programmeAge(p)} ${groupLinks(p.squadIds).map(s => s.name).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const matchedSquads = squads.filter(s => !query.trim() || (s.name + " " + s.category + " " + programmes.filter(p => p.squadIds?.includes(s.id)).map(p => p.name).join(" ")).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const programmeCards = (offers: TrainingProgramme[]) => <div className="cp-programme-options">{offers.map(p => <Link key={p.id} to={selectTraining({ programme: p.id })} onClick={e => { if (selection === ':' ) listPosition.current = { y: window.scrollY, href: e.currentTarget.href }; }} className="cp-offer cp-programme-option">
    <span className="cp-section-icon" data-tone="green"><GraduationCap size={23}/></span><div className="cp-option-copy"><div className="cp-option-title"><h3>{p.name}</h3><span className="cp-tag">{programmeAge(p)}</span></div><p className="cp-option-description">{p.details || 'Ask the club about the training approach and the right level for you.'}</p><div className="cp-option-meta"><span><Clock3 size={14}/>{p.sessionsPerWeek ? `${p.sessionsPerWeek} ${p.sessionsPerWeek === 1 ? 'session' : 'sessions'} / week` : 'Timetable on request'}</span><span><Users size={14}/>{groupLinks(p.squadIds).map(s => s.name).join(' · ') || 'Group arranged with the club'}</span></div></div>
    <div className="cp-option-price"><strong>{feeText(p)}</strong>{currentProgramme(p) && p.priceType !== 'UNPUBLISHED' && p.trialAmount != null && <small>{Number(p.trialAmount) === 0 ? 'Trial: no charge' : `Trial: ${money(p.trialAmount, p.currency)}`}</small>}<span className="cp-link-label">Programme details<ArrowRight size={16}/></span></div>
  </Link>)}</div>;
  const connections = (ids: number[], name?: string) => <section className="cp-card cp-visit-panel"><div className="cp-card-heading"><span className="cp-section-icon" data-tone="amber"><MapPin size={21}/></span><div><h3>Before your first visit</h3><p>Agree a session with the club, then check where to go.</p></div></div><div className="cp-journey-links">
    <Link data-tone="amber" to={`/clubs/${club.id}?tab=facilities${ids.length === 1 ? `&squad=${ids[0]}` : ''}`}><MapPin size={19}/><span><strong>Find the training ground</strong><small>Directions, arrival and collection</small></span><ArrowRight size={17}/></Link>
    <Link data-tone="blue" to={`/clubs/${club.id}?tab=people${ids.length === 1 ? `&squad=${ids[0]}` : ''}`}><Users size={19}/><span><strong>{name ? `People helping ${name}` : 'Meet the coaches & staff'}</strong><small>Published roles and squad responsibilities</small></span><ArrowRight size={17}/></Link>
    <Link data-tone="violet" to={`/clubs/${club.id}?tab=schedule${ids.length === 1 ? `&squad=${ids[0]}&kind=training` : ''}`}><CalendarDays size={19}/><span><strong>{ids.length === 1 ? 'Squad schedule' : 'Club schedule'}</strong><small>{ids.length === 1 ? 'Training dates, times and session details' : 'Matches and training across the club'}</small></span><ArrowRight size={17}/></Link>
  </div></section>;
  if (selected && !programme) return <section className="club-public"><Link to={base} className="cp-back"><ArrowLeft size={16}/>Training & teams</Link><div className="cp-empty"><h2>Programme unavailable</h2><p>This programme may have been unpublished. Browse the current training options or contact the club.</p></div></section>;
  if (programme) {
    const assigned = groupLinks(programme.squadIds), current = currentProgramme(programme);
    const enquiry = { name: programme.name, path: trainingPath(club.id, { programme: programme.id }), squadIds: programme.squadIds ?? [] };
    return <section className="club-public cp-programme"><Link to={base} className="cp-back"><ArrowLeft size={16}/>All training & teams</Link>
      <header className="cp-detail-heading" data-tone="green"><span className="cp-section-icon"><GraduationCap size={28}/></span><div><p className="cp-eyebrow">Training at {club.name}</p><h2>{programme.name}</h2><div className="cp-meta"><span><Users size={15}/>{programmeAge(programme)}</span><span><Clock3 size={15}/>{programme.sessionsPerWeek ? `${programme.sessionsPerWeek} ${programme.sessionsPerWeek === 1 ? 'session' : 'sessions'} per week` : 'Ask about the timetable'}</span></div></div><button className="cp-button cp-button-primary" onClick={()=>onContact({...enquiry,intent:"visit"})}>Arrange a first visit<ArrowRight size={17}/></button></header>
      <div className="cp-detail-grid"><div className="cp-stack"><TrainingVenues clubId={club.id} squadIds={programme.squadIds??[]}/>
        <section className="cp-card"><h3>About the training</h3><p className="cp-prose">{programme.details || 'Speak to the club about the training approach, experience level and what is included.'}</p>
          <div className="cp-group-section"><h4>Training groups</h4>{loading ? <p role="status">Loading training groups…</p> : result?.failed ? <p role="alert">Training groups could not load. <button className="cp-text-button" onClick={() => setAttempt(v => v + 1)}>Retry</button></p> : assigned.length ? <div className="cp-group-links">{assigned.map(s => <Link key={s.id} to={selectTraining({ squad: s.id })} onClick={e => { if (selection === ':' ) listPosition.current = { y: window.scrollY, href: e.currentTarget.href }; }}><Shield size={17}/><span>{s.name}<small>{readable(s.gender)}</small></span><ArrowRight size={16}/></Link>)}</div> : <p className="cp-muted">The club has not linked squads to this programme. Confirm the right group before joining.</p>}</div>
        </section>{assigned.map(s=><SquadTrainingSchedule key={s.id} clubId={club.id} squadId={s.id}/>)}{connections(programme.squadIds ?? [])}
      </div><aside className="cp-stack"><section className="cp-card cp-fee-detail"><p className="cp-eyebrow">Fees for this programme</p><h3>{feeText(programme)}</h3>
        {(programme.validFrom || programme.validUntil) && <p className="cp-muted">{programme.validFrom ? `From ${programme.validFrom}` : ''}{programme.validUntil ? ` · Until ${programme.validUntil}` : ''}</p>}
        {current && programme.priceType !== 'UNPUBLISHED' && <dl>{([['Trial session', programme.trialAmount], ['Joining fee', programme.joiningFee], ['Equipment', programme.equipmentFee]] as const).filter(([, value]) => value != null).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{Number(value) === 0 ? 'No charge' : money(value!, programme.currency)}</dd></div>)}</dl>}
        <p className="cp-muted">{programmeAge(programme)}{assigned.length ? ` · ${assigned.map(s => s.name).join(', ')}` : ''}</p>
      </section><ClubJoiningActions clubId={club.id} context={enquiry} onContact={onContact}/></aside></div>
    </section>;
  }
  if (group) {
    if (loading) return <p role="status">Loading training group…</p>;
    if (result?.failed) return <div className="club-public cp-empty" role="alert"><p>The training groups could not load.</p><button className="cp-button" onClick={() => setAttempt(v => v + 1)}>Retry</button></div>;
    if (!squad) return <section className="club-public"><Link to={base} className="cp-back">All training & teams</Link><h2>Training group unavailable</h2><p>This group may have changed. Browse the club’s current teams.</p></section>;
    const offers = programmes.filter(p => p.squadIds?.includes(squad.id));
    return <section className="club-public cp-stack"><Link to={base} className="cp-back"><ArrowLeft size={16}/>All training & teams</Link><header className="cp-detail-heading" data-tone="blue"><span className="cp-section-icon"><Shield size={28}/></span><div><p className="cp-eyebrow">A team at {club.name}</p><h2>{squad.name}</h2><div className="cp-meta"><span>{squad.category}</span><span>{readable(squad.gender)}</span></div></div><button className="cp-button" onClick={() => onContact({ name: squad.name, path: trainingPath(club.id, { squad: squad.id }), squadIds: [squad.id] })}>Ask about this team<ArrowRight size={16}/></button></header>
      <nav className="cp-squad-shortcuts" aria-label="Explore this squad"><Link to={`/clubs/${club.id}/squads?squad=${squad.id}`}><Users size={22}/><span><strong>View roster</strong><small>{isAuthenticated ? 'Players, positions and squad profiles' : 'Squad overview · sign in for player profiles'}</small></span><ArrowRight size={17}/></Link><Link to={`/clubs/${club.id}?tab=schedule&squad=${squad.id}`}><CalendarDays size={22}/><span><strong>Squad schedule</strong><small>Matches and training</small></span><ArrowRight size={17}/></Link><Link to={`/clubs/${club.id}?tab=people&squad=${squad.id}`}><Users size={22}/><span><strong>Coaches & staff</strong><small>People supporting this squad</small></span><ArrowRight size={17}/></Link></nav>
      <SquadTrainingSchedule clubId={club.id} squadId={squad.id}/>
      <TrainingVenues clubId={club.id} squadIds={[squad.id]}/><ClubJoiningActions clubId={club.id} context={{name:squad.name,path:trainingPath(club.id,{squad:squad.id}),squadIds:[squad.id]}} onContact={onContact}/>
      {offers.length ? <section><div className="cp-section-heading"><h3>Training for this group</h3><span>{offers.length} {offers.length === 1 ? 'programme' : 'programmes'}</span></div>{programmeCards(offers)}</section> : <div className="cp-card"><h3>Training information</h3><p>The club has not published a programme for this team. Ask about its training and selection process.</p></div>}
      {connections([squad.id], squad.name)}<Link className="cp-back" to={`/clubs/${club.id}/squads?squad=${squad.id}`}>{isAuthenticated ? 'Open squad roster' : 'Sign in to view player profiles'}<ArrowRight size={16}/></Link>
    </section>;
  }
  return <section className="club-public cp-stack"><header className="cp-heading"><div className="cp-heading-title"><span className="cp-section-icon" data-tone="green"><GraduationCap size={26}/></span><div><p className="cp-eyebrow">Training & teams</p><h2>Teams at {club.name}</h2><p>Explore the squads, meet the players and staff, or find a place to train.</p></div></div>{club.presentation?.canEdit && <Link className="cp-button" to={`/clubs/${club.id}/profile-settings`}>Edit programmes<ArrowRight size={16}/></Link>}</header>
    <div className="cp-finder"><label><Search size={17}/><input aria-label="Find a squad or programme" placeholder="Squad, age group or programme" value={query} onChange={e => updateFilter('q', e.target.value)}/></label><label>Age for training<select aria-label="Player’s age" value={age} onChange={e => updateFilter('age', e.target.value)}><option value="">Any age</option>{Array.from({ length: 22 }, (_, i) => i + 3).map(n => <option key={n} value={n}>{n}</option>)}</select></label>{(age || query) && <button type="button" className="cp-text-button" onClick={() => { const next = new URLSearchParams(params); next.delete('q'); next.delete('age'); setParams(next, { replace: true }); }}>Clear filters</button>}</div>
    <section><div className="cp-section-heading"><div><p className="cp-eyebrow">Representing the club</p><h3>Our teams</h3></div><span>{matchedSquads.length} of {squads.length} squads</span></div>{loading ? <p role="status">Loading teams…</p> : result?.failed ? <p role="alert">Teams could not load. <button className="cp-text-button" onClick={() => setAttempt(v => v + 1)}>Retry</button></p> : matchedSquads.length ? <div className="cp-team-grid">{matchedSquads.map(s => <article className="cp-squad-card" key={s.id}><Link className="cp-team-row" key={s.id} to={selectTraining({ squad: s.id })} onClick={e => { if (selection === ':' ) listPosition.current = { y: window.scrollY, href: e.currentTarget.href }; }}><span className="cp-section-icon" data-tone="blue"><Shield size={20}/></span><span><strong>{s.name}</strong><small>{s.category} · {readable(s.gender)}</small><small className="fj-team-schedule">Squad overview & training</small></span><ArrowRight size={17}/></Link><div className="cp-squad-card-actions"><Link className="cp-text-button" to={`/clubs/${club.id}/squads?squad=${s.id}`}><Users size={15}/>View roster</Link><Link className="cp-text-button" to={`/clubs/${club.id}?tab=schedule&squad=${s.id}`}><CalendarDays size={15}/>Schedule</Link></div></article>)}</div> : <div className="cp-empty"><h3>{squads.length ? "No matching squads" : "Teams will appear here"}</h3><p>{squads.length ? "Try another squad name or clear the search." : "Contact the club about its training groups."}</p></div>}</section>
    {programmes.length > 0 && <section><div className="cp-section-heading"><div><p className="cp-eyebrow">For players looking to train</p><h3>Training options & fees</h3></div><span>{matched.length} of {programmes.length}</span></div>{matched.length ? programmeCards(matched) : <div className="cp-empty"><h3>No matching programmes</h3><p>Try another search or ask the club about placement.</p></div>}{age && <p className="cp-muted">Published ages are a guide. The club confirms placement and competition eligibility.</p>}</section>}

  </section>;
}

