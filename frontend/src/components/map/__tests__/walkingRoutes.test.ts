import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const workerState = vi.hoisted(() => ({ workers: [] as Array<{ onmessage?: (event: unknown) => void; onerror?: () => void; terminate: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> }> }));
vi.mock('../walking.worker?worker&inline', () => ({ default: class {
    onmessage?: (event: unknown) => void;
    onerror?: () => void;
    terminate = vi.fn();
    postMessage = vi.fn();
    constructor() { workerState.workers.push(this); }
} }));
import { loadWalkingRoute } from '../walkingRoutes';
const data = { elements: [{ type: 'node', id: 1, lon: 44.8, lat: 41.7 }] };
const route = { coordinates: [[44.8, 41.7], [44.801, 41.7]], branches: [], distanceKm: .1, minutes: 2, startOffsetM: 0, endOffsetM: 0, steps: [] };
describe('walking route transport on Android WebView', () => {
    beforeEach(() => { workerState.workers.length = 0; vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data })); });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
    it('loads and returns a route without newer AbortSignal helper APIs', async () => {
        vi.spyOn(AbortSignal, 'any').mockImplementation(() => { throw new Error('not available'); });
        vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => { throw new Error('not available'); });
        vi.spyOn(AbortSignal.prototype, 'throwIfAborted').mockImplementation(() => { throw new Error('not available'); });
        const result = loadWalkingRoute([44.8, 41.7], [44.801, 41.7], new AbortController().signal);
        await vi.waitFor(() => expect(workerState.workers).toHaveLength(1));
        workerState.workers[0].onmessage?.({ data: { route } });
        await expect(result).resolves.toEqual(route);
        expect(workerState.workers[0].terminate).toHaveBeenCalled();
    });
    it('does not fetch or start workers for a cancelled request', async () => {
        const controller = new AbortController(); controller.abort();
        await expect(loadWalkingRoute([44.82, 41.7], [44.821, 41.7], controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(fetch).not.toHaveBeenCalled(); expect(workerState.workers).toHaveLength(0);
    });
    it('cancels an active worker when the user changes their destination', async () => {
        const controller = new AbortController();
        const result = loadWalkingRoute([44.83, 41.7], [44.831, 41.7], controller.signal);
        const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(workerState.workers).toHaveLength(1)); controller.abort();
        await rejection; expect(workerState.workers[0].terminate).toHaveBeenCalled();
    });
    it('ends a worker that never responds instead of leaving a permanent spinner', async () => {
        vi.useFakeTimers();
        const result = loadWalkingRoute([44.84, 41.7], [44.841, 41.7], new AbortController().signal);
        const rejection = expect(result).rejects.toThrow('timed out');
        await vi.waitFor(() => expect(workerState.workers).toHaveLength(1));
        await vi.advanceTimersByTimeAsync(15000);
        await rejection;
        expect(workerState.workers[0].terminate).toHaveBeenCalled();
    });
});
