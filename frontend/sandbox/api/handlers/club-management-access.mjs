// Guard the existing management handlers before they touch Dinamo's seed records.
import { route, reply } from '../router.mjs';
import * as C from '../world-club.mjs';
import * as W from '../world.mjs';
import { workspaceContext, denied, missing, validateScope } from './workspace-context.mjs';
const emptyPage = q => { const page = Math.max(0, Number(q.get('page')) || 0), size = Math.max(1, Number(q.get('size')) || 20); return { content: [], number: page, pageNumber: page, size, pageSize: size, totalElements: 0, totalPages: 1, last: true }; };
function guard(method, pattern, { leadership = false, empty, recordKind } = {}) {
  route(method, pattern, req => {
    const ctx = workspaceContext(req.params, req.headers);
    if (!ctx || leadership && !ctx.leadership) return denied();
    if (!ctx.leadership && !ctx.modules.length) return denied();
    if (recordKind === 'squad') {
      const squad = W.squadById(req.params.sid);
      if (!squad || squad.clubId !== ctx.clubId) return missing();
      if (!ctx.leadership && !ctx.coaching.includes(squad.id) && !ctx.modules.some(m => m.readSquads.includes(squad.id))) return denied();
      if (method !== 'GET' && !ctx.leadership && !ctx.coaching.includes(squad.id)) return denied();
    }
    if (recordKind === 'card') {
      const card = C.playerCards.find(c => c.id === Number(req.params.cid) && c.clubId === ctx.clubId); if (!card) return missing();
    }
    if (method !== 'GET') {
      const error = validateScope(ctx, req.body ?? {}); if (error) return error;
    }
    if (ctx.clubId !== C.CLUB_ID && empty) return typeof empty === 'function' ? empty(req) : empty;
    return undefined; // authorized: continue to the existing domain handler
  });
}
guard('GET', '/clubs/:id/management');
guard('GET', '/clubs/:id/management/applications', { empty: () => reply(200, [], { 'x-total-count': '0', 'access-control-expose-headers': 'x-total-count' }) });
guard('GET', '/clubs/:id/management/user-search', { leadership: true, empty: ({ query }) => emptyPage(query) });
for (const [method, tail] of [['POST', 'invitations'], ['DELETE', 'invitations/:iid'], ['PATCH', 'members/:uid/role'], ['POST', 'members/:uid/remove'], ['PUT', 'staff/:uid/profile']])
  guard(method, `/clubs/:id/management/${tail}`, { leadership: true, empty: missing });
for (const tail of ['accept', 'decline']) guard('POST', `/clubs/:id/management/applications/:aid/${tail}`, { empty: missing });
guard('POST', '/clubs/:id/applications/bulk-decide', { empty: missing });
guard('GET', '/clubs/:id/players', { empty: ({ query }) => emptyPage(query) });
for (const [method, tail] of [['PATCH', ':uid'], ['POST', ':uid/promote'], ['POST', ':uid/consent-email']]) guard(method, `/clubs/:id/players/${tail}`, { leadership: true, empty: missing });
guard('GET', '/clubs/:id/player-cards');
guard('POST', '/clubs/:id/player-cards', { leadership: true });
guard('PATCH', '/clubs/:id/player-cards/:cid', { leadership: true, recordKind: 'card' });
guard('DELETE', '/clubs/:id/player-cards/:cid', { leadership: true, recordKind: 'card' });
guard('POST', '/clubs/:id/squads', { leadership: true });
for (const [method, tail] of [['GET', '/roster'], ['PATCH', ''], ['DELETE', ''], ['POST', '/players'], ['POST', '/players/batch'], ['PATCH', '/players/:uid'], ['DELETE', '/players/:uid'], ['GET', '/age-policy'], ['PUT', '/age-policy']])
  guard(method, `/clubs/:id/squads/:sid${tail}`, { recordKind: 'squad', leadership: method === 'DELETE' && tail === '' });
guard('GET', '/admin/tryouts/clubs/:id/applications', { empty: [] });
guard('PUT', '/admin/tryouts/clubs/:id/applications/:aid/status', { empty: missing });

