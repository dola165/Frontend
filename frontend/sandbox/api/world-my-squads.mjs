// My squads, step 3 (owner, 29 October 2026): who is on which squad in the sandbox. Every persona is still Luka's
// account (user 1) with another job at FC Dinamo Tbilisi Academy, set by /__mode/… (see viewer.mjs):
//   teammanager     Team manager of U16 Boys: on the squad, reads it, sends call-ups, books the bus; no coaching writes.
//   gkcoach         Specialist coach titled Goalkeeper coach, U14 and U16 Boys: coaches, but doesn't decide joining.
//   headofcoaching  Head of coaching: a club-wide Head coach with the lead mark, on every squad.
//   kit             Equipment manager: on no squad; Club office stays the tab.
//   helper          No job at all: added to one U12 Mixed session, which comes to Home.
// The old personas: `headcoach` coaches U14 and U16; none (the Owner) leads the club and coaches U14 and U16 too.
import * as W from './world.mjs';
import * as C from './world-club.mjs';

const HEAD_COACH = ['ATTENDANCE:WRITE', 'DEVELOPMENT:WRITE', 'READINESS:WRITE', 'MATCHES:WRITE', 'AVAILABILITY:READ', 'FACILITIES:READ', 'GUARDIANS:READ', 'EDUCATION:READ', 'REGISTRATION:READ', 'TRAVEL:READ'];
export const COACHED = [103, 105];
/** The jobs a persona holds at Dinamo; `squads: []` is the whole club. */
export const PERSONA_JOBS = {
  teammanager: [{ id: 96011, key: 'TEAM_MANAGER', code: 'TEAM_MANAGER', title: 'Team manager', squads: [105], tools: ['MATCHES:WRITE', 'READINESS:WRITE', 'ATTENDANCE:WRITE', 'REGISTRATION:WRITE', 'TRAVEL:WRITE', 'GUARDIANS:READ', 'FACILITIES:READ'] }],
  gkcoach: [{ id: 96012, key: 'SPECIALIST_COACH', code: 'SPECIALIST_COACH', title: 'Goalkeeper coach', squads: COACHED, tools: ['DEVELOPMENT:WRITE', 'ATTENDANCE:WRITE', 'AVAILABILITY:READ', 'FACILITIES:READ', 'MATCHES:READ'] }],
  headofcoaching: [{ id: 96013, key: 'HEAD_OF_COACHING', code: 'HEAD_COACH', title: 'Head of coaching', squads: [], tools: HEAD_COACH, lead: true }],
  kit: [{ id: 96014, key: 'EQUIPMENT_MANAGER', code: 'EQUIPMENT_MANAGER', title: 'Equipment manager', squads: [], tools: ['EQUIPMENT:WRITE'] }],
  helper: [],
};
export const STEP3_PERSONAS = Object.keys(PERSONA_JOBS);
/** The invented job holders of Staff (club-people.mjs) on Dinamo's squads, as a squad's overview lists them. */
const SQUAD_STAFF = [
  { user_id: 97001, full_name: 'Nino Japaridze', role: 'COACH', title: 'Goalkeeper coach', squads: [103] },
  { user_id: 97002, full_name: 'Giorgi Abashidze', role: 'COACH', title: 'Head of coaching', squads: [] },
  { user_id: 97003, full_name: 'Mariam Kalandadze', role: 'STAFF', title: 'Travel coordinator', squads: [] },
];
export const squadStaffOn = squad => SQUAD_STAFF.filter(person => !person.squads.length || person.squads.includes(squad)).map(({ squads, ...person }) => { void squads; return person; });
const SQUAD_JOBS = new Set(['HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'SPECIALIST_COACH', 'HEAD_OF_COACHING', 'TRAVEL_COORDINATOR']);
export const onSquadsJob = job => SQUAD_JOBS.has(job.key);
const dinamo = () => W.squads.filter(s => s.clubId === C.CLUB_ID).map(s => s.id);
export const jobSquads = job => job.squads.length ? job.squads : dinamo();

/**
 * Which Dinamo squads the persona is on, and how: COACH (coaching tools), STAFF (on the squad without coaching), or
 * absent. `undefined` for the older personas, whose answers stay with the existing handlers.
 */
export function squadRoles(persona) {
  if (!persona) return new Map(dinamo().map(id => [id, 'COACH']));
  if (persona === 'headcoach') return new Map(COACHED.map(id => [id, 'COACH']));
  const jobs = PERSONA_JOBS[persona];
  if (!jobs) return undefined;
  const roles = new Map();
  for (const job of jobs.filter(onSquadsJob))
    for (const id of jobSquads(job)) {
      const coaches = job.tools.includes('ATTENDANCE:WRITE') && job.tools.includes('DEVELOPMENT:WRITE');
      if (coaches || !roles.has(id)) roles.set(id, coaches ? 'COACH' : 'STAFF');
    }
  return roles;
}

/** The squads that open My squads for the persona (the navigation's squad.workspace). The Owner's are those he coaches. */
export const mySquads = persona => !persona || persona === 'headcoach' ? COACHED : [...(squadRoles(persona)?.keys() ?? [])];

/** A persona's tools in a squad (the backend's ClubOperationsAccess), with a squad job's reads of matches and preparation. */
export function toolsIn(persona, squad) {
  if (!persona) return null; // the Owner: every tool
  if (persona === 'headcoach') return COACHED.includes(squad) ? HEAD_COACH : [];
  const jobs = PERSONA_JOBS[persona] ?? [];
  return [...new Set(jobs.filter(job => jobSquads(job).includes(squad)).flatMap(job => onSquadsJob(job) ? [...job.tools, 'MATCHES:READ', 'READINESS:READ'] : job.tools))];
}
export const can = (persona, squad, module, write = true) => {
  const tools = toolsIn(persona, squad);
  return tools === null || tools.includes(`${module}:WRITE`) || (!write && tools.includes(`${module}:READ`));
};

/**
 * Joining is decided by the squad's head or assistant coach, the head of coaching and admins (decision 2); a request
 * without a squad goes to the head of coaching and admins.
 */
export const decidesJoining = (persona, squad) => !persona || persona === 'headofcoaching' || (persona === 'headcoach' && squad != null && COACHED.includes(squad));
/** Helpers are added by the squad's head coach, the head of coaching and admins (decision 3). */
export const addsHelpers = decidesJoining;

/** Applications from the seed, with the squad each family picked; 8104 is older and has none. */
export const APPLICATION_SQUADS = new Map([[8101, 103], [8102, 105], [8103, 103], [8104, null], [8105, 102], [8107, 105], [8108, 105], [8109, 103]]);

/** The persona's club tools in the bootstrap's shape (one entry per module), with a squad job's implicit reads. */
export function personaModules(persona, modules) {
  const jobs = PERSONA_JOBS[persona] ?? [];
  return modules.flatMap(id => {
    const read = new Set(), write = new Set();
    let globalRead = false, globalWrite = false;
    for (const job of jobs) {
      const tools = onSquadsJob(job) ? [...job.tools, 'MATCHES:READ', 'READINESS:READ'] : job.tools;
      const reads = tools.some(tool => tool === `${id}:READ` || tool === `${id}:WRITE`), writes = tools.includes(`${id}:WRITE`);
      if (!reads) continue;
      if (!job.squads.length) { globalRead = true; globalWrite ||= writes; }
      for (const squad of jobSquads(job)) { read.add(squad); if (writes) write.add(squad); }
    }
    return read.size ? [{ id, writable: write.size > 0, globalRead, globalWrite, readSquads: [...read], writeSquads: [...write] }] : [];
  });
}

/** One role view per job, as the backend's roles workspace answers (with `onSquads`, step 3). */
export const personaViews = (persona, modulesOf) => (PERSONA_JOBS[persona] ?? []).map(job => ({
  id: `appointment-${job.id}`, label: job.title, modules: modulesOf(job), squadIds: jobSquads(job), clubWide: !job.squads.length,
  appointmentId: job.id, revision: 1, onSquads: onSquadsJob(job),
}));
