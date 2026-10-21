import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MatchHistoryLink } from '../features/matchHistory/MatchHistoryLink';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronRight,
    LayoutGrid,
    List,
    Loader2,
    MapPin,
    Pencil,
    Plus,
    Search,
    Shield,
    ShieldCheck,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { SquadRosterTable, type SquadRosterGroup } from '../components/squads/SquadRosterTable';
import { SquadRosterGrid } from '../components/squads/SquadRosterGrid';
import { squadLabel } from '../components/squads/squadLabels';
import { AddPlayerToSquadModal } from '../components/squads/AddPlayerToSquadModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
    deleteSquad,
    updateSquad,
    removePlayerFromSquad,
    updateSquadPlayer,
    fetchPlayerCards,
    fetchMyClubMembershipContext,
    type PlayerCard,
} from '../features/clubs/api';
import { PlayerCardModal } from '../components/squads/PlayerCardModal';
import { isLeadershipRole } from '../features/clubs/domain';
import { usePersistedState } from '../utils/usePersistedState';
import '../components/squads/squad-design.css';
import '../components/squads/squad-public.css';

interface ClubSquadHeader {
    id: number;
    name: string;
    type: string;
    addressText?: string;
    isOfficial: boolean;
}
interface SquadDto {
    id: number;
    clubId: number;
    name: string;
    category: string;
    gender: string;
}

export const ClubSquadsPage = () => {
    const { isAuthenticated, sessionId } = useAuth();
    const { id } = useParams<{ id: string }>();
    return (
        <ClubSquadsContent
            key={`${sessionId}:${id}:${isAuthenticated}`}
            isAuthenticated={isAuthenticated}
            sessionId={sessionId}
        />
    );
};

