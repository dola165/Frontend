// Synthetic API: a person who registered in the sandbox (see ../viewer.mjs). Registered right after sign-in, so
// for them these answers replace coach Luka's; for Luka every handler here passes on (returns undefined).
// Nobody has confirmed a link with them yet, so their lists are empty and their only club ties are follows.
import { get, put, reply } from '../router.mjs';
import * as W from '../world.mjs';
import * as C from '../world-club.mjs';
import * as V from '../viewer.mjs';

const forNewcomer = answer => ({ headers, ...rest }) => { const account = V.account(V.viewerId(headers)); return account ? answer(account, { headers, ...rest }) : undefined; };
const emptyPage = query => { const page = Math.max(0, Number(query.get('page') ?? 0) || 0), size = Math.max(1, Number(query.get('size') ?? 20) || 20); return { content: [], pageNumber: page, pageSize: size, totalElements: 0 }; };

get('/clubs/my-membership-context', forNewcomer(() => ({ hasClubMembership: false, canCreateClub: true, clubId: null, clubName: null, myRole: null })));
get('/users/me/account', forNewcomer(account => V.accountDto(account)));
put('/users/me', forNewcomer((account, { body }) => {
  if (body?.fullName) { const parts = String(body.fullName).trim().split(/\s+/); Object.assign(account, { fullName: parts.join(' '), firstName: parts[0], lastName: parts.slice(1).join(' ') }); }
  if (body?.dateOfBirth) account.dateOfBirth = String(body.dateOfBirth);
  return V.accountDto(account);
}));
get('/users/me/roles', forNewcomer(account => account.roles));
put('/users/me/roles', forNewcomer((account, { body }) => {
  const profiles = Array.isArray(body?.profiles) ? body.profiles : [];
  if (!profiles.length) return reply(400, { status: 400, message: 'Choose at least one football role.' });
  if (!profiles.some(r => r.primary)) profiles[0].primary = true;
  account.roles = profiles.map(r => ({ role: r.role, primary: !!r.primary, published: !!r.published, headline: r.headline ?? null, specialties: r.specialties ?? null, qualifications: r.qualifications ?? null, serviceArea: r.serviceArea ?? null }));
  return account.roles;
}));
get('/users/me/professions', forNewcomer(() => []));
get('/users/:id', forNewcomer((_, { params, headers }) => { const account = /^\d+$/.test(params.id) ? V.account(params.id) : null; return account ? V.accountProfile(account, V.viewerId(headers)) : undefined; }));
get('/users/:id/followers', forNewcomer((_, { params, query }) => (V.account(params.id) ? emptyPage(query) : undefined)));
get('/users/:id/following', forNewcomer((_, { params, query }) => (V.account(params.id) ? emptyPage(query) : undefined)));
get('/users/:id/coaching-career', forNewcomer((_, { params }) => (V.account(params.id) ? [] : undefined)));

get('/notifications', forNewcomer((_, { query }) => emptyPage(query)));
get('/notifications/unread-count', forNewcomer(() => ({ unreadCount: 0 })));
get('/requests', forNewcomer(() => ({ items: [], counts: { incoming: 0, actionable: 0, outgoing: 0, history: 0 }, total: 0, hasMore: false, unavailableSources: [] })));
get('/chat/conversations', forNewcomer((_, { query }) => emptyPage(query)));
get('/squad-communication', forNewcomer(() => []));
get('/player-cards/mine', forNewcomer(() => []));
get('/me/club-journey', forNewcomer(() => ({ applications: [], invitations: [], tryouts: [], recentDecisions: [], affiliations: [] })));
get('/admissions/home', forNewcomer(account => ({
  participants: [{ id: account.id, name: account.fullName, dateOfBirth: account.dateOfBirth, minor: false, guardian: false, provenance: 'SELF', gender: null, restriction: null }],
  cases: [], invitations: [], selfCardNeedsDetails: true, inquiries: [],
})));
get('/joining/children', forNewcomer(() => ({ children: [] })));
get('/organizations/invitations/mine', forNewcomer(() => []));
get('/organizations/team-invitations/mine', forNewcomer(() => []));
get('/recruitment/applications', forNewcomer(() => []));
get('/tryouts/my-applications', forNewcomer(() => []));
get('/clubs/followed', forNewcomer(account => [...account.clubFollows].map(id => ({ ...C.directoryItem(id), isFollowedByMe: true }))));
get('/clubs/:id/workspace-entry', forNewcomer((_, { params }) => (W.clubById(params.id) ? { canOpenWorkspace: false, canEditFacilities: false, canManageStaff: false, invitationOnly: false } : undefined)));
