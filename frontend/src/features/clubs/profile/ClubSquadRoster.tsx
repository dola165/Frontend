import { MatchHistoryLink } from '../../matchHistory/MatchHistoryLink';
import { buildLoginPath } from '../../../utils/authRedirect';
import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Button, ButtonLink, EmptyNote, Panel, Section, Skeleton } from '../../../design/primitives';
import { SquadRosterTable, type SquadRosterGroup } from '../../../components/squads/SquadRosterTable';
import { SquadRosterGrid } from '../../../components/squads/SquadRosterGrid';
import { usePersistedState } from '../../../utils/usePersistedState';
import { useOverviewSource } from '../useOverviewSource';
import '../../../components/squads/squad-design.css';

export function ClubSquadRoster({ clubId, squadId, canManage }: { clubId: number; squadId: number; canManage: boolean }) {
    const { sessionId, isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Section boxed title="Players"><EmptyNote title="Sign in to see player profiles" action={<ButtonLink to={buildLoginPath(`/clubs/${clubId}?tab=teams&squad=${squadId}`)}>Sign in</ButtonLink>} /></Section>;
    return <Roster key={`${sessionId}:${clubId}:${squadId}`} clubId={clubId} squadId={squadId} canManage={canManage && isAuthenticated} />;
}
function Roster({ clubId, squadId, canManage }: { clubId: number; squadId: number; canManage: boolean }) {
    const roster = useOverviewSource<SquadRosterGroup[]>(`/clubs/${clubId}/squads/${squadId}/roster`);
    const [search, setSearch] = useState(''), [position, setPosition] = useState('');
    const [cards, setCards] = usePersistedState('gkz:roster:cardView', false);
    const groups = roster.data ?? [];
    const players = groups.flatMap(group => group.players);
    const positions = [...new Set(players.map(player => player.position).filter(Boolean))];
    const query = search.trim().toLocaleLowerCase();
    const filtered = groups.map(group => ({ ...group, players: group.players.filter(player =>
        (!position || player.position === position) && (!query || `${player.name} ${player.number ?? ''}`.toLocaleLowerCase().includes(query))) }));
    return <Section boxed title="Players" action={canManage ? <ButtonLink size="sm" to={`/clubs/${clubId}/workspace?tab=squads&squad=${squadId}`}>Manage roster</ButtonLink> : undefined}>
        <MatchHistoryLink clubId={clubId} squadId={squadId} />
        <Panel flush>
            {roster.loading ? <div role="status"><Skeleton height={100} /></div> : roster.failed ? <EmptyNote title="Could not load this roster" action={<Button onClick={roster.retry}>Try again</Button>} /> : <div className="squad-design">
                <div className="gk-club-toolbar">
                    <input className="gk-input" aria-label="Search players or shirt number" placeholder="Search players or shirt number" value={search} onChange={e => setSearch(e.target.value)} />
                    <select className="gk-input" aria-label="Position" value={position} onChange={e => setPosition(e.target.value)}><option value="">All positions</option>{positions.map(value => <option key={value!} value={value!}>{value}</option>)}</select>
                    <Button aria-pressed={!cards} onClick={() => setCards(false)}>Roster</Button><Button aria-pressed={cards} onClick={() => setCards(true)}>Cards</Button>
                    {(search || position) && <Button onClick={() => { setSearch(''); setPosition(''); }}>Clear filters</Button>}
                </div>
                {cards ? <SquadRosterGrid groups={filtered} editable={false} showManagementDetails={false} /> : <SquadRosterTable groups={filtered} editable={false} showManagementDetails={false} />}
            </div>}
        </Panel>
    </Section>;
}
