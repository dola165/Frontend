import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserMinus, UserPlus } from 'lucide-react';
import { Button, EmptyNote } from '../../../design/primitives';
import { PlayerCard } from '../../clubWorkspace/squads/PlayerCard';
import { removePlayerFromSquad } from '../../clubs/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../api';
import { useJourneyCopy } from '../journeyCopy';
import { SquadInviteDialog } from './SquadInviteDialog';
import { useJoinRequests } from './useJoinRequests';

/**
 * The squad as football cards: name, shirt number, position and photo, nothing more about another child
 * (refinement 4). The coach invites (the squad's join link for the parents' group), answers who is waiting and
 * removes a player from the squad; the card itself stays the family's (refinement 1). A parent's own child is marked.
 * The invite dialog keeps its open state in the address (`invite=1`), so a reload lands back in it.
 */
export function SquadPlayersTab({ space, crest, childIds, onChanged }: { space: api.SquadOverview; crest: string | null; childIds: number[]; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const inviting = space.can_manage && params.get('invite') === '1';
    const setInviting = (open: boolean) => setParams(previous => { const next = new URLSearchParams(previous); if (open) next.set('invite', '1'); else next.delete('invite'); return next; }, { replace: !open });
    const [busy, setBusy] = useState<number | null>(null), [error, setError] = useState('');
    const requests = useJoinRequests(space);
    const waiting = requests.items?.length ?? 0;
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
            {waiting > 0 && <span className="sp-wait"><span className="sp-dot" aria-hidden="true" />{copy(`${waiting} waiting to join`, `${waiting} ელოდება გაწევრიანებას`)}</span>}
            <Button variant="primary" onClick={() => setInviting(true)}><UserPlus aria-hidden="true" />{copy('Invite players', 'მოთამაშეების მოწვევა')}</Button>
        </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {players.length ? <ul className="sp-cards">{players.map(player => <li key={player.id}>
            <PlayerCard crest={crest} player={{ id: player.id, name: player.name, number: player.number, position: player.position, photoUrl: player.photo_url }}
                onOpen={space.can_manage ? () => navigate(`/my-squads?tab=players&squad=${space.id}&player=${player.id}`) : undefined}
                signs={childIds.includes(player.id) ? <span className="pc-sign sp-yours">{copy('Yours', 'თქვენი')}</span> : undefined}
                actions={space.can_manage ? <Button size="sm" variant="ghost" iconOnly aria-label={copy(`Remove ${player.name} from the squad`, `${player.name} — გუნდიდან წაშლა`)} disabled={busy === player.id} onClick={() => void remove(player)}><UserMinus aria-hidden="true" /></Button> : undefined} />
        </li>)}</ul> : <EmptyNote title={copy('No players yet', 'მოთამაშეები ჯერ არ არის')} action={space.can_manage ? <Button size="sm" onClick={() => setInviting(true)}>{copy('Invite players', 'მოთამაშეების მოწვევა')}</Button> : undefined} />}
        {inviting && <SquadInviteDialog space={space} requests={requests} onClose={() => setInviting(false)} onAnswered={onChanged} />}
    </div>;
}
