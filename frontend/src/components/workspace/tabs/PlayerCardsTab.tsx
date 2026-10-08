import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { fetchPlayerCards, deletePlayerCard, type PlayerCard } from '../../../features/clubs/api';
import { IdentityActivationForm } from '../../../features/parents/IdentityActivationForm';
import { PlayerCardModal } from '../../squads/PlayerCardModal';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { MediaImage } from '../../ui/MediaImage';
import { ErrorBlock } from '../helpers';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import '../../squads/squad-design.css';
import '../../squads/player-roster-forms.css';

interface SquadDto {
    id: number;
    name: string;
}
interface PlayerCardsTabProps {
    clubId: number;
    setParentError: (msg: string | null) => void;
    setParentSuccess: (msg: string | null) => void;
}

export const PlayerCardsTab = ({ clubId, setParentError, setParentSuccess }: PlayerCardsTabProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [cards, setCards] = useState<PlayerCard[]>([]);
    const [squads, setSquads] = useState<SquadDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [squadFilter, setSquadFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [editingCard, setEditingCard] = useState<PlayerCard | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PlayerCard | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const loadVersion = useRef(0);
    const deleting = useRef(false);

    const load = useCallback(async () => {
        const version = ++loadVersion.current;
        setLoading(true);
        setLoadError(null);
        const [cardsResult, squadsResult] = await Promise.allSettled([
            fetchPlayerCards(clubId),
            apiClient.get<SquadDto[]>(`/clubs/${clubId}/squads`),
        ]);
        if (version !== loadVersion.current) return;
        if (cardsResult.status === 'fulfilled') setCards(cardsResult.value);
        else {
            setLoadError(
                cardsResult.reason instanceof Error
                    ? cardsResult.reason.message
                    : t('squadDesign.loadCardsFailed', { defaultValue: 'Could not load player cards.' }),
            );
            setCards([]);
        }
        if (squadsResult.status === 'fulfilled') setSquads(squadsResult.value.data || []);
        else setSquads([]);
        setLoading(false);
    }, [clubId, t]);
    useEffect(() => {
        void load();
        return () => {
            loadVersion.current += 1;
        };
    }, [load]);

    const squadNames = useMemo(() => new Map(squads.map((squad) => [squad.id, squad.name])), [squads]);
    const filtered = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return cards.filter((card) => {
            if (squadFilter === 'none' && card.squadId != null) return false;
            if (squadFilter !== 'all' && squadFilter !== 'none' && card.squadId !== Number(squadFilter)) return false;
            if (statusFilter === 'registered' && !card.registered) return false;
            if (statusFilter === 'cards' && card.registered) return false;
            return (
                !query ||
                `${card.fullName ?? ''} ${card.parentEmail ?? ''} ${card.position?.replaceAll('_', ' ') ?? ''}`
                    .toLocaleLowerCase()
                    .includes(query)
            );
        });
    }, [cards, search, squadFilter, statusFilter]);

    const handleDelete = async () => {
        if (!deleteTarget || deleting.current) return;
        deleting.current = true;
        setDeletingId(deleteTarget.id);
        try {
            await deletePlayerCard(clubId, deleteTarget.id);
            setParentSuccess(
                t(deleteTarget.registered ? 'minors.playerCard.removed' : 'minors.playerCard.deleted', {
                    name: deleteTarget.fullName ?? '',
                }),
            );
            setDeleteTarget(null);
            await load();
        } catch (err: unknown) {
            setParentError(err instanceof Error ? err.message : t('minors.playerCard.deleteFailed'));
        } finally {
            deleting.current = false;
            setDeletingId(null);
        }
    };
    const reset = () => {
        setSearch('');
        setSquadFilter('all');
        setStatusFilter('all');
    };
    return (
        <section className="squad-design prc-workspace">
            <header className="prc-heading">
                <div>
                    <p className="sd-eyebrow">{t('squadDesign.clubRoster', { defaultValue: 'Club roster' })}</p>
                    <h2>
                        {t('minors.playerCard.tabLabel')}
                        <span>.</span>
                    </h2>
                    <p>
                        {t('squadDesign.cardsDescription', {
                            defaultValue:
                                'Every player has a place. Create and manage roster entries before they have an account.',
                        })}
                    </p>
                </div>
                <button type="button" onClick={() => navigate(`/clubs/${clubId}/workspace?tab=admissions&intake=1`)} className="sd-primary">
                    <Plus size={17} />
                    Add / invite player
                </button>
            </header>
            <div className="prc-toolbar">
                <label className="prc-search">
                    <Search size={18} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('squadDesign.searchPlayerCards', { defaultValue: 'Search player cards' })}
                        aria-label={t('squadDesign.searchPlayerCards', { defaultValue: 'Search player cards' })}
                    />
                    {search && (
                        <button
                            type="button"
                            className="prf-icon"
                            onClick={() => setSearch('')}
                            aria-label={t('squadDesign.clearSearch', { defaultValue: 'Clear search' })}
                        >
                            <X size={15} />
                        </button>
                    )}
                </label>
                <select
                    aria-label={t('squadDesign.filterBySquad', { defaultValue: 'Filter by squad' })}
                    value={squadFilter}
                    onChange={(e) => setSquadFilter(e.target.value)}
                >
                    <option value="all">{t('squadDesign.allSquads', { defaultValue: 'All squads' })}</option>
                    <option value="none">{t('minors.playerCard.noSquad')}</option>
                    {squads.map((squad) => (
                        <option key={squad.id} value={squad.id}>
                            {squad.name}
                        </option>
                    ))}
                </select>
                <select
                    aria-label={t('squadDesign.filterByAccount', { defaultValue: 'Filter by account' })}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">{t('squadDesign.allAccounts', { defaultValue: 'All accounts' })}</option>
                    <option value="cards">{t('minors.playerCard.notRegistered')}</option>
                    <option value="registered">{t('minors.playerCard.registered')}</option>
                </select>
            </div>
            {loading ? (
                <div className="prf-empty" role="status">
                    <Loader2 size={24} className="animate-spin" />
                    <p>{t('squadDesign.loadingCards', { defaultValue: 'Loading player cards…' })}</p>
                </div>
            ) : loadError ? (
                <ErrorBlock message={loadError} onRetry={() => void load()} />
            ) : cards.length === 0 ? (
                <div className="prf-empty prc-empty">
                    <CreditCard size={32} />
                    <h3>{t('squadDesign.startPlayerCards', { defaultValue: 'Start with your first player' })}</h3>
                    <p>{t('minors.playerCard.noCards')}</p>
                    <button type="button" className="sd-primary" onClick={() => navigate(`/clubs/${clubId}/workspace?tab=admissions&intake=1`)}>
                        <Plus size={16} />
                        Add / invite player
                    </button>
                </div>
            ) : (
                <>
                    <div className="prc-list-meta">
                        <p>
                            {t('squadDesign.cardCount', {
                                defaultValue: '{{count}} player cards',
                                count: filtered.length,
                            })}
                        </p>
                        {(search || squadFilter !== 'all' || statusFilter !== 'all') && (
                            <button type="button" onClick={reset}>
                                {t('squadDesign.resetFilters', { defaultValue: 'Reset filters' })}
                            </button>
                        )}
                    </div>
                    {filtered.length === 0 ? (
                        <div className="prf-empty">
                            <Search size={26} />
                            <h3>{t('squadDesign.noMatchingCards', { defaultValue: 'No matching player cards' })}</h3>
                            <button type="button" className="sd-button" onClick={reset}>
                                {t('squadDesign.resetFilters', { defaultValue: 'Reset filters' })}
                            </button>
                        </div>
                    ) : (
                        <div className="prc-list">
                            <div className="prc-column-labels" aria-hidden="true">
                                <span>{t('squadDesign.player', { defaultValue: 'Player' })}</span>
                                <span>{t('minors.playerCard.squad')}</span>
                                <span>{t('squadDesign.guardian', { defaultValue: 'Parent or guardian' })}</span>
                                <span>{t('minors.playerCard.status')}</span>
                                <span />
                            </div>
                            <ul>
                                {filtered.map((card) => {
                                    const name =
                                        card.fullName || t('squadDesign.newPlayer', { defaultValue: 'Player' });
                                    const photo =
                                        card.birthYear != null && new Date().getFullYear() - card.birthYear < 13
                                            ? null
                                            : resolveMediaUrl(card.photoUrl);
                                    return (
                                        <li className="prc-row" key={card.id}>
                                            <div className="prc-player">
                                                <span className="prf-avatar">
                                                    {photo ? (
                                                        <MediaImage src={photo} alt="" loading="lazy" />
                                                    ) : (
                                                        name
                                                            .split(/\s+/)
                                                            .slice(0, 2)
                                                            .map((word) => word[0])
                                                            .join('')
                                                    )}
                                                </span>
                                                <div>
                                                    <button
                                                        type="button"
                                                        className="prc-name"
                                                        onClick={() => setEditingCard(card)}
                                                    >
                                                        {name}
                                                    </button>
                                                    <p>
                                                        {card.jerseyNumber != null && (
                                                            <span>#{card.jerseyNumber} · </span>
                                                        )}
                                                        {card.position &&
                                                            t(`squadDesign.positions.${card.position}`, {
                                                                defaultValue: card.position
                                                                    .replaceAll('_', ' ')
                                                                    .toLowerCase(),
                                                            })}
                                                        {card.birthYear != null && (
                                                            <span>
                                                                {card.position ? ' · ' : ''}
                                                                {t('squadDesign.bornYear', {
                                                                    defaultValue: 'Born {{year}}',
                                                                    year: card.birthYear,
                                                                })}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="prc-squad">
                                                {squadNames.get(card.squadId ?? -1) ?? t('minors.playerCard.noSquad')}
                                            </div>
                                            <div className="prc-guardian" title={card.parentEmail ?? ''}>
                                                {card.parentEmail || '—'}
                                            </div>
                                            <div className="prc-status">
                                                <span className={card.registered ? 'is-active' : ''}>
                                                    {t(
                                                        card.registered
                                                            ? 'minors.playerCard.registered'
                                                            : 'minors.playerCard.notRegistered',
                                                    )}
                                                </span>
                                                {card.claimed && <small>{t('minors.playerCard.claimed')}</small>}
                                            </div>
                                            <div className="prc-actions">
                                                {!card.registered && card.birthYear != null && new Date().getFullYear() - card.birthYear >= 18 && <IdentityActivationForm adult path={`/clubs/${clubId}/player-cards/${card.id}/activation-invitation`} onChanged={() => void load()} />}
                                                <button
                                                    type="button"
                                                    className="sd-icon-button"
                                                    aria-label={t('squadDesign.editNamedPlayer', {
                                                        defaultValue: 'Edit {{name}}',
                                                        name,
                                                    })}
                                                    onClick={() => setEditingCard(card)}
                                                    title={t('minors.playerCard.edit')}
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <details className="prc-more">
                                                    <summary
                                                        className="sd-icon-button"
                                                        aria-label={t('squadDesign.morePlayerActions', {
                                                            defaultValue: 'More actions for {{name}}',
                                                            name,
                                                        })}
                                                    >
                                                        <MoreHorizontal size={18} />
                                                    </summary>
                                                    <div>
                                                        <button
                                                            type="button"
                                                            disabled={deletingId === card.id}
                                                            onClick={(event) => {
                                                                const details = event.currentTarget.closest('details');
                                                                if (details) details.open = false;
                                                                setDeleteTarget(card);
                                                            }}
                                                        >
                                                            <Trash2 size={15} />
                                                            {t(
                                                                card.registered
                                                                    ? 'minors.playerCard.remove'
                                                                    : 'minors.playerCard.delete',
                                                            )}
                                                        </button>
                                                    </div>
                                                </details>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </>
            )}
            <PlayerCardModal
                clubId={clubId}
                squadName={editingCard?.squadId ? squadNames.get(editingCard.squadId) : undefined}
                isOpen={editingCard != null}
                onClose={() => setEditingCard(null)}
                card={editingCard}
                onCardUpdated={async () => {
                    await load();
                    setParentSuccess(t('minors.playerCard.updated'));
                }}
            />
            <ConfirmDialog
                open={deleteTarget != null}
                title={t(deleteTarget?.registered ? 'minors.playerCard.remove' : 'minors.playerCard.delete')}
                message={
                    deleteTarget
                        ? t(
                              deleteTarget.registered
                                  ? 'minors.playerCard.removeConfirm'
                                  : 'minors.playerCard.deleteConfirm',
                              { name: deleteTarget.fullName ?? '' },
                          )
                        : ''
                }
                confirmLabel={
                    deletingId
                        ? t('squadDesign.removing', { defaultValue: 'Removing…' })
                        : t(deleteTarget?.registered ? 'minors.playerCard.remove' : 'minors.playerCard.delete')
                }
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => {
                    if (!deleting.current) setDeleteTarget(null);
                }}
            />
        </section>
    );
};
