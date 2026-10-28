// Synthetic API: sign-in. Coach Luka is signed in by default; registering here creates an account of its own
// (see ../viewer.mjs). Requests and answers keep the real backend's shapes.
import { get, post, put, reply } from '../router.mjs';
import { me, clubs } from '../world.mjs';
import { familyRequest, hasFamily } from '../world-family.mjs';
import * as V from '../viewer.mjs';

const bad = message => reply(400, { status: 400, message });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?\d{9,15}$/;
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const USER_TYPES = new Set(['FAN', 'PLAYER', 'AGENT', 'CLUB_ADMIN', 'SYSTEM_ADMIN', 'ORGANIZER', 'PARENT', 'COACH', 'REFEREE', 'VENUE_MANAGER']);
const ageOn = (dob, now = new Date()) => { const d = new Date(`${dob}T00:00:00`); let age = now.getFullYear() - d.getFullYear(); if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--; return age; };
const sessionReply = (id, headers = {}) => reply(200, { accessToken: V.accessToken(id), expiresIn: 86400 }, headers);
// Demo personas belong to the account being reviewed; they must never follow a sign-in/account change.
const sessionCookies = cookie => [cookie, 'gk-sandbox-family=; Path=/; Max-Age=0', 'gk-sandbox-persona=; Path=/; Max-Age=0'];

get('/auth/csrf', () => reply(200, { headerName: 'X-XSRF-TOKEN', token: 'sandbox-csrf', parameterName: '_csrf' }, { 'set-cookie': 'XSRF-TOKEN=sandbox-csrf; Path=/' }));
// A page opened with `signedout` in its address stays a guest (the screenshot harness skips its sign-in for these too).
post('/auth/refresh', ({ headers }) => String(headers?.referer ?? '').includes('signedout')
  ? reply(401, { status: 401, message: 'No session' })
  : sessionReply(V.viewerId(headers)));

// As the backend validates it. A phone number instead of an email is accepted here only (BACKEND NEEDED).
post('/auth/register', ({ body }) => {
  const fullName = String(body?.fullName ?? '').trim();
  if (fullName.length < 2 || fullName.length > 100) return bad('Full name must be between 2 and 100 characters');
  const email = body?.email ? String(body.email).trim().toLowerCase() : null;
  const phone = body?.phone ? V.normalizePhone(body.phone) : null;
  if (!email && !phone) return bad('Email is required');
  if (email && !EMAIL.test(email)) return bad('Must be a valid email address');
  if (phone && !PHONE.test(phone)) return bad('Must be a valid phone number');
  if (!PASSWORD.test(String(body?.password ?? ''))) return bad('Password must contain at least one uppercase letter, one lowercase letter, and one digit');
  if (!body?.role) return bad('Role is required');
  if (!USER_TYPES.has(body.role)) return bad('Invalid role.');
  const dob = String(body?.dateOfBirth ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || new Date(dob) >= new Date()) return bad('Date of birth must be in the past');
  if (ageOn(dob) < 13) return bad('You must be at least 13 years old to register.');
  if ((email && (V.accountByLogin(email) || email === me.email)) || (phone && V.accountByLogin(phone))) return reply(409, { status: 409, message: 'Email already registered.' });
  const account = V.createAccount({ fullName, email, phone, password: body.password, dateOfBirth: dob, town: body?.town });
  return reply(201, { message: 'Registration successful. You can sign in now.', emailVerificationRequired: false }, { 'set-cookie': sessionCookies(V.sessionCookie(account.id)) });
});

// A registered account signs in with its own password; any other email is the demo coach.
post('/auth/login', ({ body }) => {
  const account = V.accountByLogin(body?.email ?? body?.phone);
  if (account) {
    if (account.password !== body?.password) return reply(401, { status: 401, message: 'Invalid email or password.' });
    return sessionReply(account.id, { 'set-cookie': sessionCookies(V.sessionCookie(account.id)) });
  }
  return sessionReply(me.id, { 'set-cookie': sessionCookies(V.clearedCookie) });
});
post('/auth/logout', () => reply(204, undefined, { 'set-cookie': sessionCookies(V.clearedCookie) }));

