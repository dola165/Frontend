import { MatchHistoryLink } from '../../matchHistory/MatchHistoryLink';
import { buildLoginPath } from '../../../utils/authRedirect';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { Button, ButtonLink, EmptyNote, Panel, Section, Skeleton } from '../../../design/primitives';
import { SquadRosterTable, type SquadRosterGroup } from '../../../components/squads/SquadRosterTable';
import { SquadRosterGrid } from '../../../components/squads/SquadRosterGrid';
import { squadLabel } from '../../../components/squads/squadLabels';
import { usePersistedState } from '../../../utils/usePersistedState';
import { useOverviewSource } from '../useOverviewSource';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import '../../../components/squads/squad-design.css';

export function ClubSquadRoster({ clubId, squadId }: { clubId: number; squadId: number }) {
    const { sessionId, isAuthenticated } = useAuth();
    const copy = useJourneyCopy();
    if (!isAuthenticated) return <Section boxed title={copy('Players', 'მოთამაშეები')}><EmptyNote title={copy('Sign in to see player profiles', 'მოთამაშეების პროფილების სანახავად შედით')} action={<ButtonLink to={buildLoginPath(`/clubs/${clubId}?tab=teams&squad=${squadId}`)}>{copy('Sign in', 'შესვლა')}</ButtonLink>} /></Section>;
    return <Roster key={`${sessionId}:${clubId}:${squadId}`} clubId={clubId} squadId={squadId} />;
}
function Roster({ clubId, squadId }: { clubId: number; squadId: number }) {
    const copy = useJourneyCopy();
    const { t } = useTranslation();
    const roster = useOverviewSource<SquadRosterGroup[]>(`/clubs/${clubId}/squads/${squadId}/roster`);
    const [search, setSearch] = useState(''), [position, setPosition] = useState('');
    const [cards, setCards] = usePersistedState('gkz:roster:cardView', false);
    const groups = roster.data ?? [];
    const players = groups.flatMap(group => group.players);
    const positions = [...new Set(players.map(player => player.position).filter(Boolean))];
    const query = search.trim().toLocaleLowerCase();
    const filtered = groups.map(group => ({ ...group, players: group.players.filter(player =>
        (!position || player.position === position) && (!query || `${player.name} ${player.number ?? ''}`.toLocaleLowerCase().includes(query))) }));
    const noMatches = Boolean(query || position) && !filtered.some(group => group.players.length);
    const clearFilters = () => { setSearch(''); setPosition(''); };
    return <Section boxed title={copy('Players', 'მოთამაშეები')}>
        <MatchHistoryLink clubId={clubId} squadId={squadId} />
        <Panel flush>
            {roster.loading ? <div role="status"><Skeleton height={100} /></div> : roster.failed ? <EmptyNote title={copy('Could not load this roster', 'შემადგენლობა ვერ ჩაიტვირთა')} action={<Button onClick={roster.retry}>{copy('Try again', 'ხელახლა ცდა')}</Button>} /> : <div className="squad-design">
                <div className="gk-club-toolbar">
                    <input className="gk-input" aria-label={copy('Search players or shirt number', 'მოძებნეთ მოთამაშე ან მაისურის ნომერი')} placeholder={copy('Search players or shirt number', 'მოძებნეთ მოთამაშე ან მაისურის ნომერი')} value={search} onChange={e => setSearch(e.target.value)} />
                    <select className="gk-input" aria-label={copy('Position', 'პოზიცია')} value={position} onChange={e => setPosition(e.target.value)}><option value="">{copy('All positions', 'ყველა პოზიცია')}</option>{positions.map(value => <option key={value!} value={value!}>{squadLabel(value, t)}</option>)}</select>
                    <Button aria-pressed={!cards} onClick={() => setCards(false)}>{copy('Roster', 'შემადგენლობა')}</Button><Button aria-pressed={cards} onClick={() => setCards(true)}>{copy('Cards', 'ბარათები')}</Button>
                    {(search || position) && !noMatches && <Button onClick={clearFilters}>{copy('Clear filters', 'ფილტრების გასუფთავება')}</Button>}
                </div>
                {noMatches ? <EmptyNote title={copy('No matching players', 'შესაბამისი მოთამაშეები ვერ მოიძებნა')} action={<Button onClick={clearFilters}>{copy('Clear filters', 'ფილტრების გასუფთავება')}</Button>} /> : cards ? <SquadRosterGrid groups={filtered} editable={false} showManagementDetails={false} /> : <SquadRosterTable groups={filtered} editable={false} showManagementDetails={false} />}
            </div>}
        </Panel>
    </Section>;
}
