import { expect, it } from 'vitest';
import { coachTrainingContext } from './coachData';
import type { CoachSquad } from './useCoachData';
import type { SquadSession } from '../../squadCommunication/api';
import { upcoming } from './useCoachData';

const now = Date.parse('2026-10-17T12:00:00Z');
const assigned = [{ id: 401, name: 'U12', player_count: 1 }];
const session = (id: number, overrides: Partial<SquadSession> = {}): SquadSession => ({ id, title: 'Actual training', starts_at: '2026-10-19T14:00:00Z', ends_at: '2026-10-19T15:30:00Z', location: 'Saved pitch', status: 'SCHEDULED', revision: 1, cancellation_reason: null, attendance: [], ...overrides });
const read = (id: number, sessions: SquadSession[], failed: CoachSquad['failed'] = []): CoachSquad => ({ id, sessions, failed, overview: null, updates: [], error: failed.length ? 'Offline' : '' });

it('uses only actual upcoming training from the current assigned squads', () => {
  const earliest = session(72);
  const context = coachTrainingContext(400, 9500, assigned, [read(999, [session(1)]), read(401, [session(71, { starts_at: '2026-10-20T14:00:00Z' }), session(73, { status: 'CANCELLED' }), session(74, { event_type: 'MATCH' }), session(75, { starts_at: '2026-10-16T14:00:00Z', ends_at: '2026-10-16T15:30:00Z' }), earliest])], now);
  expect(context).toEqual({ clubId: 400, actorId: 9500, state: 'ready', next: { squadId: 401, squadName: 'U12', session: earliest } });
  expect(context.next?.session).toBe(earliest);
});
it('distinguishes missing and failed/cached reads from a confirmed empty schedule', () => {
  expect(coachTrainingContext(400, 9500, assigned, null, now).state).toBe('loading');
  expect(coachTrainingContext(400, 9500, assigned, [], now)).toMatchObject({ state: 'unavailable', next: null });
  expect(coachTrainingContext(400, 9500, assigned, [read(401, [session(72)], ['sessions'])], now)).toMatchObject({ state: 'unavailable', next: null });
  expect(coachTrainingContext(400, 9500, assigned, [read(401, [])], now)).toMatchObject({ state: 'ready', next: null });
});
it('keeps a confirmed upcoming session when a different assigned squad could not load', () => {
  const actual = session(72);
  const context = coachTrainingContext(400, 9500, [...assigned, { id: 402, name: 'U16', player_count: 1 }], [read(401, [actual]), read(402, [], ['sessions'])], now);
  expect(context).toMatchObject({ state: 'unavailable', next: { squadId: 401, session: actual } });
});
it.each([
  ['in progress', '2026-10-19T15:30:00Z', '2026-10-19T14:05:00Z', true],
  ['at the end', '2026-10-19T15:30:00Z', '2026-10-19T15:30:00Z', true],
  ['completed', '2026-10-19T15:30:00Z', '2026-10-19T15:30:01Z', false],
  ['future without an end', '', '2026-10-19T13:59:00Z', true],
  ['elapsed without an end', '', '2026-10-19T14:05:00Z', false],
] as const)('preserves established current/upcoming semantics for %s', (_label, ends_at, at, included) => {
  const actual = session(72, { starts_at: '2026-10-19T14:00:00Z', ends_at }), loaded = read(401, [actual]);
  const clock = Date.parse(at), context = coachTrainingContext(400, 9500, assigned, [loaded], clock);
  expect(upcoming(loaded, clock)).toEqual(included ? [actual] : []);
  expect(context).toMatchObject({ state: 'ready', next: included ? { squadId: 401, session: actual } : null });
});
