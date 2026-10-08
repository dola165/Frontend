import { EmptyState } from '../../components/ui/EmptyState';
import { UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useLoad, useAction, useClock } from './hooks';
import { label, post, type Match } from './api';
type Team = { squadId: number; squadName: string; canManage: boolean; players: { id: number; name: string; selected: boolean; response: string; revision: number; canRespond: boolean }[] };
export function MatchParticipants({ match, reload }: { match: Match; reload: () => void }) {
  const { data, error, reload: refresh } = useLoad<Team[]>(`/match-arrangements/${match.event_id}/participants`);
  return <>{error && <p role="alert">{error}</p>}{data?.map(team => <TeamParticipants key={team.squadId} team={team} match={match} reload={() => { refresh(); reload(); }} />)}</>;
}
function TeamParticipants({ team, match, reload }: { team: Team; match: Match; reload: () => void }) {
  const [editing, setEditing] = useState<{ ids: number[]; revision: number }>();
  const { run, busy, feedback } = useAction(reload);
  const now = useClock();
  const upcoming = match.event_status === 'SCHEDULED' && Date.parse(match.starts_at_iso) > now;
  const visible = editing ? team.players : team.players.filter(p => p.selected);
  return <section className="mx-panel"><h2>{team.squadName} · Match players</h2>{feedback}
    {team.canManage && upcoming && !editing && <button onClick={() => setEditing({ ids: team.players.filter(p => p.selected).map(p => p.id), revision: match.revision })}>Choose match players</button>}
    {!visible.length && <EmptyState compact icon={UsersRound} title={team.canManage ? 'No players selected' : 'No match invitation for you or your child yet.'} description={team.canManage ? 'Select the players for this fixture and request their availability.' : 'When the coach includes you or your child in the match squad, the invitation and reply options will appear here.'}/>}
    {visible.map(player => <article className="mx-row" key={player.id}><div>{editing ? <label className="mx-check"><input type="checkbox" checked={editing.ids.includes(player.id)} onChange={e => setEditing({ ...editing, ids: e.target.checked ? [...editing.ids,player.id] : editing.ids.filter(id => id !== player.id) })} />{player.name}</label> : <strong>{player.name}</strong>}<p>{label(player.response)}</p></div>{!editing && player.canRespond && upcoming && <div className="mx-actions">{['GOING','NOT_GOING'].map(response => <button key={response} disabled={busy || player.response === response} onClick={() => void run(() => post(`/match-arrangements/${match.event_id}/squads/${team.squadId}/attendance`, { playerId: player.id, response, revision: player.revision, matchRevision: match.revision }), 'Availability reply saved')}>{response === 'GOING' ? 'Going' : 'Not going'}</button>)}</div>}</article>)}
    {editing && <div className="mx-actions"><button disabled={busy} onClick={() => void run(async () => { await post(`/match-arrangements/${match.event_id}/squads/${team.squadId}/participants`, { playerIds: editing.ids, revision: editing.revision }); setEditing(undefined); }, 'Match player invitations updated')}>Save players and notify</button><button disabled={busy} onClick={() => setEditing(undefined)}>Cancel selection</button></div>}
  </section>;
}
