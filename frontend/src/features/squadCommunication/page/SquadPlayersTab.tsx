import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Share2, UserMinus, UserPlus, X } from 'lucide-react';
import { Avatar, Button, EmptyNote } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { PlayerCard } from '../../clubWorkspace/squads/PlayerCard';
import { removePlayerFromSquad } from '../../clubs/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../api';
import { useJourneyCopy } from '../journeyCopy';

/**
 * The squad as football cards: name, shirt number, position and photo, nothing more about another child
 * (refinement 4). The coach invites (the squad's join link for the parents' group), answers who is waiting and
 * removes a player from the squad; the card itself stays the family's (refinement 1). A parent's own child is marked.
 */
export function SquadPlayersTab({ space, crest, childIds, onChanged }: { space: api.SquadOverview; crest: string | null; childIds: number[]; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [inviting, setInviting] = useState(false), [busy, setBusy] = useState<number | null>(null), [error, setError] = useState('');
    const requests = useJoinRequests(space);
    const remove = async (player: api.Person) => {
        if (busy || !window.confirm(copy(`Remove ${player.name} from ${space.name}? Their card stays with the family.`, `წაიშალოს ${player.name} გუნდიდან ${space.name}? ბარათი ოჯახს რჩება.`))) return;
        setBusy(player.id); setError('');
        try { await removePlayerFromSquad(space.club_id, space.id, player.id); onChanged(); }
        catch (e) { setError(extractApiErrorMessage(e, copy('The player could not be removed.', 'მოთამაშე ვერ წაიშალა.'))); }
        finally { setBusy(null); }
    };
    const players = [...space.players].sort((a, b) => (a.number ?? 99) - (b.number ?? 99) || a.name.localeCompare(b.name));
    return <div className="sp-players">
        {space.can_manage && <div className="sp-players__bar">
            {requests.items.length > 0 && <span className="sp-wait"><span className="sp-dot" aria-hidden="true" />{copy(`${requests.items.length} waiting to join`, `${requests.items.length} ელოდება გაწევრიანებას`)}</span>}
            <Button variant="primary" onClick={() => setInviting(true)}><UserPlus aria-hidden="true" />{copy('Invite players', 'მოთამაშეების მოწვევა')}</Button>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {players.length ? <ul className="sp-cards">{players.map(player => <li key={player.id}>
            <PlayerCard crest={crest} player={{ id: player.id, name: player.name, number: player.number, position: player.position, photoUrl: player.photo_url }}
                onOpen={space.can_manage ? () => navigate(`/my-squads?tab=players&squad=${space.id}&player=${player.id}`) : undefined}
                signs={childIds.includes(player.id) ? <span className="pc-sign sp-yours">{copy('Yours', 'თქვენი')}</span> : undefined}
                actions={space.can_manage ? <Button size="sm" variant="ghost" iconOnly aria-label={copy(`Remove ${player.name} from the squad`, `${player.name} — გუნდიდან წაშლა`)} disabled={busy === player.id} onClick={() => void remove(player)}><UserMinus aria-hidden="true" /></Button> : undefined} />
        </li>)}</ul> : <EmptyNote title={copy('No players yet', 'მოთამაშეები ჯერ არ არის')} action={space.can_manage ? <Button size="sm" onClick={() => setInviting(true)}>{copy('Invite players', 'მოთამაშეების მოწვევა')}</Button> : undefined} />}
        {inviting && <InviteDialog space={space} requests={requests} onClose={() => setInviting(false)} onAnswered={onChanged} />}
    </div>;
}

function useJoinRequests(space: api.SquadOverview) {
    const [items, setItems] = useState<api.SquadJoinRequest[]>([]), [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!space.can_manage) return;
        const abort = new AbortController();
        void api.joinRequests(space.id, abort.signal).then(rows => { if (!abort.signal.aborted) setItems(rows); }).catch(() => { if (!abort.signal.aborted) setItems([]); });
        return () => abort.abort();
    }, [space.id, space.can_manage, revision]);
    return { items, refresh: useCallback(() => setRevision(n => n + 1), []) };
}

