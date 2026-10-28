import { useState } from 'react';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Avatar, Button, EmptyNote, List, ListRow, Panel } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { Crest } from '../../../design/visuals';
import { AddPlayerToSquadModal } from '../../../components/squads/AddPlayerToSquadModal';
import { removePlayerFromSquad } from '../../clubs/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { CoachData } from './CoachWorkspace';
import { officePath } from '../../clubOffice/officeLinks';
import './coach-hub.css';

/**
 * The squad's roster, managed right here: one list of players with Remove, and Add players from the club.
 * Small on purpose: everything else about the squad is one link away at the bottom (its page in My squads, or for
 * admins its place in Club office's Squads).
 */
export function RosterDialog({ data, open, onClose }: { data: CoachData; open: boolean; onClose: () => void }) {
    const copy = useCopy('coachHub', coachHubEn);
    const [picked, setPicked] = useState<number | null>(null);
    const [adding, setAdding] = useState(false), [removing, setRemoving] = useState<number | null>(null), [error, setError] = useState('');
    const squadId = picked ?? data.focus ?? data.mine[0]?.id ?? null;
    const squad = data.mine.find(item => item.id === squadId);
    const roster = data.rosters?.find(item => item.id === squadId);
    const players = (roster?.groups ?? []).flatMap(group => group.players.map(player => ({ ...player, group: group.label })));
    const remove = async (id: number, name: string) => {
        if (removing || !squadId || !window.confirm(copy('removeConfirm', { name, squad: squad?.name ?? '' }))) return;
        setRemoving(id); setError('');
        try { await removePlayerFromSquad(data.clubId, squadId, id); data.refresh(); }
        catch (cause) { setError(extractApiErrorMessage(cause, copy('removeFailed'))); }
        finally { setRemoving(null); }
    };
    return <>
        <Dialog open={open && !adding} size="md" title={copy('manageRoster')} description={squad ? copy('playersInSquad', { count: players.length, squad: squad.name }) : undefined} onClose={onClose}
            footer={<><Link className="cw-text-button ch-roster__more" to={data.roles.leadership ? officePath(data.clubId, 'squads', squadId ? { squad: String(squadId) } : {}) : data.link('overview', squadId ? { squad: String(squadId) } : {})}>{copy('moreAboutSquad')}</Link>
                <Button variant="primary" disabled={!squadId} onClick={() => setAdding(true)}><Plus aria-hidden="true" />{copy('addPlayers')}</Button></>}>
            <div className="gk-stack">
                {data.mine.length > 1 && <div className="ch-switch" role="group" aria-label={copy('squad')}>{data.mine.map(item => <button key={item.id} type="button" className="ch-switch__item" aria-pressed={item.id === squadId} onClick={() => setPicked(item.id)}>
                    <Crest src={data.clubLogo} name={data.clubName} size={18} />{item.name}
                </button>)}</div>}
                {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
                <Panel flush>{players.length ? <List label={copy('players')}>{players.map(player => <ListRow key={player.id} lead={<Avatar src={resolveMediaUrl(player.photoUrl) || null} name={player.name} size={32} />}
                    title={player.name} meta={[player.number != null ? `#${player.number}` : null, player.group, player.age != null ? copy('ageValue', { age: player.age }) : null].filter(Boolean).join(' · ')}
                    trail={<Button size="sm" variant="ghost" aria-label={copy('removeName', { name: player.name })} disabled={removing === player.id} onClick={() => void remove(player.id, player.name)}><Trash2 aria-hidden="true" />{copy('remove')}</Button>} />)}</List>
                    : <EmptyNote title={copy('noSquadsYet')} action={<Button size="sm" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{copy('addPlayers')}</Button>}>{copy('addClubPlayers')}</EmptyNote>}</Panel>
            </div>
        </Dialog>
        {squadId && <AddPlayerToSquadModal clubId={data.clubId} squadId={squadId} existingPlayerIds={players.map(player => player.id)} isOpen={adding}
            onClose={() => setAdding(false)} onPlayersAdded={() => { setAdding(false); data.refresh(); }} />}
    </>;
}
