import { expect, it } from 'vitest';
import { sessionNavigation } from './sessionLink';
it('opens an offset-independent UTC hint paired with an authorized-feed session id', () => {
    const result = sessionNavigation(new URLSearchParams('tab=sessions&sessionId=19&at=2026-09-22T14%3A00%3A00.123456Z'));
    expect(result.initialSessionId).toBe(19);
    expect(result.initialDate?.toISOString()).toBe('2026-09-22T14:00:00.123Z');
});
it.each(['tab=sessions&sessionId=19', 'tab=announcements&sessionId=19&at=2026-09-22T14:00:00Z', 'tab=sessions&sessionId=-1&at=2026-09-22T14:00:00Z', 'tab=sessions&sessionId=999999999999999999&at=2026-09-22T14:00:00Z', 'tab=sessions&sessionId=19&at=2026-02-31T14:00:00Z'])('ignores incomplete or invalid hints: %s', query => {
    expect(sessionNavigation(new URLSearchParams(query))).toEqual({});
});
