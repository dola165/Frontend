import { describe, expect, it } from 'vitest';
import { extractApiErrorCode, extractApiErrorMessage } from './apiError';

const response = (data: unknown, status = 400) => ({ response: { data, status } });

describe('extractApiErrorMessage', () => {
    it('shows the actionable Problem Details explanation instead of its type URI or title', () => {
        expect(extractApiErrorMessage(response({ type: 'about:blank', title: 'Conflict', status: 409, detail: 'This shift is full. Choose another shift.', instance: '/api/volunteer-shifts/20/signup' }, 409)))
            .toBe('This shift is full. Choose another shift.');
    });
    it('prefers detail then message then error regardless of JSON property order', () => {
        expect(extractApiErrorMessage(response({ error: 'Conflict', message: 'Schedule changed.', detail: 'Expand the edition dates first.' }))).toBe('Expand the edition dates first.');
        expect(extractApiErrorMessage(response({ type: 'https://example.test/problem', error: 'Bad Request', message: 'Choose an available referee.', detail: '  ' }))).toBe('Choose an available referee.');
        expect(extractApiErrorMessage(response({ code: 'FULL', error: 'No places remain.', detail: null }))).toBe('No places remain.');
    });
    it('falls back to the problem title when no detailed explanation exists', () => {
        expect(extractApiErrorMessage(response({ type: 'about:blank', status: 404, title: 'Volunteer shift not found' }))).toBe('Volunteer shift not found');
    });
    it('preserves plain text and field-validation responses while ignoring metadata', () => {
        expect(extractApiErrorMessage(response('Choose a future start time.'))).toBe('Choose a future start time.');
        expect(extractApiErrorMessage(response({ code: 'VALIDATION_FAILED', timestamp: '2026-09-18', startsAt: 'Start must be in the future.', capacity: 'Capacity must be positive.' }))).toBe('Start must be in the future.');
    });
    it('does not display machine metadata when there is no human-readable explanation', () => {
        expect(extractApiErrorMessage(response({ type: 'about:blank', instance: '/api/events/1', code: 'E_CONFLICT', status: 409, path: '/api/events/1', timestamp: '2026-09-18' }), 'Please retry.')).toBe('Please retry.');
    });
    it('preserves the dedicated rate-limit and provider-link guidance', () => {
        expect(extractApiErrorMessage(response({ detail: 'Internal limiter name' }, 429))).toBe('Too many attempts. Please wait a moment and try again.');
        expect(extractApiErrorMessage(response({ code: 'provider_link_required', detail: 'Account exists' }))).toBe('Sign in using your existing method, then open Account → Linked Accounts to connect Google.');
    });
    it.each([null, undefined, {}, new Error('Network failed'), response(null), response({ detail: ' ', message: null })])('handles missing error data without throwing', error => {
        expect(extractApiErrorMessage(error, 'Unable to save.')).toBe('Unable to save.');
    });
});

describe('extractApiErrorCode', () => {
    it('preserves an application code independently of its displayed message', () => {
        expect(extractApiErrorCode(response({ code: 'FULL', detail: 'No places remain.' }))).toBe('FULL');
    });
    it.each([null, undefined, {}, response({ type: 'about:blank' }), response({ code: ' ' })])('returns null when no code exists', error => {
        expect(extractApiErrorCode(error)).toBeNull();
    });
});
