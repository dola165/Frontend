// Synthetic counterpart of the rule-checker's person-wide answer (F5, "actions everywhere") and the matches still
// waiting for a score. Shapes from src/api/access.ts and src/features/actions/api.ts:
//   GET /access/me            -> { allowed: string[], refused: [{ action, allowed, reason, message, because }] }
//   GET /access/clubs/:id     -> the same, for one club   GET /access/squads/:id -> the same, for one squad
//   GET /me/results-waiting   -> [{ kind, id, title, startsAt, squadId, squadName, opponentName }], newest first
// Coach Luka (user 1) leads U14 and U16 at FC Dinamo Tbilisi Academy and is its Owner; with the family cookie he is
// also a parent. A new account is an adult with nothing yet: it may start a club, add a child, join and follow.
import { get } from '../router.mjs';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as F from '../world-football.mjs';

const refusal = (action, reason, message) => ({ action, allowed: false, reason, message, because: null });
const answer = (allowed, refused = []) => ({ allowed, refused });

get('/access/me', ({ headers }) => {
  if (V.isNewcomer(headers)) return answer(['start_club', 'add_child', 'join_squad', 'follow'], [
    refusal('arrange_match', 'ONLY_SQUAD_MATCH_STAFF', 'Only a squad’s coaches arrange its matches.'),
    refusal('report_score', 'ONLY_SQUAD_MATCH_STAFF', 'Only a squad’s coaches report its scores.'),
    refusal('invite_staff', 'ONLY_ADMINS', 'Only the club’s admins invite staff.'),
    refusal('suggest_assistant', 'ONLY_HEAD_COACHES', 'Only a head coach suggests an assistant.'),
  ]);
  // Staff at a club cannot start another one; everything else is open to Luka.
  return answer(['add_child', 'join_squad', 'follow', 'arrange_match', 'report_score', 'invite_staff', 'suggest_assistant'],
    [refusal('start_club', 'STAFF_OF_ANOTHER_CLUB', 'You are staff at FC Dinamo Tbilisi Academy. One club at a time.')]);
});

const CLUB_ACTIONS = ['see_people', 'invite_staff', 'make_admin', 'change_job', 'end_job', 'suggest_assistant', 'confirm_assistant', 'add_child', 'arrange_match', 'report_score', 'follow'];
get('/access/clubs/:id', ({ params, headers }) => {
  const club = W.clubs.find(item => item.id === Number(params.id));
  if (!club) return undefined;
  const own = !V.isNewcomer(headers) && F.isMineClub(club.id);
  if (own) return { clubId: club.id, squadId: null, ...answer(CLUB_ACTIONS), admins: [{ userId: W.ME_ID, name: 'Luka Gelashvili', owner: true }] };
  return { clubId: club.id, squadId: null, ...answer(['add_child', 'follow'], CLUB_ACTIONS.filter(action => !['add_child', 'follow'].includes(action))
    .map(action => refusal(action, 'ONLY_ADMINS', 'Only the club’s admins can do this.'))), admins: [] };
});

const SQUAD_ACTIONS = ['join_squad', 'add_child', 'manage_join_link', 'approve_join_requests', 'link_parent', 'suggest_assistant', 'invite_staff', 'arrange_match', 'report_score', 'follow'];
get('/access/squads/:id', ({ params, headers }) => {
  const squad = F.sq(params.id);
  if (!squad) return undefined;
  const coach = !V.isNewcomer(headers) && F.isMineClub(squad.clubId);
  const leads = coach && squad.headCoachId === W.ME_ID;
  // A coach is in the squad already, so joining is a parent's (for a child not in it yet).
  const allowed = coach ? SQUAD_ACTIONS.filter(action => action !== 'join_squad' && (leads || action !== 'suggest_assistant')) : ['join_squad', 'add_child', 'follow'];
  return { clubId: squad.clubId, squadId: squad.id, ...answer(allowed, SQUAD_ACTIONS.filter(action => !allowed.includes(action))
    .map(action => action === 'join_squad' ? refusal(action, 'ALREADY_IN_SQUAD', 'You are already in this squad.') : refusal(action, 'ONLY_SQUAD_COACHES', 'Only this squad’s coaches can do this.'))) };
});

// Agreed exchange matches of Luka's club that have ended without a score; the newest is the one Home asks about.
get('/me/results-waiting', ({ headers }) => {
  if (V.isNewcomer(headers)) return [];
  return F.exchange
    .filter(l => l.status === 'ARRANGED' && l.opponentSquadId && !l.score && new Date(l.end ?? l.start).getTime() <= Date.now())
    .map(l => {
      const host = F.sq(l.hostSquadId), guest = F.sq(l.opponentSquadId);
      const ours = host && F.isMineClub(host.clubId) ? host : guest && F.isMineClub(guest.clubId) ? guest : null;
      if (!ours) return null;
      const theirs = ours === host ? guest : host;
      const opponent = theirs ? W.clubs.find(club => club.id === theirs.clubId) : null;
      return { kind: 'MATCH_EXCHANGE', id: l.id, title: l.title, startsAt: new Date(l.start).toISOString(), squadId: ours.id, squadName: ours.name, opponentName: opponent?.name ?? null };
    })
    .filter(Boolean)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
});
