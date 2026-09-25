import axios from 'axios';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, CreditCard, Loader2, Search, Users, X } from 'lucide-react';
import { MediaImage } from '../ui/MediaImage';
import { addPlayerToSquad, batchAddPlayersToSquad, fetchClubPlayers } from '../../features/clubs/api';
import type { ClubPlayerAffiliation } from '../../features/clubs/domain';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { PlayerCardModal } from './PlayerCardModal';
import './player-roster-forms.css';

interface AddPlayerToSquadModalProps {
    clubId: number;
    squadId: number;
    squadName?: string;
    existingPlayerIds?: number[];
    isOpen: boolean;
    onClose: () => void;
    onPlayersAdded: () => void;
}
interface PlayerCache {
    clubId: number;
    loadedAt: number;
    players: ClubPlayerAffiliation[];
}
const NO_PLAYER_IDS: number[] = [];

export function AddPlayerToSquadModal(props: AddPlayerToSquadModalProps) {
    // Per mounted workspace only; never shared between sessions or clubs.
    const cache = useRef<PlayerCache | null>(null);
    return props.isOpen ? <PlayerPicker key={`${props.clubId}:${props.squadId}`} {...props} cache={cache} /> : null;
}

function PlayerPicker({
    clubId,
    squadId,
    squadName,
    existingPlayerIds = NO_PLAYER_IDS,
    onClose,
    onPlayersAdded,
    cache,
}: AddPlayerToSquadModalProps & { cache: RefObject<PlayerCache | null> }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [players, setPlayers] = useState<ClubPlayerAffiliation[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const [visibleLimit, setVisibleLimit] = useState(100);
    const [showCardModal, setShowCardModal] = useState(false);
    const busy = useRef(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const close = () => {
        if (!busy.current) onClose();
    };
    useDialogFocus(!showCardModal, dialogRef, close, searchRef);

    useEffect(() => {
        let current = true;
        const load = async () => {
            try {
                let all: ClubPlayerAffiliation[];
                if (cache.current?.clubId === clubId && Date.now() - cache.current.loadedAt < 60000) {
                    all = cache.current.players;
                } else {
                    // This endpoint has a maximum page size of 50. Complete the pool once,
                    // then search locally so clearing a query immediately restores every player.
                    const first = await fetchClubPlayers(clubId, undefined, 0, 50);
                    if (!current) return;
                    all = [...first.content];
                    const pages = Math.ceil(first.totalElements / (first.pageSize || 50));
                    for (let page = 1; page < pages; page += 4) {
                        const results = await Promise.all(
                            Array.from({ length: Math.min(4, pages - page) }, (_, offset) =>
                                fetchClubPlayers(clubId, undefined, page + offset, 50),
                            ),
                        );
                        if (!current) return;
                        all.push(...results.flatMap((result) => result.content));
                    }
                    all = Array.from(new Map(all.map((player) => [player.userId, player])).values());
                    cache.current = { clubId, loadedAt: Date.now(), players: all };
                }
                if (current) setPlayers(all);
            } catch (err) {
                if (current)
                    setError(
                        axios.isAxiosError<{ message?: string }>(err)
                            ? err.response?.data?.message ||
                                  t('squadDesign.loadPlayersFailed', { defaultValue: 'Could not load players.' })
                            : t('squadDesign.loadPlayersFailed', { defaultValue: 'Could not load players.' }),
                    );
            } finally {
                if (current) setLoading(false);
            }
        };
        void load();
        return () => {
            current = false;
        };
    }, [cache, clubId, retry, t]);

    const available = useMemo(() => {
        const assigned = new Set(existingPlayerIds);
        return players.filter(
            (player) => (player.status === 'ACTIVE' || player.status === 'TRIALIST') && !assigned.has(player.userId),
        );
    }, [players, existingPlayerIds]);
    const filtered = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        return query
            ? available.filter((player) =>
                  `${player.fullName ?? ''} ${player.username ?? ''}`.toLocaleLowerCase().includes(query),
              )
            : available;
    }, [available, search]);
    const needsConsent = (player: ClubPlayerAffiliation) =>
        player.requiresParentalConsent === true && player.parentalConsentStatus !== 'CONFIRMED';
    const selectedPlayers = available.filter((player) => selected.has(player.userId) && !needsConsent(player));

    const handleAddSelected = async () => {
        if (selectedPlayers.length === 0 || busy.current) return;
        busy.current = true;
        setSaving(true);
        setError(null);
        try {
            const payloads = selectedPlayers.map(({ userId }) => ({ userId }));
            if (payloads.length === 1) await addPlayerToSquad(clubId, squadId, payloads[0]);
            else await batchAddPlayersToSquad(clubId, squadId, { players: payloads });
            onPlayersAdded();
            onClose();
        } catch (caught) {
            const err = axios.isAxiosError<{ message?: string }>(caught) ? caught : undefined;
            setError(
                err?.response?.data?.message ||
                    err?.message ||
                    t('squadDesign.addPlayersFailed', { defaultValue: 'Failed to add players.' }),
            );
        } finally {
            busy.current = false;
            setSaving(false);
        }
    };

    return (
        <div
            className="prf-overlay squad-design"
            onClick={(e) => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div
                className="prf-dialog prf-picker"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="prf-add-players-title"
                tabIndex={-1}
            >
                <header className="prf-header">
                    <div>
                        <p className="prf-eyebrow">{squadName ?? t('minors.playerCard.squad')}</p>
                        <h2 id="prf-add-players-title">
                            {t('squadDesign.addPlayers', { defaultValue: 'Add players' })}
                            <span>.</span>
                        </h2>
                    </div>
                    <button
                        type="button"
                        className="prf-icon"
                        onClick={close}
                        disabled={saving}
                        aria-label={t('squads.design.close', { defaultValue: 'Close' })}
                    >
                        <X size={20} />
                    </button>
                </header>
                <div className="prf-picker-intro">
                    <div>
                        <Users size={18} />
                        <div>
                            <strong>{t('squadDesign.clubPlayers', { defaultValue: 'From your club' })}</strong>
                            <p>
                                {t('squadDesign.selectPlayersHint', { defaultValue: 'Choose players for this squad.' })}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCardModal(true)}
                        disabled={saving}
                        className="prf-new-card"
                    >
                        <CreditCard size={18} />
                        <span>
                            <strong>{t('squadDesign.noAccountYet', { defaultValue: 'No account yet?' })}</strong>
                            <small>{t('squadDesign.createPlayerCard', { defaultValue: 'Create a player card' })}</small>
                        </span>
                        <ChevronRight size={17} />
                    </button>
                </div>
                <div className="prf-picker-search">
                    <Search size={18} />
                    <input
                        ref={searchRef}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setVisibleLimit(100);
                        }}
                        placeholder={t('squadDesign.searchPlayers', {
                            defaultValue: 'Search players by name or username',
                        })}
                        aria-label={t('squadDesign.searchPlayers', {
                            defaultValue: 'Search players by name or username',
                        })}
                        disabled={saving}
                    />
                    {search && (
                        <button
                            className="prf-icon"
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label={t('squadDesign.clearSearch', { defaultValue: 'Clear search' })}
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
                <div className="prf-player-list" aria-busy={loading}>
                    {error && (
                        <div className="prf-error" role="alert">
                            {error}
                            {players.length === 0 && (
                                <button
                                    type="button"
                                    className="prf-button"
                                    onClick={() => {
                                        cache.current = null;
                                        setLoading(true);
                                        setError(null);
                                        setRetry((value) => value + 1);
                                    }}
                                >
                                    {t('squads.design.retry', { defaultValue: 'Retry' })}
                                </button>
                            )}
                        </div>
                    )}
                    {loading ? (
                        <div className="prf-empty">
                            <Loader2 className="animate-spin" size={24} />
                            <p>{t('squadDesign.loadingPlayers', { defaultValue: 'Loading club players…' })}</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="prf-empty">
                            <Users size={28} />
                            <h3>
                                {search
                                    ? t('squadDesign.noMatchingPlayers', { defaultValue: 'No matching players' })
                                    : t('squadDesign.noAvailablePlayers', {
                                          defaultValue: 'No players to add right now',
                                      })}
                            </h3>
                            <p>
                                {search
                                    ? t('squadDesign.tryAnotherName', {
                                          defaultValue: 'Try another name or clear your search.',
                                      })
                                    : t('squadDesign.noAvailableHint', {
                                          defaultValue:
                                              'Current players already in this squad are hidden. You can also create a card for a new player.',
                                      })}
                            </p>
                            {search && (
                                <button type="button" className="prf-button" onClick={() => setSearch('')}>
                                    {t('squadDesign.clearSearch', { defaultValue: 'Clear search' })}
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {filtered.slice(0, visibleLimit).map((player) => {
                                const checked = selected.has(player.userId);
                                const waiting = needsConsent(player);
                                const name =
                                    player.fullName ||
                                    player.username ||
                                    t('squadDesign.newPlayer', { defaultValue: 'Player' });
                                return (
                                    <label
                                        key={player.userId}
                                        className={`prf-player-option ${checked ? 'is-selected' : ''} ${waiting ? 'is-unavailable' : ''}`}
                                    >
                                        <span className="prf-avatar">
                                            {resolveMediaUrl(player.avatarUrl) ? (
                                                <MediaImage
                                                    src={resolveMediaUrl(player.avatarUrl)}
                                                    alt=""
                                                    loading="lazy"
                                                />
                                            ) : (
                                                name
                                                    .split(/\s+/)
                                                    .slice(0, 2)
                                                    .map((word) => word[0])
                                                    .join('')
                                            )}
                                        </span>
                                        <span className="prf-player-name">
                                            <strong>{name}</strong>
                                            <small>
                                                {waiting
                                                    ? t('squadDesign.consentBeforeAdding', {
                                                          defaultValue: 'Confirm parental consent in Players first',
                                                      })
                                                    : player.position
                                                      ? t(`squadDesign.positions.${player.position}`, {
                                                            defaultValue: player.position
                                                                .replaceAll('_', ' ')
                                                                .toLowerCase(),
                                                        })
                                                      : player.username
                                                        ? `@${player.username}`
                                                        : t(`squadDesign.status.${player.status}`, {
                                                              defaultValue: player.status.toLowerCase(),
                                                          })}
                                            </small>
                                        </span>
                                        {player.status === 'TRIALIST' && (
                                            <span className="prf-trialist">
                                                {t('squadDesign.trialist', { defaultValue: 'Trialist' })}
                                            </span>
                                        )}
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={saving || waiting}
                                            onChange={() =>
                                                setSelected((previous) => {
                                                    const next = new Set(previous);
                                                    if (next.has(player.userId)) next.delete(player.userId);
                                                    else next.add(player.userId);
                                                    return next;
                                                })
                                            }
                                            aria-label={t('squadDesign.selectPlayer', {
                                                defaultValue: 'Select {{name}}',
                                                name,
                                            })}
                                        />
                                        <span className="prf-check" aria-hidden="true">
                                            {checked && <Check size={15} />}
                                        </span>
                                    </label>
                                );
                            })}
                            {filtered.length > visibleLimit && (
                                <button
                                    type="button"
                                    className="prf-button prf-show-more"
                                    onClick={() => setVisibleLimit((value) => value + 100)}
                                >
                                    {t('squadDesign.showMorePlayers', { defaultValue: 'Show more players' })}
                                </button>
                            )}
                        </>
                    )}
                </div>
                <footer className="prf-footer">
                    <p>
                        {t('squadDesign.selectedCount', {
                            defaultValue: '{{count}} selected',
                            count: selectedPlayers.length,
                        })}
                    </p>
                    <div>
                        <button type="button" className="prf-button" onClick={close} disabled={saving}>
                            {t('minors.playerCard.cancel')}
                        </button>
                        <button
                            type="button"
                            className="prf-primary"
                            onClick={handleAddSelected}
                            disabled={loading || selectedPlayers.length === 0 || saving}
                        >
                            {saving && <Loader2 size={16} className="animate-spin" />}
                            {t('squadDesign.addSelected', { defaultValue: 'Add to squad' })}
                            {selectedPlayers.length > 0 && <span>{selectedPlayers.length}</span>}
                        </button>
                    </div>
                </footer>
            </div>
            <PlayerCardModal
                clubId={clubId}
                squadId={squadId}
                squadName={squadName}
                isOpen={showCardModal}
                onClose={() => setShowCardModal(false)}
                onCardCreated={() => {
                    cache.current = null;
                    setLoading(true);
                    setRetry((value) => value + 1);
                    onPlayersAdded();
                }}
            />
        </div>
    );
}
