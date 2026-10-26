// Who is asking. The sandbox is coach Luka's world, but anyone who registers here gets an account of their
// own (in memory, gone on restart), so a new person's start can be judged on the same data. A request
// belongs to the account named by its bearer token or by the `gk-sandbox-user` cookie; otherwise to Luka.
//
// BACKEND NEEDED — the start of a new person (see docs/claude-sandbox/BACKEND_NEEDS.md, "Sign-in and the start"):
//   * `role` optional at registration (POST /auth/register, PUT /users/me/onboarding); until then the frontend sends FAN.
//   * Registration by phone number (`phone` instead of `email`, with an SMS code).
//   * GET/PUT /users/me/feed-preferences { town: { name, latitude, longitude } | null, topics: Topic[], activity: 'PLAY' | 'COACH' | 'PARENT' | 'WATCH' | null }
//     Topics: CLUBS | YOUTH | MATCHES | TOURNAMENTS | WOMENS | JOBS | STORE. The town is where the feed is local to.
//   * POST /feed/events { events: [{ postId, type: SEEN | OPENED | HIDDEN | LESS | UNDO_LESS, at }] } → 202 { accepted }
//     The server records follows itself. LESS demotes posts on that topic from that author for the person.
import * as W from './world.mjs';
import * as C from './world-club.mjs';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
/** A sandbox token in the JWT shape the app reads (`sub` is the account id). */
export const accessToken = (id = W.ME_ID) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: String(id), exp: Math.floor(Date.now() / 1000) + 86400 })}.sandbox`;

export const COOKIE = 'gk-sandbox-user';
export const sessionCookie = id => `${COOKIE}=${id}; Path=/; SameSite=Lax`;
export const clearedCookie = `${COOKIE}=; Path=/; Max-Age=0`;

/** Georgian towns the start screens offer, with the centre the feed measures distance from. */
export const TOWNS = {
  Tbilisi: { lat: 41.7151, lng: 44.8271 }, Batumi: { lat: 41.6168, lng: 41.6367 }, Kutaisi: { lat: 42.2679, lng: 42.6946 }, Rustavi: { lat: 41.5495, lng: 45.0012 },
  Gori: { lat: 41.9847, lng: 44.1086 }, Zugdidi: { lat: 42.5088, lng: 41.8709 }, Poti: { lat: 42.1462, lng: 41.6719 }, Kobuleti: { lat: 41.8167, lng: 41.7833 },
  Telavi: { lat: 41.9198, lng: 45.4732 }, Mtskheta: { lat: 41.8411, lng: 44.7067 }, Marneuli: { lat: 41.4767, lng: 44.8092 }, Samtredia: { lat: 42.1537, lng: 42.3366 },
  Zestaponi: { lat: 42.1097, lng: 43.0444 }, Senaki: { lat: 42.2697, lng: 42.0671 }, Khashuri: { lat: 41.9931, lng: 43.5986 }, Akhaltsikhe: { lat: 41.6392, lng: 42.9826 },
  Ozurgeti: { lat: 41.9245, lng: 42.0057 }, Borjomi: { lat: 41.8396, lng: 43.3892 }, Gurjaani: { lat: 41.7436, lng: 45.8003 }, Kaspi: { lat: 41.9256, lng: 44.4236 },
};
export const townRecord = name => {
  const key = String(name ?? '').trim();
  if (!key) return null;
  const known = Object.keys(TOWNS).find(town => town.toLowerCase() === key.toLowerCase());
  return known ? { name: known, latitude: TOWNS[known].lat, longitude: TOWNS[known].lng } : { name: key, latitude: null, longitude: null };
};

export const TOPICS = ['CLUBS', 'YOUTH', 'MATCHES', 'TOURNAMENTS', 'WOMENS', 'JOBS', 'STORE'];
export const ACTIVITIES = ['PLAY', 'COACH', 'PARENT', 'WATCH'];
export const EVENT_TYPES = ['SEEN', 'OPENED', 'HIDDEN', 'LESS', 'UNDO_LESS', 'FOLLOWED', 'UNFOLLOWED'];
/** Where people give up creating a page: each step of the funnel, recorded with the feed's events (no post attached). */
export const FUNNEL_EVENTS = ['PAGE_CREATE_OPENED', 'PAGE_TYPE_CHOSEN', 'PAGE_CREATED', 'PAGE_BOX_FILLED', 'PAGE_LIVE', 'PAGE_SHARED'];

// ---------------------------------------------------------------- registered accounts
export const accounts = new Map(); // id -> account
let nextAccountId = 9500;
export const normalizePhone = value => String(value ?? '').replace(/[\s()-]/g, '');
export function createAccount({ fullName, email = null, phone = null, password, dateOfBirth, town = null }) {
  const id = nextAccountId++;
  const parts = String(fullName).trim().split(/\s+/);
  const account = {
    id, fullName: parts.join(' '), firstName: parts[0], lastName: parts.slice(1).join(' '), email: email ? String(email).trim().toLowerCase() : null,
    phone: phone ? normalizePhone(phone) : null, password, dateOfBirth, createdAt: new Date(),
    preferences: { town: townRecord(town), topics: [], activity: null, updatedAt: null },
    roles: [], clubFollows: new Set(), demoted: new Set(), events: [],
  };
  accounts.set(id, account);
  return account;
}
export const accountByLogin = login => {
  const key = String(login ?? '').trim().toLowerCase();
  return key ? [...accounts.values()].find(a => a.email === key || a.phone === normalizePhone(key)) ?? null : null;
};
export const account = id => accounts.get(Number(id)) ?? null;

const cookieViewer = headers => { const match = /(?:^|;\s*)gk-sandbox-user=(\d+)/.exec(String(headers?.cookie ?? '')); return match ? Number(match[1]) : null; };
const tokenViewer = headers => {
  const auth = String(headers?.authorization ?? '');
  if (!auth.startsWith('Bearer ')) return null;
  try { return Number(JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString()).sub) || null; } catch { return null; }
};
/** The person a request is for: a registered account's token or cookie, else coach Luka. */
export const viewerId = headers => { const id = tokenViewer(headers) ?? cookieViewer(headers); return id != null && accounts.has(id) ? id : W.ME_ID; };
export const isNewcomer = headers => viewerId(headers) !== W.ME_ID;

/** The `/users/me` projection of a registered account: nobody has confirmed a link yet, so no workspaces. */
export const accountProjection = a => ({
  id: a.id, username: null, email: a.email, phone: a.phone, role: 'FAN', fullName: a.fullName, name: a.fullName, avatarUrl: null, dob: a.dateOfBirth,
  profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: Boolean(a.email),
  navigationCapabilities: { version: 1, workspaces: [] },
});
export const accountDto = a => ({
  id: a.id, username: null, email: a.email, role: 'FAN', displayName: a.firstName, emailVerified: Boolean(a.email), emailVerifiedAt: a.email ? a.createdAt.toISOString() : null,
  passwordLoginEnabled: true, fullName: a.fullName, bio: null, avatarUrl: null, bannerUrl: null, playerProfile: null, linkedAccounts: [],
  sessionsSupported: true, sessionRevocationSupported: true, accountDeletionSupported: true,
});
/** A registered account as other people see it. */
export const accountProfile = (a, viewer) => ({
  id: a.id, username: null, fullName: a.fullName, role: 'FAN', position: null, secondaryPosition: null, preferredFoot: null, bio: null, availabilityStatus: null,
  heightCm: null, weightKg: null, followerCount: 0, followingCount: 0, isFollowedByMe: false, careerHistory: [], avatarUrl: null, bannerUrl: null,
  dateOfBirth: viewer === a.id ? a.dateOfBirth : null, isPrivate: false, roleProfiles: a.roles.filter(r => r.published || viewer === a.id),
  footballProfile: { roles: a.roles.map(r => r.role), appointments: [], entries: [] },
});

// ---------------------------------------------------------------- what the feed knows about a person
const lukaPreferences = { town: townRecord('Tbilisi'), topics: [], activity: 'COACH', updatedAt: null };
export const preferencesOf = id => id === W.ME_ID ? lukaPreferences : account(id)?.preferences ?? null;
/** Clubs a person follows: Luka's live in the club domain, a registered account's on the account. */
export const clubFollowsOf = id => id === W.ME_ID ? C.followed : account(id)?.clubFollows ?? new Set();
const lukaDemoted = new Set();
/** `${author}:${topic}` pairs the person asked to see less of. */
export const demotedOf = id => id === W.ME_ID ? lukaDemoted : account(id)?.demoted ?? new Set();
const lukaEvents = [];
/** Everything recorded for the learning algorithm later: what the person saw, opened, hid and followed. */
export const eventsOf = id => id === W.ME_ID ? lukaEvents : account(id)?.events ?? [];
export const recordEvent = (viewer, event) => { eventsOf(viewer).push({ at: new Date().toISOString(), ...event }); };
