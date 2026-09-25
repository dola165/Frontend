import { http, HttpResponse } from 'msw';
import { clubs, currentUserId, users } from '../data/store';
import { ageFromDob } from '../../utils/age';
import { simulateLatency } from '../utils';
import type { ParentHub } from '../../features/parents/api';

// Explicit fictional relationship between the existing parent@test.dev and
// youth@test.dev personas. Loaded only by the opt-in MSW demo environment.
const demoRelationship = { guardianUserId: 7, childUserId: 6, clubId: 1, cardId: 501 };

export const parentHandlers = [
    http.get('*/api/parents/hub', async () => {
        await simulateLatency();
        const viewerId = currentUserId();
        if (viewerId === null) return HttpResponse.json({ detail: 'Sign in to continue.' }, { status: 401 });
        const now = new Date();
        const payload: ParentHub = { children: [], scheduleFrom: now.toISOString(), scheduleTo: new Date(now.getTime() + 30 * 86400000).toISOString() };
        const guardian = users().get(viewerId);
        const child = users().get(demoRelationship.childUserId);
        const club = clubs().get(demoRelationship.clubId);
        if (viewerId === demoRelationship.guardianUserId && guardian?.emailVerified && guardian.dob && ageFromDob(guardian.dob) >= 18
            && child?.dob && ageFromDob(child.dob) >= 0 && ageFromDob(child.dob) < 18 && club) {
            payload.children.push({
                cardId: demoRelationship.cardId, userId: child.id, fullName: child.fullName ?? 'Saba Youth',
                birthYear: Number(child.dob.slice(0, 4)), photoUrl: null, position: child.position ?? null,
                registered: true, activationEligible: false, clubId: club.id, clubName: club.name,
                squadNames: [], affiliationStatus: 'TRIALIST', consentStatus: 'PENDING', trialEndsOn: null, publicEvents: [],
            });
        }
        return HttpResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
    }),
];
