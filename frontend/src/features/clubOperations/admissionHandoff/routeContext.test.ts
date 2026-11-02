import { expect, it } from 'vitest';
import { admissionHandoffFromParams, withoutAdmissionHandoff } from './routeContext';

it('derives only case/version from the URL and takes account/club exclusively from the authenticated bootstrap', () => {
    expect(admissionHandoffFromParams(new URLSearchParams('admissionCase=40&admissionVersion=7&actorId=999&clubId=999&player=999'), { clubId: 12, actorId: 9 }, 'current'))
        .toEqual({ state: 'ready', scope: { clubId: 12, actorId: 9, caseId: 40, caseVersion: 7, sessionId: 'current' } });
});
it.each(['admissionCase=40', 'admissionVersion=7', 'admissionCase=0&admissionVersion=1', 'admissionCase=3.2&admissionVersion=1',
    'admissionCase=3&admissionVersion=-1', 'admissionCase=9007199254740993&admissionVersion=1'])('rejects malformed source parameters %s', value => {
    expect(admissionHandoffFromParams(new URLSearchParams(value), { clubId: 12, actorId: 9 }, 'current')).toEqual({ state: 'invalid' });
});
it('does not change normal tools and removes only handoff context when opening the canonical record', () => {
    expect(admissionHandoffFromParams(new URLSearchParams('squad=66'), { clubId: 12, actorId: 9 }, 'current')).toEqual({ state: 'absent' });
    expect(withoutAdmissionHandoff(new URLSearchParams('admissionCase=40&admissionVersion=7&squad=66&record=81')).toString()).toBe('squad=66&record=81');
});