export const ClubSquadsContent = ({
    isAuthenticated,
    sessionId,
}: {
    isAuthenticated: boolean;
    sessionId: string | null;
}) => {
    const { id } = useParams<{ id: string }>();
    const clubId = Number(id);
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();
    const [context, setContext] = useState<{ clubId: number; club: ClubSquadHeader | null; squads: SquadDto[] } | null>(
        null,
    );
    const [loadingClub, setLoadingClub] = useState(true);
    const [retryContext, setRetryContext] = useState(0);
    const [adminScope, setAdminScope] = useState('');
    const accessScope = `${isAuthenticated ? 'member' : 'visitor'}:${sessionId}:${clubId}`;
    const isClubAdmin = isAuthenticated && adminScope === accessScope;
    const club = context?.clubId === clubId ? context.club : null;
    const squads = useMemo(() => (context?.clubId === clubId ? context.squads : []), [context, clubId]);
    const selectedSquadId = Number(searchParams.get('squad'));
    const selectedSquad = useMemo(
        () => squads.find((squad) => squad.id === selectedSquadId) ?? squads[0] ?? null,
        [squads, selectedSquadId],
    );
    const squadId = selectedSquad?.id;
    const [roster, setRoster] = useState<{ scope: string; groups: SquadRosterGroup[]; error: boolean } | null>(null);
    const rosterScope = `${accessScope}:${squadId}`;
    const groups = useMemo(() => (roster?.scope === rosterScope ? roster.groups : []), [roster, rosterScope]);
    const loadingRoster = Boolean(squadId) && roster?.scope !== rosterScope;
    const [refreshRoster, setRefreshRoster] = useState(0);
    const [refreshCards, setRefreshCards] = useState(0);
    const [search, setSearch] = useState('');
    const [position, setPosition] = useState('');
    const [cardView, setCardView] = usePersistedState('gkz:roster:cardView', false);
    const [cards, setCards] = useState<{ scope: string; data: PlayerCard[] }>({ scope: '', data: [] });
    const adminCards = useMemo(
        () => (isClubAdmin && cards.scope === accessScope ? cards.data : []),
        [cards, isClubAdmin, accessScope],
    );
    const cardUserIds = useMemo(
        () => new Set(adminCards.map((card) => card.userId).filter((userId): userId is number => userId != null)),
        [adminCards],
    );
    const [editingCard, setEditingCard] = useState<PlayerCard | null>(null);
    const [editingSquad, setEditingSquad] = useState<SquadDto | null>(null);
    const [showAddPlayers, setShowAddPlayers] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<SquadDto | null>(null);
    const [pendingRemove, setPendingRemove] = useState<{ squadId: number; userId: number; name: string } | null>(null);
    const [busy, setBusy] = useState('');
    const actionBusy = useRef(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoadingClub(true);
        Promise.all([apiClient.get(`/clubs/${clubId}`), apiClient.get(`/clubs/${clubId}/squads`)])
            .then(([clubResponse, squadsResponse]) => {
                if (!cancelled) setContext({ clubId, club: clubResponse.data, squads: squadsResponse.data || [] });
            })
            .catch(() => {
                if (!cancelled) setContext({ clubId, club: null, squads: [] });
            })
            .finally(() => {
                if (!cancelled) setLoadingClub(false);
            });
        return () => {
            cancelled = true;
        };
    }, [clubId, retryContext]);

    useEffect(() => {
        let cancelled = false;
        if (!isAuthenticated) return;
        fetchMyClubMembershipContext()
            .then((ctx) => {
                if (!cancelled)
                    setAdminScope(isLeadershipRole(ctx?.myRole) && ctx?.clubId === clubId ? accessScope : '');
            })
            .catch(() => {
                if (!cancelled) setAdminScope('');
            });
        return () => {
            cancelled = true;
        };
    }, [clubId, isAuthenticated, accessScope]);

    useEffect(() => {
        let cancelled = false;
        if (!isClubAdmin) return;
        fetchPlayerCards(clubId)
            .then((data) => {
                if (!cancelled) setCards({ scope: accessScope, data });
            })
            .catch(() => {
                if (!cancelled) setCards({ scope: accessScope, data: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [clubId, isClubAdmin, accessScope, refreshCards]);

    useEffect(() => {
        if (squadId && searchParams.get('squad') !== String(squadId))
            setSearchParams({ squad: String(squadId) }, { replace: true });
    }, [squadId, searchParams, setSearchParams]);

    useEffect(() => {
        let cancelled = false;
        if (!squadId) return;
        apiClient
            .get(`/clubs/${clubId}/squads/${squadId}/roster`)
            .then((response) => {
                if (!cancelled) setRoster({ scope: rosterScope, groups: response.data || [], error: false });
            })
            .catch(() => {
                if (!cancelled) setRoster({ scope: rosterScope, groups: [], error: true });
            });
        return () => {
            cancelled = true;
        };
    }, [clubId, squadId, rosterScope, refreshRoster]);

    const players = useMemo(() => groups.flatMap((group) => group.players), [groups]);
    const positions = useMemo(
        () =>
            [
                ...new Set(players.map((player) => player.position).filter((value): value is string => Boolean(value))),
            ].sort(),
        [players],
    );
    const filteredGroups = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return groups
            .map((group) => ({
                ...group,
                players: group.players.filter(
                    (player) =>
                        (!position || player.position === position) &&
                        (!query || `${player.name} ${player.number ?? ''}`.toLocaleLowerCase().includes(query)),
                ),
            }))
            .filter((group) => group.players.length);
    }, [groups, search, position]);
    const shownCount = filteredGroups.reduce((count, group) => count + group.players.length, 0);
    const resetFilters = () => {
        setSearch('');
        setPosition('');
    };
    const chooseSquad = (nextId: number) => {
        setSearchParams({ squad: String(nextId) });
        resetFilters();
        setEditingSquad(null);
        setShowAddPlayers(false);
        setEditingCard(null);
        setError('');
    };
    const runAction = useCallback(
        async (key: string, action: () => Promise<void>) => {
            if (!isClubAdmin || actionBusy.current) throw new Error('Squad update is not available right now.');
            actionBusy.current = true;
            setBusy(key);
            setError('');
            try {
                await action();
            } catch (err) {
                const data = (err as { response?: { data?: { message?: string } } }).response?.data;
                setError(
                    data?.message ||
                        t('squadDesign.public.actionFailed', {
                            defaultValue: 'Could not save the change. Please try again.',
                        }),
                );
                throw err;
            } finally {
                actionBusy.current = false;
                setBusy('');
            }
        },
        [isClubAdmin, t],
    );
    const handleUpdatePlayer = async (userId: number, jerseyNumber: number | null, squadRole: string | null) => {
        if (!squadId || !isClubAdmin) return;
        await runAction(`player:${userId}`, async () => {
            await updateSquadPlayer(clubId, squadId, userId, { jerseyNumber, squadRole });
            setRefreshRoster((value) => value + 1);
        });
    };
    const saveSquad = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingSquad || !isClubAdmin) return;
        if (!editingSquad.name.trim() || !editingSquad.category.trim()) {
            setError(t('squadDesign.public.squadRequired', { defaultValue: 'Add a squad name and age group.' }));
            return;
        }
        try {
            await runAction('squad', async () => {
                const edited = {
                    ...editingSquad,
                    name: editingSquad.name.trim(),
                    category: editingSquad.category.trim(),
                };
                await updateSquad(clubId, edited.id, {
                    name: edited.name,
                    category: edited.category,
                    gender: edited.gender,
                });
                setContext((value) =>
                    value && value.clubId === clubId
                        ? { ...value, squads: value.squads.map((squad) => (squad.id === edited.id ? edited : squad)) }
                        : value,
                );
                setEditingSquad(null);
            });
        } catch {
            /* The inline alert keeps the draft available. */
        }
    };
    const confirmDelete = async () => {
        if (!pendingDelete || !isClubAdmin) return;
        try {
            await runAction('delete', async () => {
                await deleteSquad(clubId, pendingDelete.id);
                setContext((value) =>
                    value && value.clubId === clubId
                        ? { ...value, squads: value.squads.filter((squad) => squad.id !== pendingDelete.id) }
                        : value,
                );
                setPendingDelete(null);
            });
        } catch {
            setPendingDelete(null);
        }
    };
    const confirmRemove = async () => {
        if (!pendingRemove || !isClubAdmin) return;
        try {
            await runAction(`remove:${pendingRemove.userId}`, async () => {
                await removePlayerFromSquad(clubId, pendingRemove.squadId, pendingRemove.userId);
                setPendingRemove(null);
                setRefreshRoster((value) => value + 1);
            });
        } catch {
            setPendingRemove(null);
        }
    };

    if (loadingClub || context?.clubId !== clubId)
        return (
            <div className="squad-design squad-design-public sp-page">
                <div className="sd-empty" role="status">
                    <Loader2 size={28} className="animate-spin" />
                    <p>{t('squadDesign.public.loading', { defaultValue: 'Loading squads…' })}</p>
                </div>
            </div>
        );
    if (!club)
        return (
            <div className="squad-design squad-design-public sp-page">
                <div className="sd-empty" role="alert">
                    <h1>{t('squadDesign.public.unavailable', { defaultValue: 'This club could not be loaded' })}</h1>
                    <button type="button" className="sd-button" onClick={() => setRetryContext((value) => value + 1)}>
                        {t('squadDesign.public.retry', { defaultValue: 'Try again' })}
                    </button>
                    <Link to="/clubs" className="sd-button">
                        {t('squadDesign.public.returnClubs', { defaultValue: 'Browse clubs' })}
                    </Link>
                </div>
            </div>
        );
    const rosterProps = {
        groups: filteredGroups,
        editable: isClubAdmin,
        showManagementDetails: isClubAdmin,
        onRemovePlayer: (userId: number, name: string) => {
            if (isClubAdmin && squadId) setPendingRemove({ squadId, userId, name });
        },
        onUpdatePlayer: handleUpdatePlayer,
        removingPlayerId: busy.startsWith('remove:') ? Number(busy.split(':')[1]) : null,
        cardUserIds: isClubAdmin ? cardUserIds : null,
        onEditCard: (userId: number) => {
            if (isClubAdmin) setEditingCard(adminCards.find((card) => card.userId === userId) ?? null);
        },
    };
    return (
        <div className="squad-design squad-design-public sp-page">
            <Link to={`/clubs/${club.id}?tab=teams`} className="sp-back">
                <ArrowLeft size={15} />
                {club.name}
            </Link>
            <header className="sp-page-heading">
                <div>
                    <p className="sd-eyebrow">
                        {t('squadDesign.public.clubFootball', { defaultValue: 'Club football' })}
                    </p>
                    <h1 className="sp-title">
                        {t('squadDesign.public.squads', { defaultValue: 'Squads' })}
                        <span className="sp-dot">.</span>
                    </h1>
                    <p className="sp-club-line">
                        {club.name}
                        {club.isOfficial && (
                            <ShieldCheck
                                size={16}
                                aria-label={t('squadDesign.public.verified', { defaultValue: 'Verified club' })}
                            />
                        )}
                    </p>
                </div>
                <div className="sp-page-aside">
                    {club.addressText && (
                        <p>
                            <MapPin size={14} />
                            {club.addressText}
                        </p>
                    )}
                    {isClubAdmin && (
                        <Link to={`/clubs/${club.id}/workspace?tab=squads`} className="sd-button">
                            {t('squadDesign.public.manageWorkspace', { defaultValue: 'Open squad workspace' })}
                            <ArrowRight size={14} />
                        </Link>
                    )}
                </div>
            </header>
            {error && (
                <div className="sp-alert" role="alert">
                    <span>{error}</span>
                    <button
                        className="sd-icon-button"
                        type="button"
                        aria-label={t('squadDesign.public.dismiss', { defaultValue: 'Dismiss message' })}
                        onClick={() => setError('')}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
            {squads.length === 0 ? (
                <div className="sd-empty">
                    <Shield size={28} />
                    <h2>{t('squadDesign.public.noSquads', { defaultValue: 'The team starts here' })}</h2>
                    <p>
                        {t('squadDesign.public.emptyDescription', {
                            defaultValue: 'This club has not shared any squads yet.',
                        })}
                    </p>
                    {isClubAdmin && (
                        <Link to={`/clubs/${club.id}/workspace?tab=squads`} className="sd-primary">
                            <Plus size={16} />
                            {t('squads.createSquad')}
                        </Link>
                    )}
                </div>
            ) : (
                <div className="sp-layout">
                    <aside
                        className="sp-squad-nav"
                        aria-label={t('squadDesign.public.chooseSquad', { defaultValue: 'Choose a squad' })}
                    >
                        <div className="sp-nav-heading">
                            <span>{t('squadDesign.public.allSquads', { defaultValue: 'All squads' })}</span>
                            <span>{squads.length}</span>
                        </div>
                        <div className="sp-nav-items">
                            {squads.map((squad) => (
                                <button
                                    type="button"
                                    key={squad.id}
                                    onClick={() => chooseSquad(squad.id)}
                                    className={squad.id === squadId ? 'is-active' : ''}
                                    aria-current={squad.id === squadId ? 'true' : undefined}
                                >
                                    <span>
                                        <strong>{squad.name}</strong>
                                        <small>
                                            {squadLabel(squad.category, t)} · {squadLabel(squad.gender, t)}
                                        </small>
                                    </span>
                                    <ChevronRight size={15} />
                                </button>
                            ))}
                        </div>
                    </aside>
                    <section className="sp-roster-main">
                        <header className="sp-roster-heading">
                            <div>
                                <p className="sd-eyebrow">
                                    {squadLabel(selectedSquad?.category, t)} · {squadLabel(selectedSquad?.gender, t)}
                                </p>
                                <h2>{selectedSquad?.name}</h2>
                                <MatchHistoryLink clubId={club.id} squadId={selectedSquad?.id} className="sd-button" />
                                <p className="sp-roster-count">
                                    <Users size={14} />
                                    {loadingRoster
                                        ? t('squadDesign.public.loadingRoster', { defaultValue: 'Loading roster…' })
                                        : t('squadDesign.public.playerCount', {
                                              defaultValue: '{{count}} players',
                                              count: players.length,
                                          })}
                                </p>
                            </div>
                            {isClubAdmin && selectedSquad && (
                                <div className="sp-roster-management">
                                    <button
                                        type="button"
                                        className="sd-icon-button"
                                        aria-label={t('squadDesign.public.editSquad', { defaultValue: 'Edit squad' })}
                                        onClick={() => setEditingSquad(selectedSquad)}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="sd-icon-button sr-remove"
                                        aria-label={t('squadDesign.public.deleteSquad', {
                                            defaultValue: 'Delete squad',
                                        })}
                                        onClick={() => setPendingDelete(selectedSquad)}
                                        disabled={Boolean(busy)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="sd-primary"
                                        onClick={() => setShowAddPlayers(true)}
                                    >
                                        <Plus size={16} />
                                        {t('squadDesign.public.addPlayers', { defaultValue: 'Add players' })}
                                    </button>
                                </div>
                            )}
                        </header>
                        {editingSquad && isClubAdmin && (
                            <form className="sp-squad-edit" onSubmit={(event) => void saveSquad(event)}>
                                <label>
                                    {t('squadDesign.public.squadName', { defaultValue: 'Squad name' })}
                                    <input
                                        value={editingSquad.name}
                                        required
                                        maxLength={100}
                                        onChange={(event) =>
                                            setEditingSquad((value) => value && { ...value, name: event.target.value })
                                        }
                                    />
                                </label>
                                <label>
                                    {t('squadDesign.public.category', { defaultValue: 'Age group' })}
                                    <input
                                        value={editingSquad.category}
                                        required
                                        maxLength={30}
                                        onChange={(event) =>
                                            setEditingSquad(
                                                (value) =>
                                                    value && { ...value, category: event.target.value.toUpperCase() },
                                            )
                                        }
                                    />
                                </label>
                                <label>
                                    {t('squadDesign.public.gender', { defaultValue: 'Gender' })}
                                    <select
                                        value={editingSquad.gender}
                                        onChange={(event) =>
                                            setEditingSquad(
                                                (value) => value && { ...value, gender: event.target.value },
                                            )
                                        }
                                    >
                                        {['MALE', 'FEMALE', 'MIXED'].map((gender) => (
                                            <option key={gender} value={gender}>
                                                {squadLabel(gender, t)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div>
                                    <button
                                        type="button"
                                        className="sd-button"
                                        onClick={() => setEditingSquad(null)}
                                        disabled={Boolean(busy)}
                                    >
                                        {t('squadDesign.roster.cancel', { defaultValue: 'Cancel' })}
                                    </button>
                                    <button className="sd-primary" type="submit" disabled={Boolean(busy)}>
                                        {busy === 'squad' ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Check size={14} />
                                        )}
                                        {t('squadDesign.roster.save', { defaultValue: 'Save changes' })}
                                    </button>
                                </div>
                            </form>
                        )}
                        <div className="sd-toolbar sp-toolbar">
                            <label className="sd-search">
                                <Search size={16} />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={t('squadDesign.public.searchPlayers', {
                                        defaultValue: 'Search players or shirt number',
                                    })}
                                    aria-label={t('squadDesign.public.searchPlayers', {
                                        defaultValue: 'Search players or shirt number',
                                    })}
                                />
                            </label>
                            <select
                                className="sp-position-filter"
                                value={position}
                                onChange={(event) => setPosition(event.target.value)}
                                aria-label={t('squadDesign.roster.position', { defaultValue: 'Position' })}
                            >
                                <option value="">
                                    {t('squadDesign.public.allPositions', { defaultValue: 'All positions' })}
                                </option>
                                {positions.map((value) => (
                                    <option key={value} value={value}>
                                        {squadLabel(value, t)}
                                    </option>
                                ))}
                            </select>
                            <div
                                className="sd-segments"
                                role="group"
                                aria-label={t('squadDesign.public.rosterView', { defaultValue: 'Roster view' })}
                            >
                                <button type="button" aria-pressed={!cardView} onClick={() => setCardView(false)}>
                                    <List size={15} />
                                    {t('squadDesign.public.roster', { defaultValue: 'Roster' })}
                                </button>
                                <button type="button" aria-pressed={cardView} onClick={() => setCardView(true)}>
                                    <LayoutGrid size={14} />
                                    {t('squadDesign.public.cards', { defaultValue: 'Cards' })}
                                </button>
                            </div>
                        </div>
                        {(search || position) && (
                            <div className="sp-filter-summary">
                                <span>
                                    {t('squadDesign.public.showingPlayers', {
                                        defaultValue: '{{shown}} of {{total}} players',
                                        shown: shownCount,
                                        total: players.length,
                                    })}
                                </span>
                                <button className="sd-button" type="button" onClick={resetFilters}>
                                    {t('squadDesign.public.clearFilters', { defaultValue: 'Clear filters' })}
                                </button>
                            </div>
                        )}
                        {loadingRoster ? (
                            <div className="sd-empty" role="status">
                                <Loader2 size={25} className="animate-spin" />
                                <p>{t('squadDesign.public.loadingRoster', { defaultValue: 'Loading roster…' })}</p>
                            </div>
                        ) : roster?.error ? (
                            <div className="sd-empty" role="alert">
                                <p>
                                    {t('squadDesign.public.rosterFailed', {
                                        defaultValue: 'Could not load this roster.',
                                    })}
                                </p>
                                <button
                                    type="button"
                                    className="sd-button"
                                    onClick={() => setRefreshRoster((value) => value + 1)}
                                >
                                    {t('squadDesign.public.retry', { defaultValue: 'Try again' })}
                                </button>
                            </div>
                        ) : shownCount === 0 && (search || position) ? (
                            <div className="sd-empty">
                                <Search size={24} />
                                <h3>
                                    {t('squadDesign.public.noPlayersFound', { defaultValue: 'No matching players' })}
                                </h3>
                                <button type="button" className="sd-button" onClick={resetFilters}>
                                    {t('squadDesign.public.clearFilters', { defaultValue: 'Clear filters' })}
                                </button>
                            </div>
                        ) : cardView ? (
                            <SquadRosterGrid key={`${rosterScope}:cards`} {...rosterProps} />
                        ) : (
                            <SquadRosterTable key={`${rosterScope}:roster`} {...rosterProps} />
                        )}
                    </section>
                </div>
            )}
            {isClubAdmin && selectedSquad && (
                <AddPlayerToSquadModal
                    clubId={clubId}
                    squadId={selectedSquad.id}
                    squadName={selectedSquad.name}
                    existingPlayerIds={players.map((player) => player.id)}
                    isOpen={showAddPlayers}
                    onClose={() => setShowAddPlayers(false)}
                    onPlayersAdded={() => {
                        setRefreshRoster((value) => value + 1);
                        setRefreshCards((value) => value + 1);
                    }}
                />
            )}
            {isClubAdmin && (
                <PlayerCardModal
                    clubId={clubId}
                    isOpen={editingCard != null}
                    onClose={() => setEditingCard(null)}
                    card={editingCard}
                    onCardUpdated={() => {
                        setRefreshRoster((value) => value + 1);
                        setRefreshCards((value) => value + 1);
                    }}
                />
            )}
            <ConfirmDialog
                open={isClubAdmin && pendingDelete != null}
                title={t('squadDesign.public.deleteSquad', { defaultValue: 'Delete squad' })}
                message={t('squadDesign.public.deleteMessage', {
                    defaultValue: 'Delete “{{name}}”? Remove all players from the squad first.',
                    name: pendingDelete?.name,
                })}
                confirmLabel={t('squadDesign.public.delete', { defaultValue: 'Delete' })}
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => {
                    if (!busy) setPendingDelete(null);
                }}
            />
            <ConfirmDialog
                open={isClubAdmin && pendingRemove != null}
                title={t('squadDesign.public.removeTitle', { defaultValue: 'Remove player from squad' })}
                message={t('squadDesign.public.removeMessage', {
                    defaultValue: 'Remove {{name}} from this squad? Their club membership stays the same.',
                    name: pendingRemove?.name,
                })}
                confirmLabel={t('squadDesign.public.remove', { defaultValue: 'Remove' })}
                variant="danger"
                onConfirm={() => void confirmRemove()}
                onCancel={() => {
                    if (!busy) setPendingRemove(null);
                }}
            />
        </div>
    );
};
