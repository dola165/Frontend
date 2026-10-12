import { get, post, reply } from '../router.mjs';
import { me, clubs } from '../world.mjs';
import { familyRequest } from '../world-family.mjs';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
export const accessToken = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: String(me.id), exp: Math.floor(Date.now() / 1000) + 86400 })}.sandbox`;

get('/auth/csrf', () => reply(200, { headerName: 'X-XSRF-TOKEN', token: 'sandbox-csrf', parameterName: '_csrf' }, { 'set-cookie': 'XSRF-TOKEN=sandbox-csrf; Path=/' }));
// A page opened with `signedout` in its address stays a guest (the screenshot harness skips its sign-in for these too).
post('/auth/refresh', ({ headers }) => String(headers?.referer ?? '').includes('signedout')
  ? reply(401, { status: 401, message: 'No session' })
  : { accessToken: accessToken(), expiresIn: 86400 });
post('/auth/login', () => ({ accessToken: accessToken(), expiresIn: 86400 }));
post('/auth/logout', () => reply(204));

// The parent view (family cookie) also makes Luka a parent, so Parent Hub joins his tabs.
export const meProjection = ({ headers } = {}) => ({
  id: me.id, username: 'coach.luka', email: me.email, role: 'USER', fullName: me.fullName, name: me.fullName, avatarUrl: me.avatarUrl,
  dob: '1988-04-12', profileComplete: true, onboardingRequired: false, mustChangePassword: false, emailVerified: true,
  navigationCapabilities: { version: 1, workspaces: [
    { id: 'club.workspace', context: { type: 'club', id: 1, label: clubs[0].name } },
    { id: 'club.operations', context: { type: 'club', id: 1, label: clubs[0].name } },
    { id: 'squad.workspace', context: { type: 'squad', id: 105, label: 'U16 Boys' } },
    { id: 'squad.workspace', context: { type: 'squad', id: 103, label: 'U14 Boys' } },
    // Luka runs the league Dinamo hosts and coordinates the U16 cup (an ADMIN assignment on each).
    { id: 'tournament.workspace', context: { type: 'tournament', id: 301, label: 'Tbilisi Community League' } },
    { id: 'tournament.workspace', context: { type: 'tournament', id: 306, label: 'Georgian Youth Cup U16' } },
    ...(familyRequest(headers) ? [{ id: 'parent.hub', context: { type: 'user', id: me.id, label: me.fullName } }] : []),
  ] },
});
get('/users/me', meProjection);
