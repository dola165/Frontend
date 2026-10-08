import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { streamDola, safeDolaDestination } from './api';
vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('../../android/bridge', () => ({ isAndroidApp: false }));
const request = { requestId: 'r', message: 'hello', includePersonalContext: false };
beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('gk-session-id', 'a'); });
describe('Dola streamed transport', () => {
    it('only opens exact challenge and public job destinations', () => {
        for (const [id, path] of [['match_challenge:71', '/match-exchange/71'], ['job:4', '/jobs/4'], ['venue_workspace:133', '/stadiums/133/manage?view=calendar']]) {
            expect(safeDolaDestination({ id, title: 'View', path })).toBe(true);
            expect(safeDolaDestination({ id, title: 'View', path: path + '?redirect=/admin' })).toBe(false);
            expect(safeDolaDestination({ id, title: 'View', path: 'https://example.test' })).toBe(false);
            expect(safeDolaDestination({ id, title: 'View', path: path + '2' })).toBe(false);
        }
    });
    it('accepts only the exact squad schedule route for the returned semantic ID', () => {
        expect(safeDolaDestination({ id: 'squad_schedule:12', title: 'U12', path: '/squads/12?tab=sessions' })).toBe(true);
        for (const path of ['/squads/13?tab=sessions', 'https://example.test', '/squads/12?tab=chat', '/squads/12?tab=sessions&redirect=/admin']) {
            expect(safeDolaDestination({ id: 'squad_schedule:12', title: 'U12', path })).toBe(false);
        }
    });
    it('decodes split UTF-8 chunks and requires a complete event', async () => {
        const answer = { conversationId: 'c', requestId: 'r', answer: 'გამარჯობა', destinations: [], sources: [], toolsUsed: [], modelCalls: 1, totalTokens: 4 };
        const bytes = new TextEncoder().encode(JSON.stringify({ type: 'delta', text: 'გამარჯობა' }) + '\n' + JSON.stringify({ type: 'complete', answer }) + '\n');
        vi.mocked(apiClient.post).mockResolvedValue({ data: new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } }) });
        const events = vi.fn();
        expect(await streamDola(request, 'a', new AbortController().signal, events)).toEqual(answer);
        expect(events).toHaveBeenCalledWith(expect.objectContaining({ type: 'delta', text: 'გამარჯობა' }));
    });
    it('does not treat a truncated stream as a completed answer', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"type":"delta","text":"Partial"}\n')); controller.close(); } }) });
        await expect(streamDola(request, 'a', new AbortController().signal, vi.fn())).rejects.toThrow(/before Dola finished/);
    });
    it('rejects late streamed content after the signed-in account changes', async () => {
        vi.mocked(apiClient.post).mockImplementation(async () => {
            localStorage.setItem('gk-session-id', 'b');
            return { data: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"type":"delta","text":"Private"}\n')); controller.close(); } }) };
        });
        const events = vi.fn(); await expect(streamDola(request, 'a', new AbortController().signal, events)).rejects.toThrow(/session changed/);
        expect(events).not.toHaveBeenCalled();
    });
});
