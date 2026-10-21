import { expect, it, vi } from 'vitest';
import { coachNeeds } from './coachNeeds';
import type { CoachSquad } from './useCoachData';
import '../../../i18n';

const now = Date.parse('2026-10-17T10:00:00Z');
const squad: CoachSquad = { id: 401, failed: [], error: '', overview: { id: 401, club_id: 400, viewer_id: 9500, academy_name: 'Assigned club', name: 'Assigned U12', category: 'U12', can_manage: true, unread_count: 0, member_count: 1, notify_chat: true, head_coach_id: 9500, can_assign_coach: false, available_coaches: [], coaches: [], players: [], threads: [{ user_id: 9601, full_name: 'Family', unread_count: 1 }] },
    sessions: [{ id: 77, title: 'Reply requested', starts_at: '2026-10-18T10:00:00Z', ends_at: '2026-10-18T11:00:00Z', location: null, revision: 1, status: 'SCHEDULED', cancellation_reason: null, response_requested: true, attendance: [{ id: 8, name: 'Player', response: 'UNANSWERED' }] }],
    updates: [{ id: 88, author_id: 9500, author_name: 'Coach', thread_user_id: null, kind: 'ANNOUNCEMENT', title: 'Important fixture update', body: 'Fixture body', important: true, acknowledgement_requested: true, acknowledged_at: null, acknowledged_by: [], expires_at: '2099-01-01T00:00:00Z', created_at: '2026-10-17T09:00:00Z' }],
};
const input = { club: 400, squads: [squad], names: new Map([[401, 'Assigned U12']]), records: [], mine: [], person: () => null, now };
it('secondary need links reuse the current hub link policy for internal destinations only', () => {
    const link = vi.fn((tab: string, context: Record<string, string>) => '/my-squads?' + new URLSearchParams({ tab, ...context, clubId: '400' }));
    const needs = coachNeeds({ ...input, link });
    expect(needs.find(need => need.kind === 'update')?.to).toBe('/my-squads?tab=updates&squad=401&clubId=400');
    expect(needs.find(need => need.kind === 'reply')?.to).toBe('/my-squads?tab=calendar&session=401%3A77&date=2026-10-18&clubId=400');
    expect(needs.find(need => need.kind === 'message')?.to).toBe('/messages?squadId=401&channel=coach&thread=9601');
    expect(link.mock.calls).toStrictEqual([['calendar', { session: '401:77', date: '2026-10-18' }], ['updates', { squad: '401' }]]);
});
it('secondary need links retain legacy relative queries when no context policy is supplied', () => {
    const needs = coachNeeds(input);
    expect(needs.find(need => need.kind === 'update')?.to).toBe('?tab=updates&squad=401');
    expect(needs.find(need => need.kind === 'reply')?.to).toBe('?tab=calendar&session=401:77&date=2026-10-18');
});
