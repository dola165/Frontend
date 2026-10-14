import { ArrowRight, GraduationCap, Shield } from 'lucide-react';
import { TabTraining } from '../../../components/club/tabs/TabTraining';
import { useClubProfileSearchParams } from '../clubProfilePreviewContext';
import { Button, EmptyNote, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import { currentProgramme, money, programmeAge, programmePrice, type TrainingProgramme } from '../presentation';
import { programmeMatchesAge, squadLine, trainingPath, type ClubEnquiryContext, type PublicSquad } from '../publicJourney';
import { useOverviewSource } from '../useOverviewSource';
import { ClubSquadPage } from './ClubSquadPage';
import type { ClubProfile } from './types';

const feeText = (p: TrainingProgramme) => currentProgramme(p) ? programmePrice(p) : p.validFrom && p.validFrom > new Date().toLocaleDateString('en-CA') ? `Fees start ${p.validFrom}` : 'Ask for current fees';

/** The club's squads and its training options with fees, as two lists; opening one shows the squad or programme page. */
export function ClubTeamsTab({ club, refreshKey = 0, onContact, isAuthenticated, canManage = false }: { club: ClubProfile; refreshKey?: number; onContact: (context: ClubEnquiryContext) => void; isAuthenticated: boolean; canManage?: boolean }) {
    const [params, setParams] = useClubProfileSearchParams();
    const squads = useOverviewSource<PublicSquad[]>(`/clubs/${club.id}/squads${refreshKey ? `?r=${refreshKey}` : ''}`);
    const programmes = club.presentation?.programmes.filter(p => p.published) ?? [];
    const squadId = Number(params.get('squad'));
    if (squadId > 0 && !params.get('programme')) {
        const squad = squads.data?.find(s => s.id === squadId);
        if (squads.loading) return <Panel flush><div className="gk-panel--pad"><Skeleton height={120} /></div></Panel>;
        if (!squad) return <Panel flush><EmptyNote title="Squad unavailable" action={<Button size="sm" onClick={squads.retry}>Try again</Button>}>This squad may have changed. Browse the club’s current teams.</EmptyNote></Panel>;
        return <ClubSquadPage club={club} squad={squad} programmes={programmes.filter(p => p.squadIds?.includes(squad.id))} onContact={onContact} isAuthenticated={isAuthenticated} canManage={canManage} />;
    }
    if (params.get('programme')) return <TabTraining club={club} refreshKey={refreshKey} onContact={onContact} isAuthenticated={isAuthenticated} />;

    const age = /^\d{1,2}$/.test(params.get('age') ?? '') ? params.get('age')! : '', query = (params.get('q') ?? '').trim().toLocaleLowerCase();
    const filter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
    const clear = () => { const next = new URLSearchParams(params); next.delete('q'); next.delete('age'); setParams(next, { replace: true }); };
    const groupsOf = (p: TrainingProgramme) => (squads.data ?? []).filter(s => p.squadIds?.includes(s.id));
    const matchedSquads = (squads.data ?? []).filter(s => !query || `${s.name} ${squadLine(s)} ${programmes.filter(p => p.squadIds?.includes(s.id)).map(p => p.name).join(' ')}`.toLocaleLowerCase().includes(query));
    const matched = programmes.filter(p => programmeMatchesAge(p, age) && `${p.name} ${programmeAge(p)} ${groupsOf(p).map(s => s.name).join(' ')}`.toLocaleLowerCase().includes(query));
    const link = (options: { programme?: number; squad?: number }) => {
        const next = new URLSearchParams(new URL(trainingPath(club.id, options), window.location.origin).search);
        for (const key of ['age', 'q', 'player']) if (params.has(key)) next.set(key, params.get(key)!);
        return `/clubs/${club.id}?${next}`;
    };

    return <>
        <div className="gk-club-toolbar" role="search">
            <input className="gk-input" aria-label="Find a squad or programme" placeholder="Squad, age group or programme" value={params.get('q') ?? ''} onChange={e => filter('q', e.target.value)} />
            <select className="gk-input gk-club-select" aria-label="Player’s age" value={age} onChange={e => filter('age', e.target.value)}><option value="">Any age</option>{Array.from({ length: 22 }, (_, i) => i + 3).map(n => <option key={n} value={n}>{n}</option>)}</select>
            {(age || query) && <button type="button" className="gk-section__action" onClick={clear}>Clear</button>}
        </div>
        <Section boxed title="Squads" hint={squads.data ? `${matchedSquads.length} of ${squads.data.length}` : undefined} action={club.presentation?.canEdit ? { label: 'Edit programmes', to: `/clubs/${club.id}?edit=1&panel=squads` } : undefined}>
            <Panel flush>{squads.loading ? <div className="gk-panel--pad"><Skeleton height={48} /></div>
                : squads.failed ? <EmptyNote title="The squads couldn’t load" action={<Button size="sm" onClick={squads.retry}>Try again</Button>} />
                : matchedSquads.length ? <List label="Squads">{matchedSquads.map(s => <ListRow key={s.id} to={link({ squad: s.id })}
                    lead={<span className="gk-club-icon gk-club-icon--info"><Shield aria-hidden="true" /></span>} title={s.name}
                    meta={[squadLine(s), programmes.filter(p => p.squadIds?.includes(s.id)).map(p => p.name).join(', ') || null].filter(Boolean).join(' · ')}
                    trail={<ArrowRight aria-hidden="true" className="gk-faint" size={16} />} />)}</List>
                : <EmptyNote title={squads.data?.length ? 'No matching squads' : 'No squads published yet'}>{squads.data?.length ? 'Try another name or clear the search.' : 'Ask the club about its training groups.'}</EmptyNote>}</Panel>
        </Section>
        {programmes.length > 0 && <Section boxed title="Training options and fees" hint={`${matched.length} of ${programmes.length}`}>
            <Panel flush>{matched.length ? <List label="Training programmes" className="gk-club-programmes">{matched.map((p, i) => <ListRow key={p.id ?? i} to={link({ programme: p.id })}
                lead={<span className="gk-club-icon"><GraduationCap aria-hidden="true" /></span>} title={p.name}
                meta={[programmeAge(p), p.sessionsPerWeek ? `${p.sessionsPerWeek} ${p.sessionsPerWeek === 1 ? 'session' : 'sessions'} a week` : null, groupsOf(p).map(s => s.name).join(', ') || null, p.trialAmount != null ? `Trial ${Number(p.trialAmount) === 0 ? 'free' : money(p.trialAmount, p.currency)}` : null].filter(Boolean).join(' · ')}
                trail={<span className="gk-club-price gk-num">{feeText(p)}</span>} />)}</List>
                : <EmptyNote title="No matching programmes">Try another search or ask the club about placement.</EmptyNote>}</Panel>
            {age && <p className="gk-muted gk-club-note">Published ages are a guide. The club confirms placement and competition eligibility.</p>}
        </Section>}
    </>;
}
