import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus, MessagesSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { Avatar, Button, ButtonLink, Chip, EmptyNote, PageFrame, PageHeader, Panel, Skeleton } from '../../../design/primitives';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { SquadRosterGroup, SquadRosterPlayer } from '../../../components/squads/SquadRosterTable';
import { squadLabel } from '../../../components/squads/squadLabels';
import { AddPlayerToSquadModal } from '../../../components/squads/AddPlayerToSquadModal';
import { PlayerCardModal } from '../../../components/squads/PlayerCardModal';
import { SquadEditorModal, type SquadDetails } from '../../../components/squads/SquadEditorModal';
import { updateSquad, deleteSquad, removePlayerFromSquad, updateSquadPlayer, fetchPlayerCards, type PlayerCard } from '../../clubs/api';
import type { ClubManagementOverview } from '../../clubs/domain';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { SquadWorkbench } from '../../clubOperations/SquadWorkbench';
import { WorkspacePlayerPanel } from '../../clubOperations/WorkspacePlayerPanel';
import { SquadAgePolicy } from '../../clubOperations/SquadAgePolicy';
import { usePersistedState } from '../../../utils/usePersistedState';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { SquadRoster } from './SquadRoster';
import '../club-workspace.css';
import './squads.css';

interface SquadDto extends SquadDetails { id: number; clubId: number }
interface Props { clubId: number; overview: ClubManagementOverview | null; setParentError: (msg: string | null) => void; setParentSuccess: (msg: string | null) => void; workspace?: { data: RolesWorkspace; boot: Bootstrap | null; onOpen: OpenWorkspace } }

