import { ArrowRight } from 'lucide-react';
import { useClubProfileSearchParams } from '../clubProfilePreviewContext';
import { Button, EmptyNote, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { staffMatchesSquad, staffTitle, type PublicResponsibility, type PublicStaff } from '../publicJourney';
import { responsibilityAreas, staffAreas } from '../staffAreas';
import { useOverviewSource } from '../useOverviewSource';

const areas = [{ id: 'coaching', name: 'Coaching' }, { id: 'analysis', name: 'Analysis & scouting' }, { id: 'performance', name: 'Sports science' }, { id: 'care', name: 'Medical & player care' }, { id: 'operations', name: 'Club operations' }, { id: 'officials', name: 'Match officials' }];
const scopeLabel = (r: PublicResponsibility) => r.clubWide ? 'Across the club' : r.squadNames?.length ? r.squadNames.join(' & ') : r.squadName ?? 'Across the club';
/** "Head of Coaching · U14 & U16 Boys": what the person does in this department, and where. */
function personLine(person: PublicStaff, area?: string) {
    const items = area ? person.responsibilities.filter(r => responsibilityAreas(r.specialisations).includes(area)) : person.responsibilities;
    if (!items.length) return staffTitle(person);
    const titles = [...new Set(items.map(r => r.title))].join(' · ');
    const scopes = [...new Set(items.map(scopeLabel))].join(' · ');
    return `${titles} · ${scopes}`;
}

/** Everyone the club has published, one list per department, each person one line that opens their profile. */
export function ClubPeopleTab({ clubId, canManageStaff }: { clubId: number; canManageStaff: boolean }) {
    const [params, setParams] = useClubProfileSearchParams();
    const people = useOverviewSource<PublicStaff[]>(`/clubs/${clubId}/staff-directory`);
    const query = (params.get('q') ?? '').trim().toLocaleLowerCase(), squad = params.get('squad') ?? '', area = params.get('staff') ?? '';
    const all = people.data ?? [];
    const filter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
    const clear = () => { const next = new URLSearchParams(params); ['q', 'squad', 'staff'].forEach(k => next.delete(k)); setParams(next, { replace: true }); };
    const squads = [...new Map(all.flatMap(p => p.responsibilities.flatMap(r => (r.squadIds ?? (r.squadId == null ? [] : [r.squadId])).map((id, i) => [id, r.squadNames?.[i] ?? r.squadName ?? 'Training group'] as const)))).entries()];
    const filtered = all.filter(p => staffMatchesSquad(p, squad) && (!area || staffAreas(p).includes(area))
        && `${p.fullName} ${staffTitle(p)} ${p.responsibilities.map(r => `${r.title} ${r.squadNames?.join(' ') ?? r.squadName ?? ''} ${r.specialisations.join(' ')}`).join(' ')}`.toLocaleLowerCase().includes(query));
    const departments = areas.filter(a => !area || a.id === area).map(a => ({ ...a, members: filtered.filter(p => staffAreas(p).includes(a.id)) })).filter(a => a.members.length);
    const other = filtered.filter(p => !staffAreas(p).length);
    const row = (p: PublicStaff, department?: string) => <ListRow key={p.userId} to={`/profile/${p.userId}`} lead={<Crest src={p.avatarUrl} name={p.fullName} size={36} round />}
        title={p.fullName} meta={personLine(p, department)} trail={<ArrowRight aria-hidden="true" className="gk-faint" size={16} />} />;

    return <>
        {all.length > 0 && <div className="gk-club-toolbar" role="search">
            <div className="gk-chips" aria-label="Departments">
                <button type="button" className="gk-chip" aria-pressed={!area} onClick={() => filter('staff', '')}>Everyone<span className="gk-faint">{all.length}</span></button>
                {areas.filter(a => all.some(p => staffAreas(p).includes(a.id))).map(a => <button key={a.id} type="button" className="gk-chip" aria-pressed={area === a.id} onClick={() => filter('staff', a.id)}>{a.name}<span className="gk-faint">{all.filter(p => staffAreas(p).includes(a.id)).length}</span></button>)}
            </div>
            <input className="gk-input" aria-label="Find a coach or responsibility" placeholder="Name, responsibility or squad" value={params.get('q') ?? ''} onChange={e => filter('q', e.target.value)} />
            <select className="gk-input gk-club-select" aria-label="Squad" value={squad} onChange={e => filter('squad', e.target.value)}><option value="">All squads</option>{squad && !squads.some(([id]) => String(id) === squad) && <option value={squad}>Selected squad</option>}{squads.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>
            {(query || squad || area) && <button type="button" className="gk-section__action" onClick={clear}>Clear</button>}
            {canManageStaff && <a className="gk-section__action" href={`/clubs/${clubId}/workspace?tab=staff-duties`}>Manage staff</a>}
        </div>}
        {people.loading ? <Panel flush><div className="gk-panel--pad"><Skeleton height={48} /></div></Panel>
            : people.failed ? <Panel flush><EmptyNote title="The staff directory couldn’t load" action={<Button size="sm" onClick={people.retry}>Try again</Button>} /></Panel>
            : !filtered.length ? <Panel flush><EmptyNote title={all.length ? 'No matching staff' : 'No staff published yet'} action={all.length ? <Button size="sm" onClick={clear}>Show everyone</Button> : undefined}>{all.length ? 'Try a different name, responsibility or squad.' : 'The club has not published who works here yet.'}</EmptyNote></Panel>
            : <>
                {departments.map(d => <Section key={d.id} boxed title={d.name} hint={`${d.members.length} ${d.members.length === 1 ? 'person' : 'people'}`}>
                    <Panel flush><List label={d.name}>{d.members.map(p => row(p, d.id))}</List></Panel>
                </Section>)}
                {other.length > 0 && <Section boxed title="Club staff" hint={`${other.length} ${other.length === 1 ? 'person' : 'people'}`}>
                    <Panel flush><List label="Club staff">{other.map(p => row(p))}</List></Panel>
                </Section>}
            </>}
    </>;
}
