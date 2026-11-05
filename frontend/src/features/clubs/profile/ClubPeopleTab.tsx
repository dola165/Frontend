import { Link } from 'react-router-dom';
import { ArrowRight, Network } from 'lucide-react';
import { useClubProfileSearchParams } from '../clubProfilePreviewContext';
import { Button, EmptyNote, Panel, Skeleton } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { staffMatchesSquad, staffTitle, type PublicResponsibility, type PublicStaff } from '../publicJourney';
import { responsibilityAreas, staffAreas } from '../staffAreas';
import { useOverviewSource } from '../useOverviewSource';
import { usePagesCopy } from '../../pages/copy';
import { useAction } from '../../actions/useAction';

const areas = [{ id: 'coaching', name: 'Coaching' }, { id: 'analysis', name: 'Analysis & scouting' }, { id: 'performance', name: 'Sports science' }, { id: 'care', name: 'Medical & player care' }, { id: 'operations', name: 'Club operations' }, { id: 'officials', name: 'Match officials' }];

/** Compact structure from TabPeople before e95e2445: departments describe contributions, never reporting lines. */
function Person({ person, area }: { person: PublicStaff; area: string }) {
    const t = usePagesCopy();
    const appointments = person.responsibilities.filter(r => responsibilityAreas(r.specialisations, r.title).includes(area));
    const scope = (r: PublicResponsibility) => r.clubWide ? t('Across the club') : r.squadNames?.length ? r.squadNames.join(' · ') : r.squadName ?? t('Across the club');
    return <article className="gk-staff-person">
        <Crest src={person.avatarUrl} name={person.fullName} size={32} round />
        <div>
            <Link className="gk-staff-person__name" to={`/profile/${person.userId}`}>{person.fullName}<ArrowRight aria-hidden="true" size={13} /></Link>
            <p className="gk-muted">{appointments.length ? [...new Set(appointments.map(r => r.title))].join(' · ') : t(staffTitle(person))}</p>
            {(appointments.length > 0 || person.bio) && <details>
                <summary>{t('Details')}</summary>
                {appointments.length > 0 && <ul className="gk-staff-responsibilities" aria-label={t('Published responsibilities')}>{appointments.map((r, i) => <li key={`${r.title}-${i}`}>
                    <strong>{r.title}</strong><span>{scope(r)}</span>{r.endsOn && <small>{t('Until {date}', { date: r.endsOn })}</small>}
                </li>)}</ul>}
                {person.bio && <p>{person.bio}</p>}
                {appointments.some(r => r.provenance === 'RECORDED_APPOINTMENT') && <p className="gk-muted">{t('Recorded club appointments · published by the staff member.')}</p>}
            </details>}
        </div>
    </article>;
}

export function ClubPeopleTab({ clubId, clubName, canManageStaff }: { clubId: number; clubName?: string; canManageStaff: boolean }) {
    const t = usePagesCopy();
    const [params, setParams] = useClubProfileSearchParams();
    const people = useOverviewSource<PublicStaff[]>(`/clubs/${clubId}/staff-directory`);
    // One action, many doors: the staff link opens over the club page too, once the rule-checker allows it.
    const invite = useAction('invite_staff', { kind: 'club', id: clubId }, { fallback: canManageStaff });
    const inviteStaff = !invite.loading && invite.href;
    const query = (params.get('q') ?? '').trim().toLocaleLowerCase(), squad = params.get('squad') ?? '', area = params.get('staff') ?? '';
    const all = people.data ?? [];
    const filter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
    const clear = () => { const next = new URLSearchParams(params); ['q', 'squad', 'staff'].forEach(k => next.delete(k)); setParams(next, { replace: true }); };
    const squads = [...new Map(all.flatMap(p => p.responsibilities.flatMap(r => (r.squadIds ?? (r.squadId == null ? [] : [r.squadId])).map((id, i) => [id, r.squadNames?.[i] ?? r.squadName ?? t('Training group')] as const)))).entries()];
    const filtered = all.filter(p => staffMatchesSquad(p, squad) && (!area || staffAreas(p).includes(area))
        && `${p.fullName} ${staffTitle(p)} ${p.responsibilities.map(r => `${r.title} ${r.squadNames?.join(' ') ?? r.squadName ?? ''} ${r.specialisations.join(' ')}`).join(' ')}`.toLocaleLowerCase().includes(query));
    const departments = areas.filter(a => !area || a.id === area).map(a => ({ ...a, members: filtered.filter(p => staffAreas(p).includes(a.id)) })).filter(a => a.members.length);
    return <>
        {(all.length > 0 || canManageStaff) && <div className="gk-club-toolbar" role="search">
            {all.length > 0 && <>
                <div className="gk-chips" aria-label={t('Departments')}>
                    <button type="button" className="gk-chip" aria-pressed={!area} onClick={() => filter('staff', '')}>{t('Everyone')}<span className="gk-faint">{all.length}</span></button>
                    {areas.filter(a => all.some(p => staffAreas(p).includes(a.id))).map(a => <button key={a.id} type="button" className="gk-chip" aria-pressed={area === a.id} onClick={() => filter('staff', a.id)}>{t(a.name)}<span className="gk-faint">{all.filter(p => staffAreas(p).includes(a.id)).length}</span></button>)}
                </div>
                <input className="gk-input" aria-label={t('Find a coach or responsibility')} placeholder={t('Name, responsibility or squad')} value={params.get('q') ?? ''} onChange={e => filter('q', e.target.value)} />
                <select className="gk-input gk-club-select" aria-label={t('Squad')} value={squad} onChange={e => filter('squad', e.target.value)}><option value="">{t('All squads')}</option>{squad && !squads.some(([id]) => String(id) === squad) && <option value={squad}>{t('Selected squad')}</option>}{squads.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>
            </>}
            {(query || squad || area) && <button type="button" className="gk-section__action" onClick={clear}>{t('Clear')}</button>}
            {inviteStaff && <Link className="gk-section__action" to={inviteStaff}>{t('Invite staff')}</Link>}
            {canManageStaff && <a className="gk-section__action" href={`/clubs/${clubId}?edit=1&panel=staff`}>{t('Manage staff')}</a>}
        </div>}
        {people.loading ? <Panel flush><div className="gk-panel--pad"><Skeleton height={80} /></div></Panel>
            : people.failed ? <Panel flush><EmptyNote title={t('The staff directory couldn’t load')} action={<Button size="sm" onClick={people.retry}>{t('Try again')}</Button>} /></Panel>
            : !filtered.length ? <Panel flush><EmptyNote title={t(all.length ? 'No matching staff' : 'No staff published yet')} action={all.length ? <Button size="sm" onClick={clear}>{t('Show everyone')}</Button> : undefined}>{t(all.length ? 'Try a different name, responsibility or squad.' : 'The club has not published who works here yet.')}</EmptyNote></Panel>
            : <div className="gk-staff-structure">
                <div className="gk-staff-structure__root"><Network aria-hidden="true" size={20} /><strong>{clubName ?? t('Coaches & staff')}</strong></div>
                <p className="gk-muted gk-club-note">{t('Grouped by published responsibilities. People may contribute to more than one department.')}</p>
                <div className="gk-staff-departments">{departments.map(d => <section className="gk-staff-department" key={d.id} aria-label={t(d.name)}>
                    <header><h3>{t(d.name)}</h3><span className="gk-muted">{d.members.length}</span></header>
                    {d.members.map(p => <Person key={p.userId} person={p} area={d.id} />)}
                </section>)}</div>
            </div>}
    </>;
}
