import { useState } from 'react';
import { Badge, Button, EmptyNote, Panel, Section, type BadgeTone } from '../../design/primitives';
import { useLoad, useAction, useClock } from './hooks';
import { label, post, type Match } from './api';
import './detail/match-detail.css';

type Team = { squadId: number; squadName: string; canManage: boolean; players: { id: number; name: string; selected: boolean; response: string; revision: number; canRespond: boolean }[] };

const REPLY: Record<string, { label: string; tone: BadgeTone }> = {
  GOING: { label: 'Going', tone: 'accent' }, NOT_GOING: { label: 'Not going', tone: 'danger' }, UNANSWERED: { label: 'No reply yet', tone: 'warning' },
};

/** The players picked for this match, per squad, with their replies; staff choose them, players and families reply. */
export function MatchParticipants({ match, reload }: { match: Match; reload: () => void }) {
  const { data, error, reload: refresh } = useLoad<Team[]>(`/match-arrangements/${match.event_id}/participants`);
  return <>{error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}{data?.map(team => <TeamParticipants key={team.squadId} team={team} match={match} reload={() => { refresh(); reload(); }} />)}</>;
}

function TeamParticipants({ team, match, reload }: { team: Team; match: Match; reload: () => void }) {
  const [editing, setEditing] = useState<{ ids: number[]; revision: number }>();
  const { run, busy, feedback } = useAction(reload);
  const now = useClock();
  const upcoming = match.event_status === 'SCHEDULED' && Date.parse(match.starts_at_iso) > now;
  const selected = team.players.filter(p => p.selected);
  const visible = editing ? team.players : selected;
  const going = selected.filter(p => p.response === 'GOING').length, waiting = selected.filter(p => p.response === 'UNANSWERED').length;
  const hint = selected.length ? [`${selected.length} selected`, `${going} going`, waiting ? `${waiting} no reply yet` : null].filter(Boolean).join(' · ') : undefined;
  const toggle = (id: number, on: boolean) => editing && setEditing({ ...editing, ids: on ? [...editing.ids, id] : editing.ids.filter(value => value !== id) });
  return <Section title={`Match players · ${team.squadName}`} hint={hint}
    action={team.canManage && upcoming && !editing ? <Button size="sm" onClick={() => setEditing({ ids: selected.map(p => p.id), revision: match.revision })}>Choose match players</Button> : undefined}>
    <Panel flush>
      {!visible.length ? <EmptyNote title={team.canManage ? 'No players selected' : 'No match invitation for you or your child yet'}>
        {team.canManage ? 'Choose the players for this match; they and their families are asked to reply.' : 'When the coach includes you or your child, the invitation and reply options appear here.'}</EmptyNote>
        : <ul className="gk-match-players" aria-label={`${team.squadName} match players`}>{visible.map(player => {
          const reply = REPLY[player.response] ?? { label: label(player.response), tone: 'neutral' as BadgeTone };
          return <li key={player.id}>
            {editing ? <label className="gk-match-check"><input type="checkbox" checked={editing.ids.includes(player.id)} onChange={event => toggle(player.id, event.target.checked)} /><span className="gk-match-players__name">{player.name}</span></label>
              : <span className="gk-match-players__name">{player.name}</span>}
            {!editing && (player.canRespond && upcoming
              ? <span className="gk-match-actions">{(['GOING', 'NOT_GOING'] as const).map(response => <Button key={response} size="sm" variant={player.response === response ? 'primary' : 'secondary'} aria-pressed={player.response === response} disabled={busy || player.response === response}
                onClick={() => void run(() => post(`/match-arrangements/${match.event_id}/squads/${team.squadId}/attendance`, { playerId: player.id, response, revision: player.revision, matchRevision: match.revision }), 'Availability reply saved')}>{REPLY[response].label}</Button>)}</span>
              : <Badge tone={reply.tone}>{reply.label}</Badge>)}
          </li>;
        })}</ul>}
      {editing && <div className="gk-panel__foot gk-match-actions">
        <Button variant="primary" disabled={busy} onClick={() => void run(async () => { await post(`/match-arrangements/${match.event_id}/squads/${team.squadId}/participants`, { playerIds: editing.ids, revision: editing.revision }); setEditing(undefined); }, 'Match player invitations updated')}>Save {editing.ids.length} players and notify</Button>
        <Button disabled={busy} onClick={() => setEditing(undefined)}>Cancel</Button>
      </div>}
    </Panel>
    <div className="gk-mx gk-match-feedback">{feedback}</div>
  </Section>;
}