// What the server would answer for each persona: Club office for the Owner and for a job with no page of its own yet
// (the physio, the analyst); a head coach's own work is My squads, so no Club office tab. A physio coaches no squad.
const clubCapabilities = persona => persona === 'physio' ? ['club.operations', 'club.member', 'club.office']
  : persona === 'headcoach' ? ['club.workspace', 'club.operations', 'club.member']
    : persona === 'analyst' ? ['club.workspace', 'club.operations', 'club.member', 'club.office']
      : persona === 'member' ? ['club.workspace', 'club.operations'] : ['club.workspace', 'club.office', 'club.operations'];
// The parent view (family cookie) also makes Luka a parent, so Parent Hub joins his tabs.
export const meProjection = ({ headers } = {}) => ({
  id: me.id, username: 'coach.luka', email: me.email, role: 'USER', fullName: me.fullName, name: me.fullName, avatarUrl: me.avatarUrl,
  dob: '1988-04-12', profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: true,
  navigationCapabilities: { version: 1, workspaces: [
    ...clubCapabilities(V.personaOf(headers)).map(id => ({ id, context: { type: 'club', id: 1, label: clubs[0].name } })),
    ...(V.personaOf(headers) === 'physio' ? [] : [
      { id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16 Boys' } },
      { id: 'squad.workspace', context: { type: 'squad', id: 103, label: 'U14 Boys' } }]),
    // Luka runs the league Dinamo hosts and coordinates the U16 cup (an ADMIN assignment on each).
    { id: 'tournament.workspace', context: { type: 'tournament', id: 301, label: 'Tbilisi Community League' } },
    { id: 'tournament.workspace', context: { type: 'tournament', id: 306, label: 'Georgian Youth Cup U16' } },
    ...(familyRequest(headers) ? [{ id: 'parent.hub', context: { type: 'user', id: me.id, label: me.fullName } }] : []),
  ] },
});
// Project the family domain's confirmed access alongside the person's navigation capabilities.
get('/users/me', ({ headers }) => {
  const account = V.account(V.viewerId(headers));
  if (!account) return meProjection({ headers });
  const projection = V.accountProjection(account);
  return hasFamily(headers) ? { ...projection, navigationCapabilities: { version: 1, workspaces: [{ id: 'parent.hub', context: { type: 'user', id: account.id, label: account.fullName } }] } } : projection;
});

// Accounts missing a name or a date of birth (Google sign-ins) complete them here; the session is reissued.
put('/users/me/onboarding', ({ headers, body }) => {
  const viewer = V.viewerId(headers), account = V.account(viewer);
  const fullName = String(body?.fullName ?? '').trim();
  if (fullName.length < 2 || fullName.length > 100) return bad('Full name must be between 2 and 100 characters');
  if (!body?.role || !USER_TYPES.has(body.role)) return bad('Role is required');
  if (!body?.dateOfBirth || new Date(body.dateOfBirth) >= new Date()) return bad('Date of birth must be in the past');
  if (account) Object.assign(account, { fullName, firstName: fullName.split(/\s+/)[0], lastName: fullName.split(/\s+/).slice(1).join(' '), dateOfBirth: body.dateOfBirth });
  return { accessToken: V.accessToken(viewer) };
});

// ---------------------------------------------------------------- the start: what the feed is for
get('/users/me/feed-preferences', ({ headers }) => V.preferencesOf(V.viewerId(headers)));
put('/users/me/feed-preferences', ({ headers, body }) => {
  const prefs = V.preferencesOf(V.viewerId(headers));
  if (body?.town !== undefined) {
    if (body.town !== null && typeof body.town?.name !== 'string') return bad('A town needs a name.');
    prefs.town = body.town === null ? null : { name: String(body.town.name).trim().slice(0, 80), latitude: Number.isFinite(body.town.latitude) ? body.town.latitude : null, longitude: Number.isFinite(body.town.longitude) ? body.town.longitude : null };
  }
  if (body?.topics !== undefined) {
    if (!Array.isArray(body.topics) || body.topics.some(topic => !V.TOPICS.includes(topic))) return bad(`Topics must be among ${V.TOPICS.join(', ')}.`);
    prefs.topics = [...new Set(body.topics)];
  }
  if (body?.activity !== undefined) {
    if (body.activity !== null && !V.ACTIVITIES.includes(body.activity)) return bad(`Activity must be one of ${V.ACTIVITIES.join(', ')}.`);
    prefs.activity = body.activity;
  }
  prefs.updatedAt = new Date().toISOString();
  return prefs;
});
