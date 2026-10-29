import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn(async () => ({ data: {} }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { post, put: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const { talk } = await import('./api');
const keyOf = (call: number) => (post.mock.calls[call] as unknown[])[2] as { headers: Record<string, string> };

describe('Project commands', () => {
    beforeEach(() => post.mockClear());
    it('send the same Idempotency-Key when the same words go twice, and a new one for new words', async () => {
        await talk(1, 2, 'Ordered');
        await talk(1, 2, 'Ordered');
        await talk(1, 2, 'Paid');
        expect(keyOf(0).headers['Idempotency-Key']).toBe(keyOf(1).headers['Idempotency-Key']);
        expect(keyOf(2).headers['Idempotency-Key']).not.toBe(keyOf(0).headers['Idempotency-Key']);
    });
});
