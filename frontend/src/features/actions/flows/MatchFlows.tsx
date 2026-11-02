import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Megaphone, Send } from 'lucide-react';
import { Dialog } from '../../../design/Dialog';
import { Button, ButtonLink, Skeleton } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import { useAuth } from '../../../context/AuthContext';
import { formatDate } from '../../../utils/formatting';
import type { Match } from '../../matchExchange/api';
import { ArrangeMatchForm } from '../../matchExchange/arrange/ArrangeMatchForm';
import { adoptOldDrafts, arrangeDraftKey, arrangeDrafts, NEW_MATCH_LISTS, type ArrangeDraft, type ArrangeWay } from '../../matchExchange/arrange/arrangeDraft';
import { matchPath } from '../../matches/matchContext';
import { ScoreDialog } from '../../scores/ScoreDialog';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { notifyWorldChanged } from '../../world/cache';
import { scoreTargetOf } from '../api';
import { refreshResultsWaiting, useResultsWaiting } from '../useResultsWaiting';
import '../actions.css';

/**
 * Arrange a match over any page, from every door. First how: "Invite a club" (a club we know, or one not in GrassKickZ,
 * at an exact time and ground) or "Open challenge" (a window of days and hours that any squad can answer). A door that
 * knows pre-chooses it ("Play them again" invites that club, World's open challenges post one); everything else asks.
 * Each way keeps its own draft, so closing never loses it. Once sent the person stays where they were: the sheet says
 * what happened, with the match one tap away.
 */
export function ArrangeFlow({ squadId, opponentId, way, onClose }: { squadId?: number; opponentId?: number; way?: ArrangeWay; onClose: () => void }) {
    const copy = useJourneyCopy();
    const { user, sessionId } = useAuth();
    const [chosen, setChosen] = useState<ArrangeWay | undefined>(way);
    const [sent, setSent] = useState<Match>();
    // An unsent draft the person continues: its own squad, club and key (with its request id).
    const [resumed, setResumed] = useState<ArrangeDraft>();
    // Release 16's drafts move to today's keys before any is read (fix round 1).
    const [drafts] = useState(() => { if (user) adoptOldDrafts(user.id, sessionId); return arrangeDrafts(user?.id, sessionId); });
    if (!user) return null;
    const closeLabel = copy('Close', 'დახურვა');
    if (sent) {
        // An invitation is open to one club; an open challenge to everyone; a club not in GrassKickZ is agreed at once.
        const kind = sent.requested_club_id ? 'invited' : sent.listing_status === 'OPEN' ? 'open' : 'added';
        const opponent = sent.opponent_name ?? sent.outside_opponent ?? '';
        const line = kind === 'open' ? copy('Squads near you can answer it now.', 'ახლომდებარე გუნდებს უკვე შეუძლიათ პასუხი.')
            : kind === 'added' ? copy('It is in your squad’s week. Call up the players when you are ready.', 'მატჩი გუნდის კვირაშია. მოთამაშეები როცა გინდათ, მაშინ გამოიძახეთ.')
                : copy('They answer from their club. Nothing is agreed until they accept.', 'პასუხს მათი კლუბი გასცემს. სანამ არ დათანხმდებიან, არაფერია შეთანხმებული.');
        return <Dialog open size="sm" title={kind === 'open' ? copy('Open challenge posted', 'ღია გამოწვევა გამოქვეყნდა')
            : kind === 'added' ? copy(`Match against ${opponent} added`, `მატჩი ${opponent}-თან დაემატა`) : copy('Invitation sent', 'მოწვევა გაიგზავნა')}
            onClose={onClose} closeLabel={closeLabel}
            footer={<><Button onClick={onClose}>{copy('Done', 'მზადაა')}</Button><ButtonLink variant="primary" to={matchPath(sent.event_id, { kind: 'squad', id: sent.squad_id })}>{copy('Open the match', 'მატჩის გახსნა')}</ButtonLink></>}>
            <p>{line}</p>
        </Dialog>;
    }
    const ways = <Segmented<ArrangeWay> label={copy('How to find an opponent', 'როგორ ვიპოვოთ მეტოქე')} value={chosen ?? 'invite'} className="gk-arrange__mode" onChange={setChosen}
        items={[{ id: 'invite', label: copy('Invite a club', 'კლუბის მოწვევა'), icon: <Send aria-hidden="true" /> }, { id: 'open', label: copy('Open challenge', 'ღია გამოწვევა'), icon: <Megaphone aria-hidden="true" /> }]} />;
    return <Dialog open size="sheet" title={copy('Arrange a match', 'მატჩის დაგეგმვა')} onClose={onClose} closeLabel={closeLabel}>
        {resumed ? <ArrangeMatchForm key={resumed.storageKey} mode={resumed.way === 'open' ? 'open' : 'direct'} opponentId={resumed.opponentId} squadId={resumed.squadId}
            storageKey={resumed.storageKey} onSent={match => { notifyWorldChanged(NEW_MATCH_LISTS); setSent(match); }} />
            : chosen ? <ArrangeMatchForm key={chosen} mode={chosen === 'open' ? 'open' : 'direct'} opponentId={chosen === 'invite' ? opponentId : undefined} squadId={squadId} head={ways}
            storageKey={arrangeDraftKey(user.id, sessionId, chosen, squadId, chosen === 'invite' ? opponentId : undefined)}
            onSent={match => { notifyWorldChanged(NEW_MATCH_LISTS); setSent(match); }} />
            : <><div className="gk-arrange-ways" role="group" aria-label={copy('How to find an opponent', 'როგორ ვიპოვოთ მეტოქე')}>
                <button type="button" className="gk-arrange-way" onClick={() => setChosen('invite')}>
                    <Send aria-hidden="true" /><strong>{copy('Invite a club', 'კლუბის მოწვევა')}</strong>
                    <span>{copy('A club you know, at a time and ground you set.', 'ნაცნობი კლუბი, თქვენ მიერ არჩეულ დროსა და მოედანზე.')}</span>
                </button>
                <button type="button" className="gk-arrange-way" onClick={() => setChosen('open')}>
                    <Megaphone aria-hidden="true" /><strong>{copy('Open challenge', 'ღია გამოწვევა')}</strong>
                    <span>{copy('Any squad nearby answers inside your days and hours.', 'ნებისმიერი ახლომდებარე გუნდი გიპასუხებთ თქვენს დღეებსა და საათებში.')}</span>
                </button>
            </div>
            {drafts.length > 0 && <div className="gk-arrange-drafts" role="group" aria-label={copy('Continue', 'გაგრძელება')}>
                <strong>{copy('Continue', 'გაგრძელება')}</strong>
                {drafts.map(item => <button key={item.storageKey} type="button" className="gk-arrange-draft" onClick={() => setResumed(item)}>
                    {item.way === 'open' ? <Megaphone aria-hidden="true" /> : <Send aria-hidden="true" />}
                    <span>{[item.draft.title?.trim() || (item.way === 'open' ? copy('Open challenge', 'ღია გამოწვევა') : copy('Invitation', 'მოწვევა')),
                        item.draft.date ? formatDate(item.draft.date) : null, item.draft.time].filter(Boolean).join(' · ')}</span>
                    <ChevronRight aria-hidden="true" />
                </button>)}
            </div>}</>}
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
