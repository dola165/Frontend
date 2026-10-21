// Synthetic counterpart of MatchResultService: an account's actual side, independent confirmation,
// current revisions and account-scoped request replay. A proposed correction is never an official result.
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as F from '../world-football.mjs';
import { reply } from '../router.mjs';
import { canReadListing } from '../football-viewer.mjs';

const fail = (status, message) => reply(status, { status, message });
const sidesFor = (l, headers) => [
  ...(F.isMineClub(F.sq(l.hostSquadId).clubId) ? ['HOME'] : []),
  ...(l.opponentSquadId && F.isMineClub(F.sq(l.opponentSquadId).clubId) ? ['AWAY'] : []),
  ...(l.refereeId === V.viewerId(headers) && F.refereeStatusOf(l) === 'ACCEPTED' ? ['REFEREE'] : []),
];
const statusOf = l => l.resultStatus || (l.score ? 'CONFIRMED' : 'NONE');
const revisionOf = l => l.resultRevision ?? (l.score ? 1 : 0);
const requiredOf = l => l.resultRequired ?? (l.score ? ['HOME', 'AWAY'].filter(side => side !== (l.resultSide ?? 'HOME')) : []);
const confirmationsOf = l => l.resultConfirmations ?? (statusOf(l) === 'CONFIRMED' ? requiredOf(l) : []);
const writable = l => l.status === 'ARRANGED' && l.opponentSquadId && l.end.getTime() <= Date.now();
const requests = new Map();

function resultState(l, headers) {
  const roles = sidesFor(l, headers), status = statusOf(l), allowed = writable(l);
  const required = requiredOf(l), confirmations = confirmationsOf(l);
  const proposalRevision = l.resultHistory?.find(item => ['PROPOSE', 'CORRECT'].includes(item.action))?.revision ?? 0;
  const alreadyConfirmed = l.resultHistory?.some(item => item.action === 'CONFIRM' && item.actor_id === V.viewerId(headers) && item.revision > proposalRevision);
  const independent = !alreadyConfirmed && !roles.includes(l.resultSide ?? 'HOME') && (l.resultActor ?? W.ME_ID) !== V.viewerId(headers);
  return {
    eventId: l.id, fixtureStatus: l.status === 'CANCELLED' ? 'CANCELLED' : l.resultCompleted || status === 'CONFIRMED' ? 'COMPLETED' : 'SCHEDULED',
    status, revision: revisionOf(l), homeScore: l.score?.[0] ?? null, awayScore: l.score?.[1] ?? null,
    proposalSide: l.score ? l.resultSide ?? 'HOME' : null, requiredConfirmations: required, confirmations, legacy: false,
    authority: { roles, canPropose: Boolean(allowed && roles.length && status === 'NONE'),
      canCorrect: Boolean(allowed && roles.length && ['CONFIRMED', 'DISPUTED'].includes(status)),
      canDispute: Boolean(allowed && roles.length && ['PROPOSED', 'CONFIRMED'].includes(status)),
      confirmableRoles: allowed && status === 'PROPOSED' && independent ? roles.filter(side => required.includes(side) && !confirmations.includes(side)) : [],
      correctableRoles: roles },
    history: l.resultHistory ?? [],
  };
}

export function registerMatchResults({ get, post }) {
  get('/match-exchange/:id/result', ({ params, headers }) => {
    const l = F.listingById(params.id); if (!l || !canReadListing(l, headers)) return fail(404, 'Match not found.');
    if (!sidesFor(l, headers).length) return fail(403, 'Only the responsible sides and accepted officials can review this result history.');
    return resultState(l, headers);
  });
  get('/match-exchange/:id/result/summary', ({ params, headers }) => {
    const l = F.listingById(params.id); if (!l || !canReadListing(l, headers)) return fail(404, 'Match not found.');
    const r = resultState(l, headers);
    return { eventId: l.id, status: r.status, fixtureStatus: r.fixtureStatus, revision: r.revision, homeScore: r.homeScore, awayScore: r.awayScore, official: r.status === 'CONFIRMED', legacy: false, canReadAudit: r.authority.roles.length > 0 };
  });
  for (const action of ['PROPOSE', 'CONFIRM', 'CORRECT', 'DISPUTE']) {
    const suffix = action === 'PROPOSE' ? '' : `/${action.toLowerCase()}`;
    post(`/match-exchange/:id/result${suffix}`, ({ params, body, headers }) => {
      const l = F.listingById(params.id); if (!l) return fail(404, 'Match not found.');
      const actor = V.viewerId(headers), state = resultState(l, headers), side = body?.side;
      if (!state.authority.roles.includes(side)) return fail(403, 'You are not responsible for this result side.');
      if (!Number.isSafeInteger(body?.revision) || body.revision < 0 || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body?.requestId ?? '')) return fail(400, 'Provide a result side, current revision and request ID.');
      const reason = String(body.reason ?? '').trim();
      if (reason.length > 1000 || (['CORRECT', 'DISPUTE'].includes(action) && !reason)) return fail(400, 'A reason of at most 1000 characters is required.');
      if (['PROPOSE', 'CORRECT'].includes(action) && ![body.homeScore, body.awayScore].every(score => Number.isInteger(score) && score >= 0 && score <= 100)) return fail(400, 'Scores must be whole numbers between 0 and 100.');
      const key = `${l.id}:${actor}:${body.requestId}`, fingerprint = JSON.stringify([action, side, body.revision, body.homeScore ?? null, body.awayScore ?? null, reason]);
      if (requests.has(key)) return requests.get(key) === fingerprint ? state : fail(409, 'This request ID was used for a different result action.');
      if (!writable(l)) return fail(409, 'Results are available after an arranged fixture has ended.');
      if (body.revision !== state.revision) return fail(409, 'The result changed. Reload its history before trying again.');
      if (action === 'PROPOSE' && !state.authority.canPropose || action === 'CORRECT' && !state.authority.canCorrect || action === 'DISPUTE' && !state.authority.canDispute) return fail(409, 'This result action is no longer available.');
      if (action === 'CONFIRM' && !state.authority.confirmableRoles.includes(side)) return fail(403, 'An independent required party must confirm this score.');
      const previousScore = l.score ? [...l.score] : null, previousStatus = state.status;
      if (action === 'PROPOSE' || action === 'CORRECT') {
        l.score = [body.homeScore, body.awayScore]; l.resultSide = side; l.resultActor = actor;
        l.resultRequired = ['HOME', 'AWAY', ...(l.refereeId && F.refereeStatusOf(l) === 'ACCEPTED' ? ['REFEREE'] : [])].filter(item => item !== side);
        l.resultConfirmations = []; l.resultStatus = 'PROPOSED';
      } else if (action === 'DISPUTE') l.resultStatus = 'DISPUTED';
      else {
        l.resultConfirmations = [...confirmationsOf(l), side];
        l.resultStatus = requiredOf(l).every(item => l.resultConfirmations.includes(item)) ? 'CONFIRMED' : 'PROPOSED';
      }
      if (l.resultStatus === 'CONFIRMED') l.resultCompleted = true;
      l.resultRevision = state.revision + 1;
      (l.resultHistory ??= []).unshift({ id: W.newId(), action, actor_id: actor, actor_side: side,
        home_score: l.score?.[0] ?? null, away_score: l.score?.[1] ?? null, previous_home_score: previousScore?.[0] ?? null, previous_away_score: previousScore?.[1] ?? null,
        previous_status: previousStatus, status: l.resultStatus, reason: reason || null, created_at: W.iso(new Date()), revision: l.resultRevision });
      requests.set(key, fingerprint);
      return resultState(l, headers);
    });
  }
}
