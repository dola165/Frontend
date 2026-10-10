// Synthetic API: the coach as a parent (see ../world-family.mjs). Registered first so these answers
// replace the coach-only ones only for a browser with the family cookie; otherwise they pass on.
// In a browser: document.cookie = 'gk-sandbox-family=1; path=/' and reload.
import { get } from '../router.mjs';
import * as W from '../world.mjs';
import { FAMILY, familyRequest } from '../world-family.mjs';

const participant = child => ({ id: child.id, name: child.name, dateOfBirth: child.dateOfBirth, minor: true, guardian: true, provenance: 'GUARDIAN', gender: child.gender, restriction: null });
const self = { id: W.ME_ID, name: W.me.fullName, dateOfBirth: '1988-04-12', minor: false, guardian: false, provenance: 'SELF', gender: 'MALE', restriction: null };

get('/admissions/home', ({ headers }) => familyRequest(headers)
  ? { participants: [self, ...FAMILY.map(participant)], cases: [], invitations: [], selfCardNeedsDetails: false, inquiries: [] }
  : undefined);

get('/joining/children', ({ headers }) => familyRequest(headers)
  ? { children: FAMILY.map(child => ({
      playerId: child.id, clubs: [], cases: [], inquiries: [],
      identity: { playerId: child.id, version: 1, fullName: child.name, dateOfBirth: child.dateOfBirth, gender: child.gender, photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true },
    })) }
  : undefined);
