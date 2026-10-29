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
import * as C from '../world-club.mjs';
import { accountProfile } from '../world-social.mjs';
import * as M from '../world-my-squads.mjs';

const refusal = (action, reason, message) => ({ action, allowed: false, reason, message, because: null });
const answer = (allowed, refused = []) => ({ allowed, refused });

get('/access/me', ({ headers }) => {
  if (V.isNewcomer(headers)) return answer(['start_club', 'add_child', 'join_squad', 'follow'], [
    refusal('arrange_match', 'ONLY_SQUAD_MATCH_STAFF', 'Only a squad’s coaches arrange its matches.'),
    refusal('report_score', 'ONLY_SQUAD_MATCH_STAFF', 'Only a squad’s coaches report its scores.'),
    refusal('invite_staff', 'ONLY_ADMINS', 'Only the club’s admins invite staff.'),
    refusal('add_helper', 'ONLY_HEAD_COACHES', 'Helpers are added by a squad’s head coach.'),
  ]);
  // Staff at a club cannot start another one; everything else is open to Luka.
  return answer(['add_child', 'join_squad', 'follow', 'arrange_match', 'report_score', 'invite_staff', 'add_helper'],
    [refusal('start_club', 'STAFF_OF_ANOTHER_CLUB', 'You are staff at FC Dinamo Tbilisi Academy. One club at a time.')]);
});

const CLUB_ACTIONS = ['see_people', 'see_staff', 'invite_staff', 'make_admin', 'change_job', 'end_job', 'hand_over', 'add_helper', 'confirm_assistant', 'add_child', 'arrange_match', 'report_score', 'follow'];
// Every job holder reads Staff; only admins change it. A head coach adds helpers and runs their squads' matches; a team
// manager runs matches; the head of coaching does a head coach's work in every squad (step 3). A helper has no job.
const PERSONA_ACTIONS = { headcoach: ['see_people', 'see_staff', 'add_helper', 'add_child', 'arrange_match', 'report_score', 'follow'],
  physio: ['see_people', 'see_staff', 'add_child', 'follow'], attendance: ['see_people', 'see_staff', 'add_child', 'follow'], analyst: ['see_people', 'see_staff', 'add_child', 'follow'], member: ['add_child', 'follow'],
  teammanager: ['see_staff', 'add_child', 'arrange_match', 'report_score', 'follow'], gkcoach: ['see_staff', 'add_child', 'follow'],
  headofcoaching: ['see_people', 'see_staff', 'add_helper', 'add_child', 'arrange_match', 'report_score', 'follow'], kit: ['see_staff', 'add_child', 'follow'], helper: ['add_child', 'follow'] };
const refusedReason = action => action === 'see_staff' ? refusal(action, 'ONLY_CLUB_STAFF', 'Staff is for the club’s staff.')
  : action === 'add_helper' ? refusal(action, 'ONLY_HEAD_COACHES', 'Only this squad’s head coach can add a helper.')
    : ['arrange_match', 'report_score'].includes(action) ? refusal(action, 'ONLY_SQUAD_MATCH_STAFF', 'Only a squad’s coaches arrange its matches.')
      : refusal(action, 'ONLY_ADMINS', 'Only the club’s admins can do this.');
// As the server: club work needs a known adult, so Luka without a birth date (/__mode/nodob) is asked for it first and
// may only follow.
const dated = (allowed, refused) => accountProfile.dob ? answer(allowed, refused) : answer(allowed.filter(action => action === 'follow'),
  [...allowed.filter(action => action !== 'follow').map(action => refusal(action, 'BIRTH_DATE_NEEDED', 'Add your date of birth first.')), ...refused]);
get('/access/clubs/:id', ({ params, headers }) => {
  const club = W.clubs.find(item => item.id === Number(params.id));
  if (!club) return undefined;
  const own = !V.isNewcomer(headers) && F.isMineClub(club.id);
  const persona = own ? PERSONA_ACTIONS[V.personaOf(headers)] : undefined;
  // In a persona Luka isn't an admin: the academy director runs the club.
  if (persona) return { clubId: club.id, squadId: null, ...dated(persona, CLUB_ACTIONS.filter(action => !persona.includes(action)).map(refusedReason)),
    admins: [{ userId: C.STAFF.director, name: C.name(C.STAFF.director), owner: true }] };
  if (own) return { clubId: club.id, squadId: null, ...dated(CLUB_ACTIONS, []), admins: [{ userId: W.ME_ID, name: 'Luka Gelashvili', owner: true }] };
  return { clubId: club.id, squadId: null, ...answer(['add_child', 'follow'], CLUB_ACTIONS.filter(action => !['add_child', 'follow'].includes(action))
    .map(action => refusal(action, 'ONLY_ADMINS', 'Only the club’s admins can do this.'))), admins: [] };
});

const SQUAD_ACTIONS = ['join_squad', 'add_child', 'manage_join_link', 'approve_join_requests', 'link_parent', 'add_helper', 'invite_staff', 'arrange_match', 'report_score', 'follow'];
const step3Squad = (persona, squad) => {
  if (!M.squadRoles(persona).has(squad.id)) return ['join_squad', 'add_child', 'follow'];
  return ['add_child', 'follow', ...(M.decidesJoining(persona, squad.id) ? ['manage_join_link', 'approve_join_requests', 'link_parent'] : []),
    ...(M.addsHelpers(persona, squad.id) ? ['add_helper'] : []), ...(M.can(persona, squad.id, 'MATCHES') ? ['arrange_match', 'report_score'] : [])];
};
get('/access/squads/:id', ({ params, headers }) => {
  const squad = F.sq(params.id);
  if (!squad) return undefined;
  // A physio, an attendance helper or a plain member coaches no squad.
  const coach = !V.isNewcomer(headers) && F.isMineClub(squad.clubId) && !['physio', 'attendance', 'member'].includes(V.personaOf(headers));
  const leads = coach && squad.headCoachId === W.ME_ID;
  // A coach is in the squad already, so joining is a parent's (for a child not in it yet). The Owner adds helpers anywhere.
  const persona = V.personaOf(headers);
  const allowed = !V.isNewcomer(headers) && F.isMineClub(squad.clubId) && M.STEP3_PERSONAS.includes(persona) ? step3Squad(persona, squad)
    : coach ? SQUAD_ACTIONS.filter(action => action !== 'join_squad' && (leads || !persona || action !== 'add_helper')) : ['join_squad', 'add_child', 'follow'];
  return { clubId: squad.clubId, squadId: squad.id, ...answer(allowed, SQUAD_ACTIONS.filter(action => !allowed.includes(action))
    .map(action => action === 'join_squad' ? refusal(action, 'ALREADY_IN_SQUAD', 'You are already in this squad.')
      : action === 'add_helper' ? refusal(action, 'ONLY_HEAD_COACHES', 'Only this squad’s head coach can add a helper.')
        : refusal(action, 'ONLY_SQUAD_COACHES', 'Only this squad’s head coach or assistant coach can do this.'))) };
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
