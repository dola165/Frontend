import { renderHook } from '@testing-library/react';
import { useTournamentPermissions } from './useTournamentPermissions';
import type { TournamentDetail } from './domain';
it.each([undefined, null])('does not match redacted public assignments to an absent viewer (%s)', (viewerId) => {
    const tournament = JSON.parse('{"staffAssignments":[{"role":"ADMIN","status":"ACTIVE"},{"userId":null,"role":"REFEREE","status":"ACTIVE"}]}') as TournamentDetail;
    const { result } = renderHook(() => useTournamentPermissions(tournament, viewerId));
    expect(result.current).toEqual({ isAdmin: false, isStaff: false, isReferee: false, canManage: false, canScore: false, canEditSettings: false });
});
it('honors multiple recorded assignments regardless of ordering', () => {
    const tournament = { staffAssignments: [
        { userId: 1, status: 'ACTIVE', role: 'REFEREE' }, { userId: 1, status: 'ACTIVE', role: 'ADMIN' },
    ] } as TournamentDetail;
    const { result } = renderHook(() => useTournamentPermissions(tournament, 1));
    expect(result.current).toMatchObject({ isAdmin: true, isReferee: true, canScore: true, canEditSettings: true });
});
it('does not infer administration from referee identity or inactive appointments', () => {
    const tournament = { staffAssignments: [
        { userId: 1, status: 'ACTIVE', role: 'REFEREE' }, { userId: 1, status: 'INACTIVE', role: 'ADMIN' },
        { userId: 2, status: 'ACTIVE', role: 'ADMIN' },
    ] } as TournamentDetail;
    const { result } = renderHook(() => useTournamentPermissions(tournament, 1));
    expect(result.current).toMatchObject({ isReferee: true, canManage: false, canScore: false, canEditSettings: false });
});
