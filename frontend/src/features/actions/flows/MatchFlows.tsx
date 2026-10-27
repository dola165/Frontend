import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '../../../design/Dialog';
import { Button, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { formatDate } from '../../../utils/formatting';
import { ArrangeMatchForm } from '../../matchExchange/arrange/ArrangeMatchForm';
import { ScoreDialog } from '../../scores/ScoreDialog';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { notifyWorldChanged } from '../../world/cache';
import { arrangeDraftKey, arrangeSeed, NEW_MATCH_LISTS } from '../../world/compose/arrangeSeed';
import { peekOf } from '../../world/peek/usePeek';
import { listingCode } from '../../world/scoreboard/matchCode';
import { scoreTargetOf } from '../api';
import { refreshResultsWaiting, useResultsWaiting } from '../useResultsWaiting';

/**
 * Arrange a match over any page: World's form in a sheet, the squad and opponent already chosen when the door knew
 * them. It shares World's draft for the same squad and opponent, so closing never loses it; once sent, the match opens
 * in World with its next step.
 */
export function ArrangeFlow({ squadId, opponentId, onClose }: { squadId?: number; opponentId?: number; onClose: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const { user, sessionId } = useAuth();
    if (!user) return null;
    const seed = arrangeSeed({ mode: 'direct', opponentId, squadId });
    return <Dialog open size="sheet" title={copy('Arrange a match', 'მატჩის დაგეგმვა')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
        <ArrangeMatchForm key={seed} mode="direct" opponentId={opponentId} squadId={squadId} storageKey={arrangeDraftKey(user.id, sessionId, seed)}
            onSent={match => { notifyWorldChanged(NEW_MATCH_LISTS); navigate(`/world/matches?tab=mine&peek=${peekOf('match', listingCode(match.event_id))}`, { replace: true }); }} />
    </Dialog>;
}

type Pinned = { kind: 'MATCH_EXCHANGE' | 'SCHEDULE_EVENT'; id: number };

/**
 * Report a score over any page: the match a link named, else the newest one still waiting (of the squad, when the
 * door was on its page), fixed once chosen so the dialog never moves to another match. Saving takes it off every "Needs a
 * result"; once it has left the list, the dialog closes (a conflict keeps it open, showing the latest score).
 */
export function ScoreFlow({ source, eventId, squadId, onClose }: { source?: string; eventId?: number; squadId?: number; onClose: () => void }) {
    const copy = useJourneyCopy();
    const waiting = useResultsWaiting();
    const [pinned, setPinned] = useState<Pinned | null>(() => eventId ? { kind: source === 'SCHEDULE_EVENT' ? 'SCHEDULE_EVENT' : 'MATCH_EXCHANGE', id: eventId } : null);
    const newest = waiting?.find(result => !squadId || result.squadId === squadId);
    if (!pinned && newest) setPinned({ kind: newest.kind, id: newest.id });
    const item = pinned ? waiting?.find(result => result.id === pinned.id && result.kind === pinned.kind) : undefined;
    const [listed, setListed] = useState(false);
    if (item && !listed) setListed(true);
    const saved = listed && waiting !== undefined && !item;
    const closed = useRef(false);
    useEffect(() => { if (saved && !closed.current) { closed.current = true; onClose(); } }, [saved, onClose]);
    const title = copy('Score', 'ანგარიში');
    const closeLabel = copy('Close', 'დახურვა');
    if (!pinned && waiting === undefined) return <Dialog open size="sm" title={title} onClose={onClose} closeLabel={closeLabel}><Skeleton height={120} /></Dialog>;
    const target = pinned ?? newest;
    if (!target) return <Dialog open size="sm" title={copy('No score is waiting', 'ანგარიში არ ელოდება')} onClose={onClose} closeLabel={closeLabel}
        footer={<Button variant="primary" onClick={onClose}>{closeLabel}</Button>} />;
    const about = item ? [item.squadName && item.opponentName ? `${item.squadName} v ${item.opponentName}` : item.title, formatDate(item.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })].filter(Boolean).join(' · ') : undefined;
    return <ScoreDialog key={`${target.kind}:${target.id}`} target={scoreTargetOf(target)} title={item?.title ?? title} description={about} reportAs={item?.reportAs ?? null}
        onClose={onClose} onChanged={refreshResultsWaiting} />;
}