/** Every squad of the club: choose one, then its players, training and age rules, with the tools to change them. */
export function SquadsPage({ clubId, overview, setParentError, setParentSuccess, workspace }: Props) {
    const { t } = useTranslation();
    const [params, setParams] = useSearchParams();
    const linkedSquad = Number(params.get('squad')) || undefined;
    const initialSquad = useRef(linkedSquad ?? workspace?.data.views.find(v => v.id === 'coaching')?.squadIds[0]);
    const [squads, setSquads] = useState<SquadDto[]>([]), [squadsLoading, setSquadsLoading] = useState(true), [squadsError, setSquadsError] = useState<string | null>(null);
    const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
    const selectedSquadRef = useRef<number | null>(null), squadRequestRef = useRef(0), rosterRequestRef = useRef(0);
    const [rosterGroups, setRosterGroups] = useState<SquadRosterGroup[]>([]), [rosterLoading, setRosterLoading] = useState(false), [rosterError, setRosterError] = useState<string | null>(null);
    const [cardView, setCardView] = usePersistedState('gkz:roster:cardView', false);
    const [query, setQuery] = useState(params.get('playerSearch') ?? ''), [position, setPosition] = useState(params.get('position') ?? '');
    const [squadEditor, setSquadEditor] = useState<SquadDto | 'new' | null>(null), [pendingDelete, setPendingDelete] = useState<SquadDto | null>(null);
    const [pendingRemove, setPendingRemove] = useState<{ userId: number; playerName: string; squadId: number; squadName: string } | null>(null);
    const [showAddPlayers, setShowAddPlayers] = useState(false), [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null), [deletingSquadId, setDeletingSquadId] = useState<number | null>(null);
    const [cards, setCards] = useState<PlayerCard[]>([]), [editingCard, setEditingCard] = useState<PlayerCard | null>(null), [activePlayer, setActivePlayer] = useState<SquadRosterPlayer | null>(null);
    const cardUserIds = useMemo(() => new Set(cards.map(card => card.userId).filter((id): id is number => id != null)), [cards]);
    const selectedSquad = squads.find(squad => squad.id === selectedSquadId) ?? null;
    const playerCount = rosterGroups.reduce((total, group) => total + group.players.length, 0);
    const visibleGroups = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        return rosterGroups.map(group => ({ ...group, players: group.players.filter(player => (!position || group.label === position) && (!needle || player.name.toLocaleLowerCase().includes(needle) || String(player.number ?? '').includes(needle))) }))
            .filter(group => group.players.length > 0);
    }, [rosterGroups, query, position]);
    const genderLabel = (gender: string) => t(`squads.design.${gender.toLowerCase()}`, { defaultValue: gender });

    // Clear the previous team's roster at once and discard answers that arrive out of order.
    const selectSquad = useCallback((squadId: number | null) => {
        if (selectedSquadRef.current === squadId) return;
        const changing = selectedSquadRef.current !== null;
        selectedSquadRef.current = squadId; rosterRequestRef.current += 1;
        setSelectedSquadId(squadId); setRosterGroups([]); setRosterError(null); setRosterLoading(squadId != null);
        if (changing) { setQuery(''); setPosition(''); setActivePlayer(null); }
    }, []);
    const loadSquads = useCallback(async (preferredId?: number) => {
        const requestId = ++squadRequestRef.current;
        setSquadsLoading(true); setSquadsError(null);
        const [squadsResult, cardsResult] = await Promise.allSettled([apiClient.get<SquadDto[]>(`/clubs/${clubId}/squads`), fetchPlayerCards(clubId)]);
        if (requestId !== squadRequestRef.current) return;
        if (squadsResult.status === 'rejected') { setSquadsError(extractApiErrorMessage(squadsResult.reason, t('squads.design.loadError', { defaultValue: 'Could not load your squads.' }))); setSquadsLoading(false); return; }
        const list = squadsResult.value.data || [], nextCards = cardsResult.status === 'fulfilled' ? cardsResult.value : [];
        setSquads(list); setCards(nextCards);
        const existingId = preferredId ?? selectedSquadRef.current;
        const firstCardSquadId = nextCards.find(card => card.squadId != null && list.some(squad => squad.id === card.squadId))?.squadId;
        selectSquad(list.some(squad => squad.id === existingId) ? existingId! : (firstCardSquadId ?? list[0]?.id ?? null));
        setSquadsLoading(false);
    }, [clubId, selectSquad, t]);
    const loadCards = useCallback(async () => { try { setCards(await fetchPlayerCards(clubId)); } catch { /* Cards are optional roster context. */ } }, [clubId]);
    const loadRoster = useCallback(async (squadId: number) => {
        if (selectedSquadRef.current !== squadId) return;
        const requestId = ++rosterRequestRef.current;
        setRosterLoading(true); setRosterError(null);
        try {
            const response = await apiClient.get<SquadRosterGroup[]>(`/clubs/${clubId}/squads/${squadId}/roster`);
            if (requestId === rosterRequestRef.current && selectedSquadRef.current === squadId) setRosterGroups(response.data || []);
        } catch (error) {
            if (requestId === rosterRequestRef.current && selectedSquadRef.current === squadId) setRosterError(extractApiErrorMessage(error, t('squads.design.rosterError', { defaultValue: 'Could not load this roster.' })));
        } finally { if (requestId === rosterRequestRef.current) setRosterLoading(false); }
    }, [clubId, t]);
    useEffect(() => { void loadSquads(initialSquad.current); return () => { squadRequestRef.current += 1; }; }, [loadSquads]);
    useEffect(() => { if (linkedSquad && squads.some(s => s.id === linkedSquad)) selectSquad(linkedSquad); }, [linkedSquad, squads, selectSquad]);
    useEffect(() => { if (selectedSquadId != null) void loadRoster(selectedSquadId); return () => { rosterRequestRef.current += 1; }; }, [selectedSquadId, loadRoster]);

    const keepInUrl = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (selectedSquadId) next.set('squad', String(selectedSquadId)); setParams(next, { replace: true }); };
    const clearFilters = () => { setQuery(''); setPosition(''); const next = new URLSearchParams(params); next.delete('playerSearch'); next.delete('position'); setParams(next, { replace: true }); };
    const handleSaveSquad = async (details: SquadDetails) => {
        if (squadEditor && squadEditor !== 'new') {
            await updateSquad(clubId, squadEditor.id, details);
            setSquads(prev => prev.map(squad => (squad.id === squadEditor.id ? { ...squad, ...details } : squad)));
            setParentSuccess(t('squads.design.updated', { defaultValue: 'Squad updated.' }));
        } else {
            const response = await apiClient.post<SquadDto>(`/clubs/${clubId}/squads`, details);
            await loadSquads(response.data?.id);
            setParentSuccess(t('squads.design.created', { defaultValue: 'Squad created.' }));
        }
    };
    const confirmDeleteSquad = async () => {
        const pending = pendingDelete;
        if (!pending || deletingSquadId != null) return;
        setPendingDelete(null); setDeletingSquadId(pending.id);
        try {
            await deleteSquad(clubId, pending.id);
            const remaining = squads.filter(squad => squad.id !== pending.id);
            setSquads(remaining);
            if (selectedSquadRef.current === pending.id) selectSquad(remaining[0]?.id ?? null);
            setParentSuccess(t('squads.design.deleted', { defaultValue: 'Squad “{{name}}” deleted.', name: pending.name }));
        } catch (error) { setParentError(extractApiErrorMessage(error, t('squads.design.deleteError', { defaultValue: 'Could not delete squad.' }))); }
        finally { setDeletingSquadId(null); }
    };
    const confirmRemovePlayer = async () => {
        const pending = pendingRemove;
        if (!pending || removingPlayerId != null) return;
        setPendingRemove(null); setRemovingPlayerId(pending.userId);
        try {
            await removePlayerFromSquad(clubId, pending.squadId, pending.userId);
            await loadRoster(pending.squadId);
            setParentSuccess(t('squads.design.playerRemoved', { defaultValue: '{{name}} removed from squad.', name: pending.playerName }));
        } catch (error) { setParentError(extractApiErrorMessage(error, t('squads.design.removeError', { defaultValue: 'Could not remove player.' }))); }
        finally { setRemovingPlayerId(null); }
    };
    const handleUpdatePlayer = async (userId: number, jerseyNumber: number | null, squadRole: string | null) => {
        if (!selectedSquad) return;
        try { await updateSquadPlayer(clubId, selectedSquad.id, userId, { jerseyNumber, squadRole }); await loadRoster(selectedSquad.id); }
        catch (error) { setParentError(extractApiErrorMessage(error, t('squads.design.playerUpdateError', { defaultValue: 'Could not update player.' }))); throw error; }
    };
    const leadership = Boolean(workspace?.data.leadership || overview?.currentUserRole === 'OWNER' || overview?.currentUserRole === 'CLUB_ADMIN');

    const roster = selectedSquad && <SquadRoster squadId={selectedSquad.id} groups={rosterGroups} visibleGroups={visibleGroups} loading={rosterLoading} error={rosterError} onRetry={() => void loadRoster(selectedSquad.id)}
        query={query} position={position} onQuery={value => { setQuery(value); keepInUrl('playerSearch', value); }} onPosition={value => { setPosition(value); keepInUrl('position', value); }} onClear={clearFilters}
        cardView={cardView} onCardView={setCardView} onAddPlayers={() => setShowAddPlayers(true)} onOpenPlayer={workspace ? setActivePlayer : undefined}
        onRemovePlayer={(userId, playerName) => setPendingRemove({ userId, playerName, squadId: selectedSquad.id, squadName: selectedSquad.name })} onUpdatePlayer={handleUpdatePlayer}
        removingPlayerId={removingPlayerId} cardUserIds={cardUserIds} onEditCard={userId => setEditingCard(cards.find(card => card.userId === userId) ?? null)} />;

    return <PageFrame className="cw-page">
        <PageHeader title={t('squads.design.title', { defaultValue: 'Squads' })} subtitle={`${squads.length} ${squads.length === 1 ? 'squad' : 'squads'} · ${overview?.activePlayerCount ?? '—'} ${t('squads.design.clubPlayers', { defaultValue: 'club players' })}`}
            actions={<Button onClick={() => setSquadEditor('new')}><Plus aria-hidden="true" />{t('squads.design.newSquad', { defaultValue: 'New squad' })}</Button>} />
        {squadsLoading ? <div className="cw-loading" role="status" aria-label={t('squads.design.loadingSquads', { defaultValue: 'Loading squads…' })}><Skeleton height={36} /><Skeleton height={240} /></div>
            : squadsError ? <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{squadsError}</span><Button size="sm" onClick={() => void loadSquads()}>{t('squads.design.retry', { defaultValue: 'Try again' })}</Button></div>
                : squads.length === 0 ? <Panel><EmptyNote title={t('squads.design.firstSquad', { defaultValue: 'Start with your first team' })} action={<Button size="sm" onClick={() => setSquadEditor('new')}><Plus aria-hidden="true" />{t('squads.design.createSquad', { defaultValue: 'Create squad' })}</Button>}>
                    {t('squads.design.emptyIntro', { defaultValue: 'Create a squad, then add players from your club or create a player card.' })}</EmptyNote></Panel>
                    : <div className="gk-stack">
                        <div className="sq-switcher gk-chips" role="group" aria-label={t('squads.design.chooseSquad', { defaultValue: 'Choose squad' })}>
                            {squads.map(squad => <Chip key={squad.id} pressed={selectedSquadId === squad.id} onClick={() => { selectSquad(squad.id); const next = new URLSearchParams(params); next.set('squad', String(squad.id)); ['session', 'playerSearch', 'position'].forEach(k => next.delete(k)); setParams(next); }}>{squad.name}</Chip>)}
                        </div>
                        {selectedSquad && <section className="gk-stack" aria-labelledby="sq-title">
                            <div className="sq-header">
                                <div className="sq-header__id"><Avatar name={selectedSquad.name} size={48} square />
                                    <div><h2 id="sq-title">{selectedSquad.name}</h2><p>{squadLabel(selectedSquad.category, t)} · {genderLabel(selectedSquad.gender)} · {rosterLoading ? '…' : t('squads.design.playerCount', { defaultValue: '{{count}} players', count: playerCount })}</p></div></div>
                                <div className="sq-actions">
                                    <ButtonLink to={`/squads/${selectedSquad.id}`} variant="ghost"><MessagesSquare aria-hidden="true" />Messages & plans</ButtonLink>
                                    <ButtonLink to={`/world/matches/arrange?squad=${selectedSquad.id}`} variant="ghost"><CalendarPlus aria-hidden="true" />Arrange a match</ButtonLink>
                                    <Button onClick={() => setSquadEditor(selectedSquad)}><Pencil aria-hidden="true" />{t('squads.design.editSquad', { defaultValue: 'Edit squad' })}</Button>
                                    <Button variant="ghost" iconOnly disabled={deletingSquadId != null} aria-label={t('squads.design.deleteSquad', { defaultValue: 'Delete squad' })} title={t('squads.design.deleteSquad', { defaultValue: 'Delete squad' })} onClick={() => setPendingDelete(selectedSquad)}><Trash2 aria-hidden="true" /></Button>
                                    <Button variant="primary" onClick={() => setShowAddPlayers(true)}><Plus aria-hidden="true" />{t('squads.design.addPlayers', { defaultValue: 'Add players' })}</Button>
                                </div>
                            </div>
                            {workspace ? <SquadWorkbench data={workspace.data} boot={workspace.boot} squad={selectedSquad.id} onOpen={workspace.onOpen} eligibility={leadership ? <SquadAgePolicy key={selectedSquad.id} club={clubId} squad={selectedSquad.id} /> : undefined}>{roster}</SquadWorkbench>
                                : <>{leadership && <SquadAgePolicy key={selectedSquad.id} club={clubId} squad={selectedSquad.id} />}{roster}</>}
                        </section>}
                    </div>}
        {activePlayer && selectedSquad && workspace && <WorkspacePlayerPanel key={activePlayer.id} player={activePlayer} squad={selectedSquad.id} squadName={selectedSquad.name} boot={workspace.boot} onClose={() => setActivePlayer(null)} />}
        {squadEditor && <SquadEditorModal initial={squadEditor === 'new' ? undefined : squadEditor} onClose={() => setSquadEditor(null)} onSave={handleSaveSquad} />}
        {selectedSquad && <AddPlayerToSquadModal key={selectedSquad.id} clubId={clubId} squadId={selectedSquad.id} squadName={selectedSquad.name} existingPlayerIds={rosterGroups.flatMap(group => group.players.map(player => player.id))}
            isOpen={showAddPlayers} onClose={() => setShowAddPlayers(false)} onPlayersAdded={async () => { await Promise.all([loadRoster(selectedSquad.id), loadCards()]); setParentSuccess(t('squads.design.playersAdded', { defaultValue: 'Players added to squad.' })); }} />}
        <PlayerCardModal clubId={clubId} isOpen={editingCard != null} onClose={() => setEditingCard(null)} card={editingCard}
            onCardUpdated={async () => { await loadCards(); if (selectedSquad) await loadRoster(selectedSquad.id); setParentSuccess(t('squads.design.cardUpdated', { defaultValue: 'Player card updated.' })); }} />
        <ConfirmDialog open={pendingDelete != null} title={t('squads.design.deleteSquad', { defaultValue: 'Delete squad' })}
            message={pendingDelete ? t('squads.design.deleteConfirm', { defaultValue: 'Delete squad “{{name}}”? All players must be removed first.', name: pendingDelete.name }) : ''}
            confirmLabel={t('squads.design.delete', { defaultValue: 'Delete' })} variant="danger" onConfirm={confirmDeleteSquad} onCancel={() => setPendingDelete(null)} />
        <ConfirmDialog open={pendingRemove != null} title={t('squads.design.removePlayer', { defaultValue: 'Remove player' })}
            message={pendingRemove ? t('squads.design.removeConfirm', { defaultValue: 'Remove “{{player}}” from “{{squad}}”?', player: pendingRemove.playerName, squad: pendingRemove.squadName }) : ''}
            confirmLabel={t('squads.design.remove', { defaultValue: 'Remove' })} variant="danger" onConfirm={confirmRemovePlayer} onCancel={() => setPendingRemove(null)} />
    </PageFrame>;
}
