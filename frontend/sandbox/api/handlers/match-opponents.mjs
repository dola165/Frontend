// The same ownership, revision and pending-state rules as MatchExchangeService and MatchArrangementService.
import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as S from '../world-social.mjs';
import { reply } from '../router.mjs';

const fail = (status, message) => reply(status, { status, message });
const upcoming = l => ['OPEN', 'ARRANGED'].includes(l.status) && l.start.getTime() > Date.now();
const revisionError = (l, body) => Number(body?.revision) !== l.revision
  ? fail(409, 'Listing changed. Reload and review its current arrangements.') : null;
const history = (l, action, reason = null) => l.history.push({ id: W.newId(), action, created_at: W.iso(new Date()), reason });

export function registerMatchOpponents({ post }) {
  post('/match-exchange/:id/proposals', ({ params, body }) => {
    const l = F.listingById(params.id), squad = F.sq(body?.squadId);
    if (!l) return fail(404, 'Match not found.');
    if (!squad || !F.isMineClub(squad.clubId)) return fail(403, 'Choose one of your squads.');
    if (F.isMineClub(F.sq(l.hostSquadId).clubId) || l.requestedClubId) return fail(403, 'Only another club can offer to play an open match.');
    if (!upcoming(l) || l.status !== 'OPEN') return fail(409, 'This match is no longer open for proposals.');
    const stale = revisionError(l, body); if (stale) return stale;
    const previous = l.proposals.find(p => p.squad_id === squad.id);
    if (previous?.status === 'PENDING') return reply(204);
    const proposal = { id: previous?.id ?? W.newId(), squad_id: squad.id, squad_name: squad.name, club_name: W.clubById(squad.clubId).name, club_id: squad.clubId, note: String(body.note ?? '').trim(), status: 'PENDING' };
    if (previous) Object.assign(previous, proposal); else l.proposals.push(proposal);
    l.revision++; history(l, 'PROPOSAL');
    return reply(204);
  });

  post('/match-exchange/:id/proposals/:proposalId/decision', ({ params, body }) => {
    const l = F.listingById(params.id), p = l?.proposals.find(item => item.id === Number(params.proposalId));
    if (!p) return fail(404, 'Proposal not found.');
    const action = body?.action;
    if (!['ACCEPT', 'DECLINE', 'WITHDRAW'].includes(action)) return fail(400, 'Choose accept, decline or withdraw.');
    if (!(action === 'WITHDRAW' ? F.isMineClub(p.club_id) : F.isMineClub(F.sq(l.hostSquadId).clubId))) return fail(403, 'Only the responsible squad can decide this proposal.');
    if (!upcoming(l)) return fail(409, 'This match can no longer be arranged.');
    const next = { ACCEPT: 'ACCEPTED', DECLINE: 'DECLINED', WITHDRAW: 'WITHDRAWN' }[action];
    if (p.status === next) return reply(204);
    const stale = revisionError(l, body); if (stale) return stale;
    if (p.status !== 'PENDING' || l.status !== 'OPEN') return fail(409, 'This proposal has already been resolved.');
    p.status = next;
    if (action === 'ACCEPT') {
      l.opponentSquadId = p.squad_id; l.status = 'ARRANGED';
      l.proposals.filter(item => item !== p && item.status === 'PENDING').forEach(item => { item.status = 'DECLINED'; });
      history(l, 'OPPONENT_AGREED');
    }
    l.revision++;
    return reply(204);
  });

  post('/match-arrangements/:id/response', ({ params, body }) => {
    const l = F.listingById(params.id); if (!l) return fail(404, 'Match not found.');
    const action = body?.action;
    if (!['ACCEPT', 'DECLINE', 'WITHDRAW'].includes(action)) return fail(400, 'Choose accept, decline or withdraw.');
    const guest = F.sq(l.opponentSquadId);
    if (!(action === 'WITHDRAW' ? guest && F.isMineClub(guest.clubId) : l.requestedClubId && F.isMineClub(l.requestedClubId))) return fail(403, 'Only the invited club can answer this match.');
    if (!upcoming(l)) return fail(409, 'This match can no longer be arranged.');
    const stale = revisionError(l, body); if (stale) return stale;
    if (action === 'WITHDRAW') {
      if (l.status !== 'ARRANGED') return fail(409, 'There is no agreed opponent to withdraw.');
      l.opponentSquadId = null; l.status = 'OPEN'; history(l, 'OPPONENT_WITHDRAWN', body.reason || null);
    } else {
      if (l.status !== 'OPEN') return fail(409, 'This invitation has already been answered.');
      if (action === 'ACCEPT') {
        const squad = F.sq(body.squadId ?? l.requestedSquadId);
        if (!squad || squad.clubId !== l.requestedClubId || !F.isMineClub(squad.clubId) || (l.requestedSquadId && squad.id !== l.requestedSquadId)) return fail(400, 'Choose the invited squad from your club.');
        l.opponentSquadId = squad.id; l.status = 'ARRANGED'; history(l, 'OPPONENT_AGREED');
      } else { l.status = 'CLOSED'; history(l, 'CHALLENGE_DECLINED'); }
      const request = S.requestItems.find(item => item.key === `MATCH_INVITATION:${l.id}`);
      if (request) Object.assign(request, { status: action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED', actionable: false, updatedAt: W.iso(new Date()) });
    }
    l.revision++;
    return F.listingView(l, { detail: true });
  });
}
