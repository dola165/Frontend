import { SquadWorkbench, WorkspacePlayerPanel } from '../../../features/clubOperations/SquadWorkbench';
import { SquadAgePolicy } from '../../../features/clubOperations/SquadAgePolicy';
import type { RolesWorkspace } from '../../../features/clubOperations/useWorkspaceRoles';
import type { Bootstrap } from '../../../features/clubOperations/api';
import type { OpenWorkspace } from '../../../features/clubOperations/WorkspaceHome';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, List, Loader2, Pencil, Plus, Search, Shield, Trash2, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../api/axiosConfig';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { SquadRosterTable, type SquadRosterGroup, type SquadRosterPlayer } from '../../squads/SquadRosterTable';
import { SquadRosterGrid } from '../../squads/SquadRosterGrid';
import { squadLabel } from '../../squads/squadLabels';
import { AddPlayerToSquadModal } from '../../squads/AddPlayerToSquadModal';
import { PlayerCardModal } from '../../squads/PlayerCardModal';
import { SquadEditorModal, type SquadDetails } from '../../squads/SquadEditorModal';
import {
    updateSquad,
    deleteSquad,
    removePlayerFromSquad,
    updateSquadPlayer,
    fetchPlayerCards,
    type PlayerCard,
} from '../../../features/clubs/api';
import type { ClubManagementOverview } from '../../../features/clubs/domain';
import { usePersistedState } from '../../../utils/usePersistedState';
import { extractApiErrorMessage } from '../../../utils/apiError';
import '../../squads/squad-design.css';
import '../../squads/squad-workspace.css';
import { Link, useSearchParams } from 'react-router-dom';

interface SquadDto extends SquadDetails {
    id: number;
    clubId: number;
}
interface SquadsTabProps {
    clubId: number;
    overview: ClubManagementOverview | null;
    setParentError: (msg: string | null) => void;
    setParentSuccess: (msg: string | null) => void;
    workspace?: { data:RolesWorkspace; boot:Bootstrap|null; onOpen:OpenWorkspace };
}

