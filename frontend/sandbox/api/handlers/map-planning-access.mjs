import { createHash } from 'node:crypto';
import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as C from '../world-club.mjs';
import * as P from '../pages-data.mjs';
import { familyOf } from '../world-family.mjs';
import { stateFor } from './workspace-context.mjs';

const COACH_WRITE = new Set(['ATTENDANCE', 'DEVELOPMENT', 'READINESS', 'MATCHES']);
const COACH_READ = new Set(['AVAILABILITY', 'FACILITIES', 'TRAVEL', 'EDUCATION', 'REGISTRATION', 'GUARDIANS']);
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const persona = headers => V.personaOf(headers);
const current = appointment => appointment.status === 'ACTIVE' && (!appointment.starts_on || appointment.starts_on <= day()) && (!appointment.ends_on || appointment.ends_on >= day());

/** Rebuild from confirmed current records on every request; a described role or another actor's demo cookie grants nothing. */
export function planningScope(clubId, headers) {
  const actor = V.viewerId(headers), club = W.clubById(clubId), state = stateFor(Number(clubId));
  const account = V.account(actor), today = day(), eighteenthBirthday = `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
  const eligible = actor === W.ME_ID || Boolean(account && (account.accountState ?? 'ACTIVE') === 'ACTIVE'
    && (account.emailVerified ?? Boolean(account.email)) && account.dateOfBirth && account.dateOfBirth <= eighteenthBirthday);
  const squads = W.squads.filter(squad => squad.clubId === Number(clubId));
  const page = P.pages.get(`club:${Number(clubId)}`), role = P.roleOf(page, actor) ?? (Number(clubId) === C.CLUB_ID ? C.memberRole(actor) : null);
  const restrictedDemo = actor === W.ME_ID && Number(clubId) === C.CLUB_ID && persona(headers);
  const active = state.appointments.filter(appointment => appointment.club_id === Number(clubId) && appointment.user_id === actor && current(appointment));
  const leader = !restrictedDemo && ['OWNER', 'ADMIN', 'CLUB_ADMIN'].includes(role);
  const available = Boolean(eligible && club && club.status !== 'DISSOLVED' && (club.organizationState ?? 'ACTIVE') === 'ACTIVE');
  function can(squadId, module, write = false) {
    const squad = squads.find(item => item.id === Number(squadId));
    if (!available || !squad || restrictedDemo) return false;
    if (write && module !== 'MATCHES' && !state.settings.enabled_modules.includes(module)) return false;
    if (leader) return true;
    if (squad.headCoachId === actor && (COACH_WRITE.has(module) || !write && COACH_READ.has(module))) return true;
    return active.some(appointment => {
      const selected = appointment.squad_ids?.length ? appointment.squad_ids : appointment.squad_id != null ? [appointment.squad_id] : [];
      const inScope = selected.length ? selected.includes(squad.id) : appointment.club_wide !== false;
      return inScope && (appointment.permissions?.includes(`${module}:WRITE`) || !write && appointment.permissions?.includes(`${module}:READ`));
    });
  }
  const read = squad => can(squad, 'MATCHES') || can(squad, 'TRAVEL') || can(squad, 'FINANCE');
  const write = squad => can(squad, 'MATCHES', true) || can(squad, 'TRAVEL', true);
  return { actor, club, clubId: Number(clubId), state, squads, leader, can, read, write };
}

export const planningScopes = headers => W.clubs.map(club => planningScope(club.id, headers)).filter(scope => scope.squads.some(squad => scope.read(squad.id)));
export const planReadable = (plan, headers) => Boolean(plan && planningScope(plan.club_id, headers).read(plan.squad_id));
export const planWritable = (plan, headers) => Boolean(plan && planningScope(plan.club_id, headers).write(plan.squad_id));

export function planRights(plan, headers) {
  const scope = planningScope(plan.club_id, headers), edit = scope.write(plan.squad_id);
  return { edit, travel: scope.can(plan.squad_id, 'TRAVEL', true),
    finance: scope.can(plan.squad_id, 'FINANCE', true) && scope.actor !== plan.created_by && scope.actor !== (plan.last_editor ?? plan.created_by),
    publish: edit && scope.can(plan.squad_id, 'GUARDIANS', true), leadership: scope.leader };
}

// MapPlanRequests.Arrangement's stored fields, in record order; absent nullable fields become null.
export const arrangementFingerprint = item => createHash('sha256').update(JSON.stringify({
  key: item.key, kind: item.kind, title: item.title, placeKey: item.placeKey ?? null,
  amountMinor: item.amountMinor ?? 0, notes: item.notes ?? null, financeRecordId: item.financeRecordId ?? null,
})).digest('hex');

export function viewPlan(plan, headers) {
  const view = JSON.parse(JSON.stringify(plan)), rights = planRights(plan, headers), scope = planningScope(plan.club_id, headers);
  view.rights = rights;
  view.suppliers = Object.fromEntries(plan.draft.arrangements.flatMap(item => {
    const evidence = Object.hasOwn(plan.suppliers, item.key) && plan.suppliers[item.key];
    return evidence ? [[item.key, { ...evidence, status: evidence.fingerprint === arrangementFingerprint(item) ? evidence.status : 'REVIEW_REQUIRED' }]] : [];
  }));
  if (!scope.can(plan.squad_id, 'TRAVEL')) { view.trip = null; view.passengers = []; }
  return view;
}

/** Own-child identity is current and account scoped, including when a previous browser left a parent-mode cookie. */
export function ownChildren(headers) {
  const actor = V.viewerId(headers);
  return (actor === W.ME_ID ? familyOf(headers) : V.account(actor)?.children) ?? [];
}

const publications = new Map();
export function rememberPublication(plan) {
  if (!plan.published_version || !plan.published) return;
  publications.set(plan.id, { version: plan.published_version, snapshot: structuredClone(plan.published), participants: [...plan.draft.participants],
    activities: structuredClone(plan.draft.activities), at: plan.history?.find(item => item.action === 'PUBLISHED')?.created_at ?? plan.updated_at });
}
export const publicationOf = plan => {
  const publication = publications.get(plan.id);
  return publication?.version === plan.published_version ? publication : null;
};

export function familySubjects(plan, headers) {
  const publication = publicationOf(plan), squad = W.squadById(plan.squad_id), actor = V.viewerId(headers);
  if (!publication || !squad || squad.clubId !== plan.club_id) return [];
  const children = ownChildren(headers).map(child => child.id);
  return publication.participants.filter(id => squad.playerIds.includes(id) && (children.includes(id) || id === actor)).map(id => ({
    id, name: W.personById(id)?.fullName ?? V.account(id)?.fullName ?? ownChildren(headers).find(child => child.id === id)?.name ?? 'Player', guardian: children.includes(id) && id !== actor,
  }));
}

export function adultActor(headers) {
  const actor = V.account(V.viewerId(headers)), dob = actor?.dateOfBirth;
  if (!dob) return false;
  const today = day(), birthday = `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
  return dob <= birthday;
}

export const actorName = headers => V.account(V.viewerId(headers))?.fullName ?? W.personById(V.viewerId(headers))?.fullName ?? 'Staff';