/** Joining needs both sides: the coach shares the link, the family adds their child, the coach says yes. */
function InviteDialog({ space, requests, onClose, onAnswered }: { space: api.SquadOverview; requests: ReturnType<typeof useJoinRequests>; onClose: () => void; onAnswered: () => void }) {
    const copy = useJourneyCopy();
    const [link, setLink] = useState<api.SquadJoinLink | null>(null), [error, setError] = useState(''), [copied, setCopied] = useState(false), [busy, setBusy] = useState<number | null>(null);
    useEffect(() => {
        const abort = new AbortController();
        void api.joinLink(space.id, abort.signal).then(found => { if (!abort.signal.aborted) setLink(found); }).catch(e => { if (!abort.signal.aborted) setError(extractApiErrorMessage(e, copy('The join link could not load.', 'ბმული ვერ ჩაიტვირთა.'))); });
        return () => abort.abort();
    }, [space.id, copy]);
    const url = link ? `${window.location.origin}${link.path}` : '';
    const decide = async (request: api.SquadJoinRequest, action: 'APPROVE' | 'DECLINE') => {
        setBusy(request.id); setError('');
        try { await api.decideJoinRequest(space.id, request.id, action); requests.refresh(); onAnswered(); }
        catch (e) { setError(extractApiErrorMessage(e, copy('Could not save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(null); }
    };
    return <Dialog open size="md" title={copy('Invite players', 'მოთამაშეების მოწვევა')} description={space.name} onClose={onClose}>
        <div className="sp-invite">
            <p className="sp-quiet">{copy('Share the link in the parents’ group. A parent adds their child; you say yes here.', 'გააზიარეთ ბმული მშობლების ჯგუფში. მშობელი ამატებს ბავშვს; თქვენ ადასტურებთ აქ.')}</p>
            {link ? <div className="sp-invite__link"><input className="gk-input" readOnly value={url} aria-label={copy('Join link', 'გაწევრიანების ბმული')} onFocus={e => e.currentTarget.select()} />
                <Button onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => setError(copy('Copy the link from the box.', 'დააკოპირეთ ბმული ველიდან.')))}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button>
                <a className="gk-btn gk-btn--primary" href={`https://wa.me/?text=${encodeURIComponent(`${space.name} · ${space.academy_name}\n${url}`)}`} target="_blank" rel="noopener noreferrer"><Share2 aria-hidden="true" />WhatsApp</a></div>
                : !error && <p className="sp-quiet" role="status">{copy('Loading…', 'იტვირთება…')}</p>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <h3 className="sp-invite__head">{copy('Waiting for you', 'გელოდებათ')}</h3>
            {requests.items.length ? <ul className="sp-requests">{requests.items.map(request => <li key={request.id}>
                <Avatar name={request.childName} size={32} />
                <span className="sp-requests__text"><strong>{request.childName}</strong><small>{[request.birthYear ? copy(`born ${request.birthYear}`, `დაბ. ${request.birthYear}`) : null, request.guardianName, request.source === 'LINK' ? copy('from the link', 'ბმულით') : copy('asked to join', 'მოითხოვა')].filter(Boolean).join(' · ')}</small></span>
                <Button size="sm" variant="primary" disabled={busy === request.id} onClick={() => void decide(request, 'APPROVE')}><Check aria-hidden="true" />{copy('Add', 'დამატება')}</Button>
                <Button size="sm" variant="ghost" iconOnly aria-label={copy(`Decline ${request.childName}`, `უარი: ${request.childName}`)} disabled={busy === request.id} onClick={() => void decide(request, 'DECLINE')}><X aria-hidden="true" /></Button>
            </li>)}</ul> : <p className="sp-quiet">{copy('Nobody is waiting.', 'არავინ ელოდება.')}</p>}
        </div>
    </Dialog>;
}
