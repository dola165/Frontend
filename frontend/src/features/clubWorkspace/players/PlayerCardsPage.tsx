import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { fetchPlayerCards, deletePlayerCard, type PlayerCard } from '../../clubs/api';
import { IdentityActivationForm } from '../../parents/IdentityActivationForm';
import { PlayerCardModal } from '../../../components/squads/PlayerCardModal';
import { Avatar, Badge, Button, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Skeleton } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import '../club-workspace.css';
import '../../clubOperations/records/records.css';
import './players.css';

interface Squad { id: number; name: string }

/**
 * Player cards: roster entries the club keeps for players, including children without an account. Edit a card,
 * invite an adult to take over their own account, or remove a card (asked first; an account is never deleted with it).
 * Removing ends the player's affiliation, so only the owner or an admin sees it (canRemove).
 */
export function PlayerCardsPage({ clubId, canRemove = false, setParentError, setParentSuccess }: { clubId: number; canRemove?: boolean; setParentError: (message: string | null) => void; setParentSuccess: (message: string | null) => void }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [cards, setCards] = useState<PlayerCard[]>([]), [squads, setSquads] = useState<Squad[]>([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState(''), [squadFilter, setSquadFilter] = useState('all'), [accountFilter, setAccountFilter] = useState('all');
    const [editing, setEditing] = useState<PlayerCard | null>(null), [removing, setRemoving] = useState<PlayerCard | null>(null), [removingId, setRemovingId] = useState<number | null>(null);
    const loadVersion = useRef(0), lock = useRef(false);
    const year = new Date().getFullYear();

    const load = useCallback(async () => {
        const version = ++loadVersion.current;
        setLoading(true); setLoadError(null);
        const [cardsResult, squadsResult] = await Promise.allSettled([fetchPlayerCards(clubId), apiClient.get<Squad[]>(`/clubs/${clubId}/squads`)]);
        if (version !== loadVersion.current) return;
        if (cardsResult.status === 'fulfilled') setCards(cardsResult.value);
        else { setLoadError(cardsResult.reason instanceof Error ? cardsResult.reason.message : t('squadDesign.loadCardsFailed', { defaultValue: 'Could not load player cards.' })); setCards([]); }
        setSquads(squadsResult.status === 'fulfilled' ? squadsResult.value.data || [] : []);
        setLoading(false);
    }, [clubId, t]);
    useEffect(() => { void load(); return () => { loadVersion.current += 1; }; }, [load]);

    const squadNames = useMemo(() => new Map(squads.map(squad => [squad.id, squad.name])), [squads]);
    const shown = useMemo(() => {
        const needle = search.trim().toLocaleLowerCase();
        return cards.filter(card => {
            if (squadFilter === 'none' && card.squadId != null) return false;
            if (squadFilter !== 'all' && squadFilter !== 'none' && card.squadId !== Number(squadFilter)) return false;
            if (accountFilter === 'registered' && !card.registered) return false;
            if (accountFilter === 'cards' && card.registered) return false;
            return !needle || `${card.fullName ?? ''} ${card.parentEmail ?? ''} ${card.position?.replaceAll('_', ' ') ?? ''}`.toLocaleLowerCase().includes(needle);
        });
    }, [cards, search, squadFilter, accountFilter]);
    const filtered = Boolean(search || squadFilter !== 'all' || accountFilter !== 'all');
    const reset = () => { setSearch(''); setSquadFilter('all'); setAccountFilter('all'); };
    const remove = async () => {
        if (!removing || lock.current) return;
        lock.current = true; setRemovingId(removing.id);
        try {
            await deletePlayerCard(clubId, removing.id);
            setParentSuccess(t(removing.registered ? 'minors.playerCard.removed' : 'minors.playerCard.deleted', { name: removing.fullName ?? '' }));
            setRemoving(null); await load();
        } catch (failure: unknown) { setParentError(failure instanceof Error ? failure.message : t('minors.playerCard.deleteFailed')); }
        finally { lock.current = false; setRemovingId(null); }
    };
    const addPlayer = () => navigate(`/clubs/${clubId}/workspace?tab=admissions&intake=1`);

    let body;
    if (loading) body = <Panel><div className="cw-skeleton-rows" role="status" aria-label={t('squadDesign.loadingCards', { defaultValue: 'Loading player cards…' })}>{[0, 1, 2].map(i => <Skeleton key={i} height={52} />)}</div></Panel>;
    else if (loadError) body = <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{loadError}</span><Button size="sm" onClick={() => void load()}>{t('squadDesign.players.retry', 'Try again')}</Button></div>;
    else if (!cards.length) body = <Panel><EmptyNote title={t('squadDesign.startPlayerCards', { defaultValue: 'Start with your first player' })} action={<Button size="sm" onClick={addPlayer}><Plus aria-hidden="true" />{t('squadDesign.addOrInvite', { defaultValue: 'Add or invite a player' })}</Button>}>{t('minors.playerCard.noCards')}</EmptyNote></Panel>;
    else if (!shown.length) body = <Panel><EmptyNote title={t('squadDesign.noMatchingCards', { defaultValue: 'No matching player cards' })} action={<Button size="sm" onClick={reset}>{t('squadDesign.resetFilters', { defaultValue: 'Reset filters' })}</Button>} /></Panel>;
    else body = <Panel flush><ul className="gk-list" aria-label={t('squadDesign.players.cards', 'Player cards')}>{shown.map(card => {
        const name = card.fullName || t('squadDesign.newPlayer', { defaultValue: 'Player' });
        // Players under 13 never carry photos.
        const photo = card.birthYear != null && year - card.birthYear < 13 ? null : resolveMediaUrl(card.photoUrl) || null;
        const facts = [card.jerseyNumber != null ? `#${card.jerseyNumber}` : null, card.position ? t(`squadDesign.positions.${card.position}`, { defaultValue: card.position.replaceAll('_', ' ').toLowerCase() }) : null,
            card.birthYear != null ? t('squadDesign.bornYear', { defaultValue: 'Born {{year}}', year: card.birthYear }) : null, squadNames.get(card.squadId ?? -1) ?? t('minors.playerCard.noSquad')].filter(Boolean).join(' · ');
        return <li key={card.id}><div className="gk-list-row pc-row">
            <Avatar src={photo} name={name} size={40} />
            <span className="gk-list-row__main">
                <button type="button" className="pc-name" onClick={() => setEditing(card)}>{name}</button>
                <span className="gk-list-row__meta">{facts}</span>
                <span className="gk-list-row__meta" title={card.parentEmail ?? ''}>{t('squadDesign.guardian', { defaultValue: 'Parent or guardian' })}: {card.parentEmail || '—'}</span>
            </span>
            <span className="gk-list-row__trail pc-trail">
                <Badge tone={card.registered ? 'accent' : 'neutral'}>{t(card.registered ? 'minors.playerCard.registered' : 'minors.playerCard.notRegistered')}</Badge>
                {card.claimed && <Badge tone="info">{t('minors.playerCard.claimed')}</Badge>}
                {!card.registered && card.birthYear != null && year - card.birthYear >= 18 && <IdentityActivationForm adult path={`/clubs/${clubId}/player-cards/${card.id}/activation-invitation`} onChanged={() => void load()} />}
                <Button size="sm" variant="ghost" iconOnly aria-label={t('squadDesign.editNamedPlayer', { defaultValue: 'Edit {{name}}', name })} title={t('minors.playerCard.edit')} onClick={() => setEditing(card)}><Pencil aria-hidden="true" /></Button>
                {canRemove && <Button size="sm" variant="ghost" iconOnly className="pc-danger" aria-label={`${t(card.registered ? 'minors.playerCard.remove' : 'minors.playerCard.delete')}: ${name}`} disabled={removingId === card.id} onClick={() => setRemoving(card)}><Trash2 aria-hidden="true" /></Button>}
            </span>
        </div></li>;
    })}</ul></Panel>;

    return <PageFrame className="cw-page pc-page">
        <PageHeader title={t('squadDesign.players.cards', 'Player cards')} subtitle={t('squadDesign.cardsDescription', { defaultValue: 'Roster entries for every player, including children who do not have an account yet.' })}
            actions={<Button variant="primary" onClick={addPlayer}><Plus aria-hidden="true" />{t('squadDesign.addOrInvite', { defaultValue: 'Add or invite a player' })}</Button>} />
        <div className="gk-stack">
            {cards.length > 0 && <div className="rec-toolbar">
                <SearchInput className="rec-toolbar__search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('squadDesign.searchPlayerCards', { defaultValue: 'Search player cards' })} aria-label={t('squadDesign.searchPlayerCards', { defaultValue: 'Search player cards' })} />
                <select className="gk-input" aria-label={t('squadDesign.filterBySquad', { defaultValue: 'Filter by squad' })} value={squadFilter} onChange={event => setSquadFilter(event.target.value)}>
                    <option value="all">{t('squadDesign.allSquads', { defaultValue: 'All squads' })}</option><option value="none">{t('minors.playerCard.noSquad')}</option>
                    {squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}</select>
                <select className="gk-input" aria-label={t('squadDesign.filterByAccount', { defaultValue: 'Filter by account' })} value={accountFilter} onChange={event => setAccountFilter(event.target.value)}>
                    <option value="all">{t('squadDesign.allAccounts', { defaultValue: 'All accounts' })}</option><option value="cards">{t('minors.playerCard.notRegistered')}</option><option value="registered">{t('minors.playerCard.registered')}</option></select>
                <span className="rec-toolbar__count" role="status">{t('squadDesign.cardCount', { defaultValue: '{{count}} player cards', count: shown.length })}</span>
                {filtered && <Button size="sm" variant="ghost" onClick={reset}>{t('squadDesign.resetFilters', { defaultValue: 'Reset filters' })}</Button>}
            </div>}
            {body}
        </div>
        <PlayerCardModal clubId={clubId} squadName={editing?.squadId ? squadNames.get(editing.squadId) : undefined} isOpen={editing != null} onClose={() => setEditing(null)} card={editing}
            onCardUpdated={async () => { await load(); setParentSuccess(t('minors.playerCard.updated')); }} />
        <Dialog open={removing !== null} role="alertdialog" size="sm" title={t(removing?.registered ? 'minors.playerCard.remove' : 'minors.playerCard.delete')}
            description={removing ? t(removing.registered ? 'minors.playerCard.removeConfirm' : 'minors.playerCard.deleteConfirm', { name: removing.fullName ?? '' }) : undefined}
            onClose={() => { if (!lock.current) setRemoving(null); }}
            footer={<><Button variant="ghost" disabled={removingId !== null} onClick={() => setRemoving(null)}>{t('minors.playerCard.cancel')}</Button>
                <Button variant="danger" disabled={removingId !== null} onClick={() => void remove()}>{removingId ? t('squadDesign.removing', { defaultValue: 'Removing…' }) : t(removing?.registered ? 'minors.playerCard.remove' : 'minors.playerCard.delete')}</Button></>} />
    </PageFrame>;
}