export const SquadsTab = ({ clubId, overview, setParentError, setParentSuccess, workspace }: SquadsTabProps) => {
    const { t } = useTranslation();
    const [params,setParams] = useSearchParams();
    const [activePlayer,setActivePlayer] = useState<SquadRosterPlayer|null>(null);
    const linkedSquad=Number(params.get('squad'))||undefined;
    const initialSquad=useRef(linkedSquad ?? workspace?.data.views.find(v=>v.id==='coaching')?.squadIds[0]);
    const [squads, setSquads] = useState<SquadDto[]>([]);
    const [squadsLoading, setSquadsLoading] = useState(true);
    const [squadsError, setSquadsError] = useState<string | null>(null);
    const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);
    const selectedSquadRef = useRef<number | null>(null);
    const squadRequestRef = useRef(0);
    const rosterRequestRef = useRef(0);
    const [rosterGroups, setRosterGroups] = useState<SquadRosterGroup[]>([]);
    const [rosterLoading, setRosterLoading] = useState(false);
    const [rosterError, setRosterError] = useState<string | null>(null);
    const [cardView, setCardView] = usePersistedState('gkz:roster:cardView', false);
    const [query, setQuery] = useState(params.get('playerSearch')??'');
    const [position, setPosition] = useState(params.get('position')??'');
    const [squadEditor, setSquadEditor] = useState<SquadDto | 'new' | null>(null);
    const [pendingDelete, setPendingDelete] = useState<SquadDto | null>(null);
    const [pendingRemove, setPendingRemove] = useState<{
        userId: number;
        playerName: string;
        squadId: number;
        squadName: string;
    } | null>(null);
    const [showAddPlayers, setShowAddPlayers] = useState(false);
    const [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null);
    const [deletingSquadId, setDeletingSquadId] = useState<number | null>(null);
    const [cards, setCards] = useState<PlayerCard[]>([]);
    const [editingCard, setEditingCard] = useState<PlayerCard | null>(null);
    const cardUserIds = useMemo(
        () => new Set(cards.map((card) => card.userId).filter((id): id is number => id != null)),
        [cards],
    );
    const selectedSquad = squads.find((squad) => squad.id === selectedSquadId) ?? null;
    const playerCount = useMemo(
        () => rosterGroups.reduce((total, group) => total + group.players.length, 0),
        [rosterGroups],
    );
    const visibleGroups = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        return rosterGroups
            .map((group) => ({
                ...group,
                players: group.players.filter(
                    (player) =>
                        (!position || group.label === position) &&
                        (!needle ||
                            player.name.toLocaleLowerCase().includes(needle) ||
                            String(player.number ?? '').includes(needle)),
                ),
            }))
            .filter((group) => group.players.length > 0);
    }, [rosterGroups, query, position]);
    const visibleCount = useMemo(
        () => visibleGroups.reduce((total, group) => total + group.players.length, 0),
        [visibleGroups],
    );
    const genderLabel = (gender: string) => t(`squads.design.${gender.toLowerCase()}`, { defaultValue: gender });

    // Clear the previous team's roster immediately and discard requests that finish out of order.
    const selectSquad = useCallback((squadId: number | null) => {
        if (selectedSquadRef.current === squadId) return;
        const changing = selectedSquadRef.current !== null;
        selectedSquadRef.current = squadId;
        rosterRequestRef.current += 1;
        setSelectedSquadId(squadId);
        setRosterGroups([]);
        setRosterError(null);
        setRosterLoading(squadId != null);
        if(changing){setQuery('');setPosition('');setActivePlayer(null);}
    }, []);

    const loadSquads = useCallback(
        async (preferredId?: number) => {
            const requestId = ++squadRequestRef.current;
            setSquadsLoading(true);
            setSquadsError(null);
            const [squadsResult, cardsResult] = await Promise.allSettled([
                apiClient.get<SquadDto[]>(`/clubs/${clubId}/squads`),
                fetchPlayerCards(clubId),
            ]);
            if (requestId !== squadRequestRef.current) return;
            if (squadsResult.status === 'rejected') {
                setSquadsError(
                    extractApiErrorMessage(
                        squadsResult.reason,
                        t('squads.design.loadError', { defaultValue: 'Could not load your squads.' }),
                    ),
                );
                setSquadsLoading(false);
                return;
            }
            const list = squadsResult.value.data || [];
            const nextCards = cardsResult.status === 'fulfilled' ? cardsResult.value : [];
            setSquads(list);
            setCards(nextCards);
            const existingId = preferredId ?? selectedSquadRef.current;
            const firstCardSquadId = nextCards.find(
                (card) => card.squadId != null && list.some((squad) => squad.id === card.squadId),
            )?.squadId;
            selectSquad(
                list.some((squad) => squad.id === existingId) ? existingId! : (firstCardSquadId ?? list[0]?.id ?? null),
            );
            setSquadsLoading(false);
        },
        [clubId, selectSquad, t],
    );

    const loadCards = useCallback(async () => {
        try {
            setCards(await fetchPlayerCards(clubId));
        } catch {
            /* Cards are optional roster context. */
        }
    }, [clubId]);

    const loadRoster = useCallback(
        async (squadId: number) => {
            if (selectedSquadRef.current !== squadId) return;
            const requestId = ++rosterRequestRef.current;
            setRosterLoading(true);
            setRosterError(null);
            try {
                const response = await apiClient.get<SquadRosterGroup[]>(`/clubs/${clubId}/squads/${squadId}/roster`);
                if (requestId === rosterRequestRef.current && selectedSquadRef.current === squadId)
                    setRosterGroups(response.data || []);
            } catch (error) {
                if (requestId === rosterRequestRef.current && selectedSquadRef.current === squadId) {
                    setRosterError(
                        extractApiErrorMessage(
                            error,
                            t('squads.design.rosterError', { defaultValue: 'Could not load this roster.' }),
                        ),
                    );
                }
            } finally {
                if (requestId === rosterRequestRef.current) setRosterLoading(false);
            }
        },
        [clubId, t],
    );

    useEffect(() => {
        void loadSquads(initialSquad.current);
        return () => {
            squadRequestRef.current += 1;
        };
    }, [loadSquads]);
    useEffect(()=>{if(linkedSquad&&squads.some(s=>s.id===linkedSquad))selectSquad(linkedSquad);},[linkedSquad,squads,selectSquad]);
    useEffect(() => {
        if (selectedSquadId != null) void loadRoster(selectedSquadId);
        return () => {
            rosterRequestRef.current += 1;
        };
    }, [selectedSquadId, loadRoster]);

    const handleSaveSquad = async (details: SquadDetails) => {
        if (squadEditor && squadEditor !== 'new') {
            await updateSquad(clubId, squadEditor.id, details);
            setSquads((prev) => prev.map((squad) => (squad.id === squadEditor.id ? { ...squad, ...details } : squad)));
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
        setPendingDelete(null);
        setDeletingSquadId(pending.id);
        try {
            await deleteSquad(clubId, pending.id);
            const remaining = squads.filter((squad) => squad.id !== pending.id);
            setSquads(remaining);
            if (selectedSquadRef.current === pending.id) selectSquad(remaining[0]?.id ?? null);
            setParentSuccess(
                t('squads.design.deleted', { defaultValue: 'Squad “{{name}}” deleted.', name: pending.name }),
            );
        } catch (error) {
            setParentError(
                extractApiErrorMessage(
                    error,
                    t('squads.design.deleteError', { defaultValue: 'Could not delete squad.' }),
                ),
            );
        } finally {
            setDeletingSquadId(null);
        }
    };

    const handleRemovePlayer = (userId: number, playerName: string) => {
        if (selectedSquad)
            setPendingRemove({ userId, playerName, squadId: selectedSquad.id, squadName: selectedSquad.name });
    };
    const confirmRemovePlayer = async () => {
        const pending = pendingRemove;
        if (!pending || removingPlayerId != null) return;
        setPendingRemove(null);
        setRemovingPlayerId(pending.userId);
        try {
            await removePlayerFromSquad(clubId, pending.squadId, pending.userId);
            await loadRoster(pending.squadId);
            setParentSuccess(
                t('squads.design.playerRemoved', {
                    defaultValue: '{{name}} removed from squad.',
                    name: pending.playerName,
                }),
            );
        } catch (error) {
            setParentError(
                extractApiErrorMessage(
                    error,
                    t('squads.design.removeError', { defaultValue: 'Could not remove player.' }),
                ),
            );
        } finally {
            setRemovingPlayerId(null);
        }
    };
    const handleUpdatePlayer = async (userId: number, jerseyNumber: number | null, squadRole: string | null) => {
        if (!selectedSquad) return;
        const squadId = selectedSquad.id;
        try {
            await updateSquadPlayer(clubId, squadId, userId, { jerseyNumber, squadRole });
            await loadRoster(squadId);
        } catch (error) {
            setParentError(
                extractApiErrorMessage(
                    error,
                    t('squads.design.playerUpdateError', { defaultValue: 'Could not update player.' }),
                ),
            );
            throw error;
        }
    };
    const handlePlayersAdded = async () => {
        if (!selectedSquad) return;
        await Promise.all([loadRoster(selectedSquad.id), loadCards()]);
        setParentSuccess(t('squads.design.playersAdded', { defaultValue: 'Players added to squad.' }));
    };

    const renderRoster = () => (<>
                            <div className="sd-toolbar sw-roster-toolbar">
                                <label className="sd-search">
                                    <Search size={17} />
                                    <input
                                        type="search"
                                        aria-label={t('squads.design.searchPlayers', {
                                            defaultValue: 'Search players or shirt number',
                                        })}
                                        placeholder={t('squads.design.searchPlayers', {
                                            defaultValue: 'Search players or shirt number',
                                        })}
                                        value={query}
                                        onChange={(event) => {setQuery(event.target.value);const next=new URLSearchParams(params);next.set('playerSearch',event.target.value);if(selectedSquadId)next.set('squad',String(selectedSquadId));setParams(next,{replace:true});}}
                                    />
                                </label>
                                <select
                                    className="sw-position-filter"
                                    aria-label={t('squads.design.position', { defaultValue: 'Position' })}
                                    value={position}
                                    onChange={(event) => {setPosition(event.target.value);const next=new URLSearchParams(params);next.set('position',event.target.value);if(selectedSquadId)next.set('squad',String(selectedSquadId));setParams(next,{replace:true});}}
                                >
                                    <option value="">
                                        {t('squads.design.allPositions', { defaultValue: 'All positions' })}
                                    </option>
                                    {rosterGroups
                                        .filter((group) => group.players.length > 0)
                                        .map((group) => (
                                            <option key={group.label} value={group.label}>
                                                {squadLabel(group.label, t)}
                                            </option>
                                        ))}
                                </select>
                                <div
                                    className="sd-segments"
                                    role="group"
                                    aria-label={t('squads.design.rosterView', { defaultValue: 'Roster view' })}
                                >
                                    <button type="button" aria-pressed={!cardView} onClick={() => setCardView(false)}>
                                        <List size={15} />
                                        {t('squads.design.roster', { defaultValue: 'Roster' })}
                                    </button>
                                    <button type="button" aria-pressed={cardView} onClick={() => setCardView(true)}>
                                        <LayoutGrid size={15} />
                                        {t('squads.design.cards', { defaultValue: 'Cards' })}
                                    </button>
                                </div>
                            </div>
                            {(query || position) && (
                                <div className="sw-filter-summary">
                                    <span>
                                        {t('squads.design.showingCount', {
                                            defaultValue: '{{visible}} of {{total}} players',
                                            visible: visibleCount,
                                            total: playerCount,
                                        })}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuery('');
                                            setPosition('');
                                            const next=new URLSearchParams(params);next.delete('playerSearch');next.delete('position');setParams(next,{replace:true});
                                        }}
                                    >
                                        <X size={13} />
                                        {t('squads.design.clearFilters', { defaultValue: 'Clear filters' })}
                                    </button>
                                </div>
                            )}
                            {rosterLoading ? (
                                <div className="sw-loading" role="status">
                                    <Loader2 size={22} className="animate-spin" />
                                    <span>{t('squads.design.loadingRoster', { defaultValue: 'Loading roster…' })}</span>
                                </div>
                            ) : rosterError ? (
                                <div className="sd-empty" role="alert">
                                    <p>{rosterError}</p>
                                    <button
                                        className="sd-button"
                                        type="button"
                                        onClick={() => void loadRoster(selectedSquad!.id)}
                                    >
                                        {t('squads.design.retry', { defaultValue: 'Try again' })}
                                    </button>
                                </div>
                            ) : playerCount === 0 ? (
                                <div className="sd-empty sw-empty-roster">
                                    <Users size={28} />
                                    <h3>
                                        {t('squads.design.emptyRoster', {
                                            defaultValue: 'A team starts with its players',
                                        })}
                                    </h3>
                                    <p>
                                        {t('squads.design.emptyRosterIntro', {
                                            defaultValue:
                                                'Add club players to this squad, or create a card for someone without an account.',
                                        })}
                                    </p>
                                    <button type="button" className="sd-button" onClick={() => setShowAddPlayers(true)}>
                                        <Plus size={16} />
                                        {t('squads.design.addPlayers', { defaultValue: 'Add players' })}
                                    </button>
                                </div>
                            ) : visibleCount === 0 ? (
                                <div className="sd-empty">
                                    <p>
                                        {t('squads.design.noMatches', {
                                            defaultValue: 'No players match these filters.',
                                        })}
                                    </p>
                                    <button
                                        className="sd-button"
                                        type="button"
                                        onClick={() => {
                                            setQuery('');
                                            setPosition('');
                                            const next=new URLSearchParams(params);next.delete('playerSearch');next.delete('position');setParams(next,{replace:true});
                                        }}
                                    >
                                        {t('squads.design.clearFilters', { defaultValue: 'Clear filters' })}
                                    </button>
                                </div>
                            ) : cardView ? (
                                <SquadRosterGrid
                                    key={selectedSquad!.id}
                                    groups={visibleGroups}
                                    editable
                                    onOpenPlayer={workspace ? setActivePlayer : undefined}
                                    onRemovePlayer={handleRemovePlayer}
                                    onUpdatePlayer={handleUpdatePlayer}
                                    removingPlayerId={removingPlayerId}
                                    cardUserIds={cardUserIds}
                                    onEditCard={(userId) =>
                                        setEditingCard(cards.find((card) => card.userId === userId) ?? null)
                                    }
                                />
                            ) : (
                                <SquadRosterTable
                                    key={selectedSquad!.id}
                                    groups={visibleGroups}
                                    editable
                                    onOpenPlayer={workspace ? setActivePlayer : undefined}
                                    onRemovePlayer={handleRemovePlayer}
                                    onUpdatePlayer={handleUpdatePlayer}
                                    removingPlayerId={removingPlayerId}
                                    cardUserIds={cardUserIds}
                                    onEditCard={(userId) =>
                                        setEditingCard(cards.find((card) => card.userId === userId) ?? null)
                                    }
                                />
                            )}
    </>);

    return (
        <div className="squad-design sw-workspace">
            <header className="sw-page-header">
                <div>
                    <p className="sd-eyebrow">{t('squads.design.clubFootball', { defaultValue: 'Club football' })}</p>
                    <h1 className="sw-heading">
                        {t('squads.design.title', { defaultValue: 'Squads' })}
                        <span className="sw-heading-dot">.</span>
                    </h1>
                    <p className="sd-muted">
                        {t('squads.design.intro', {
                            defaultValue: 'Your teams, their players. Everything in its place.',
                        })}
                    </p>
                </div>
                <div className="sw-page-actions">
                    <div className="sw-club-count">
                        <Users size={15} />
                        <span>
                            <strong>{overview?.activePlayerCount ?? '—'}</strong>{' '}
                            {t('squads.design.clubPlayers', { defaultValue: 'club players' })}
                        </span>
                    </div>
                    <button type="button" className="sd-primary" onClick={() => setSquadEditor('new')}>
                        <Plus size={17} />
                        {t('squads.design.newSquad', { defaultValue: 'New squad' })}
                    </button>
                </div>
            </header>

            {squadsLoading ? (
                <div className="sw-loading" role="status">
                    <Loader2 size={22} className="animate-spin" />
                    <span>{t('squads.design.loadingSquads', { defaultValue: 'Loading squads…' })}</span>
                </div>
            ) : squadsError ? (
                <div className="sd-empty" role="alert">
                    <p>{squadsError}</p>
                    <button className="sd-button" type="button" onClick={() => void loadSquads()}>
                        {t('squads.design.retry', { defaultValue: 'Try again' })}
                    </button>
                </div>
            ) : squads.length === 0 ? (
                <div className="sd-empty sw-first-squad">
                    <Shield size={34} />
                    <h2>{t('squads.design.firstSquad', { defaultValue: 'Start with your first team' })}</h2>
                    <p>
                        {t('squads.design.emptyIntro', {
                            defaultValue: 'Create a squad, then add players from your club or create a player card.',
                        })}
                    </p>
                    <button type="button" className="sd-primary" onClick={() => setSquadEditor('new')}>
                        <Plus size={16} />
                        {t('squads.design.createSquad', { defaultValue: 'Create squad' })}
                    </button>
                </div>
            ) : (
                <>
                    <div
                        className="sw-squad-strip"
                        role="group"
                        aria-label={t('squads.design.chooseSquad', { defaultValue: 'Choose squad' })}
                    >
                        {squads.map((squad) => (
                            <button
                                key={squad.id}
                                type="button"
                                aria-pressed={selectedSquadId === squad.id}
                                className="sw-squad-option"
                                onClick={() => {selectSquad(squad.id);const next=new URLSearchParams(params);next.set('squad',String(squad.id));['session','playerSearch','position'].forEach(k=>next.delete(k));setParams(next);}}
                            >
                                <span className="sw-squad-category">{squadLabel(squad.category, t)}</span>
                                <strong>{squad.name}</strong>
                                <span className="sw-squad-kind">{genderLabel(squad.gender)}</span>
                            </button>
                        ))}
                    </div>
                    {selectedSquad && (
                        <section className="sw-active-squad" aria-labelledby="sw-squad-title">
                            <header className="sw-roster-header">
                                <div className="sw-roster-identity">
                                    <div className="sw-squad-mark" aria-hidden="true">
                                        <Shield size={25} />
                                    </div>
                                    <div>
                                        <h2 id="sw-squad-title">{selectedSquad.name}</h2>
                                        <p>
                                            {squadLabel(selectedSquad.category, t)} <span>·</span>{' '}
                                            {genderLabel(selectedSquad.gender)} <span>·</span>{' '}
                                            {rosterLoading
                                                ? '…'
                                                : t('squads.design.playerCount', {
                                                      defaultValue: '{{count}} players',
                                                      count: playerCount,
                                                  })}
                                        </p>
                                    </div>
                                </div>
                                <div className="sw-roster-actions">
                                    <Link to={`/squads/${selectedSquad.id}`} className="sd-button">Messages & plans</Link>
                                    <button
                                        type="button"
                                        className="sd-button"
                                        onClick={() => setSquadEditor(selectedSquad)}
                                    >
                                        <Pencil size={14} />
                                        <span>{t('squads.design.editSquad', { defaultValue: 'Edit squad' })}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="sd-icon-button sw-delete"
                                        disabled={deletingSquadId != null}
                                        aria-label={t('squads.design.deleteSquad', { defaultValue: 'Delete squad' })}
                                        title={t('squads.design.deleteSquad', { defaultValue: 'Delete squad' })}
                                        onClick={() => setPendingDelete(selectedSquad)}
                                    >
                                        {deletingSquadId === selectedSquad.id ? (
                                            <Loader2 size={15} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={15} />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="sd-primary"
                                        onClick={() => setShowAddPlayers(true)}
                                    >
                                        <Plus size={16} />
                                        {t('squads.design.addPlayers', { defaultValue: 'Add players' })}
                                    </button>
                                </div>
                            </header>
                            {(workspace?.data.leadership || overview?.currentUserRole === 'OWNER' || overview?.currentUserRole === 'CLUB_ADMIN') && <SquadAgePolicy key={selectedSquad.id} club={clubId} squad={selectedSquad.id} />}
                            {workspace ? <SquadWorkbench data={workspace.data} boot={workspace.boot} squad={selectedSquad.id} onOpen={workspace.onOpen}>{renderRoster()}</SquadWorkbench> : renderRoster()}
                        </section>
                    )}
                </>
            )}

            {activePlayer && selectedSquad && workspace && <WorkspacePlayerPanel key={activePlayer.id} player={activePlayer} squad={selectedSquad.id} squadName={selectedSquad.name} boot={workspace.boot} onClose={()=>setActivePlayer(null)} onOpen={workspace.onOpen}/>}
            {squadEditor && (
                <SquadEditorModal
                    initial={squadEditor === 'new' ? undefined : squadEditor}
                    onClose={() => setSquadEditor(null)}
                    onSave={handleSaveSquad}
                />
            )}
            {selectedSquad && (
                <AddPlayerToSquadModal
                    key={selectedSquad.id}
                    clubId={clubId}
                    squadId={selectedSquad.id}
                    squadName={selectedSquad.name}
                    existingPlayerIds={rosterGroups.flatMap((group) => group.players.map((player) => player.id))}
                    isOpen={showAddPlayers}
                    onClose={() => setShowAddPlayers(false)}
                    onPlayersAdded={handlePlayersAdded}
                />
            )}
            <PlayerCardModal
                clubId={clubId}
                isOpen={editingCard != null}
                onClose={() => setEditingCard(null)}
                card={editingCard}
                onCardUpdated={async () => {
                    await loadCards();
                    if (selectedSquad) await loadRoster(selectedSquad.id);
                    setParentSuccess(t('squads.design.cardUpdated', { defaultValue: 'Player card updated.' }));
                }}
            />
            <ConfirmDialog
                open={pendingDelete != null}
                title={t('squads.design.deleteSquad', { defaultValue: 'Delete squad' })}
                message={
                    pendingDelete
                        ? t('squads.design.deleteConfirm', {
                              defaultValue: 'Delete squad “{{name}}”? All players must be removed first.',
                              name: pendingDelete.name,
                          })
                        : ''
                }
                confirmLabel={t('squads.design.delete', { defaultValue: 'Delete' })}
                variant="danger"
                onConfirm={confirmDeleteSquad}
                onCancel={() => setPendingDelete(null)}
            />
            <ConfirmDialog
                open={pendingRemove != null}
                title={t('squads.design.removePlayer', { defaultValue: 'Remove player' })}
                message={
                    pendingRemove
                        ? t('squads.design.removeConfirm', {
                              defaultValue: 'Remove “{{player}}” from “{{squad}}”?',
                              player: pendingRemove.playerName,
                              squad: pendingRemove.squadName,
                          })
                        : ''
                }
                confirmLabel={t('squads.design.remove', { defaultValue: 'Remove' })}
                variant="danger"
                onConfirm={confirmRemovePlayer}
                onCancel={() => setPendingRemove(null)}
            />
        </div>
    );
};
