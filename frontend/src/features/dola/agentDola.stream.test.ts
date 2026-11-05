import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { sendAgentDola } from './agentDola';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../../android/bridge', () => ({ isAndroidApp: false }));
vi.mock('./dolaGuide', () => ({ currentGuide: () => null }));
vi.mock('./pageForm', () => ({ readPageForm: () => null }));

const encoder = new TextEncoder();
/** A stream of these chunks; `breaks` fails it after them. */
const streamOf = (chunks: string[], breaks = false) => new ReadableStream<Uint8Array>({
    start(controller) {
        chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
        if (breaks) controller.error(new Error('connection lost')); else controller.close();
    },
});
const line = (event: unknown) => `${JSON.stringify(event)}\n`;
const replyEvent = (reply: string) => line({ type: 'reply', reply: { status: 'CHAT', reply, language: 'en' } });

describe('sendAgentDola with progress', () => {
    const steps: string[] = [];
    const words: string[] = [];
    const progress = { step: (text: string) => steps.push(text), words: (text: string) => words.push(text) };

    beforeEach(() => { vi.clearAllMocks(); steps.length = 0; words.length = 0; });

    it('asks for the stream through the usual client, and passes on steps and words', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: streamOf([
            line({ type: 'step', text: 'Checking your calendar…' }), line({ type: 'text', text: 'Open ' }), line({ type: 'text', text: 'it.' }), replyEvent('Open it.'),
        ]) });

        const answer = await sendAgentDola('hi', '/home', {}, progress);

        expect(steps).toEqual(['Checking your calendar…']);
        expect(words).toEqual(['Open ', 'it.']);
        expect(answer.reply).toBe('Open it.');
        const [url, , config] = vi.mocked(apiClient.post).mock.calls[0];
        expect(url).toBe('/agent-dola/messages/stream');
        expect(config).toMatchObject({ adapter: 'fetch', responseType: 'stream' });
    });

    it('reads a line split across chunks, including a letter split across two', async () => {
        const whole = encoder.encode(line({ type: 'text', text: 'კარგი' }) + replyEvent('კარგი'));
        vi.mocked(apiClient.post).mockResolvedValue({ data: new ReadableStream<Uint8Array>({
            start(controller) { controller.enqueue(whole.slice(0, 25)); controller.enqueue(whole.slice(25)); controller.close(); },
        }) });

        const answer = await sendAgentDola('hi', '/home', {}, progress);

        expect(words).toEqual(['კარგი']);
        expect(answer.reply).toBe('კარგი');
    });

    it('sends the plain request when the stream cannot start', async () => {
        vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 404 } })
            .mockResolvedValueOnce({ data: { status: 'INFO', reply: 'Plain.' } });

        const answer = await sendAgentDola('hi', '/home', {}, progress);

        expect(answer.reply).toBe('Plain.');
        expect(vi.mocked(apiClient.post).mock.calls[1][0]).toBe('/agent-dola/messages');
    });

    it('does not send the message twice when a stream breaks part way: the chat holds the answer', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: streamOf([line({ type: 'text', text: 'Half' })], true) });
        vi.mocked(apiClient.get).mockResolvedValue({ data: [
            { at: '2026-11-04T10:00:00Z', message: 'older', answer: { status: 'CHAT', reply: 'Old.' } },
            { at: '2026-11-04T10:01:00Z', message: 'hi', answer: { status: 'CHAT', reply: 'The whole answer.' } },
        ] });

        const answer = await sendAgentDola('hi', '/home', {}, progress);

        expect(answer.reply).toBe('The whole answer.');
        expect(apiClient.post).toHaveBeenCalledTimes(1);
    });

    it('fails when the server says the message failed, and when the chat has no answer either', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: streamOf([line({ type: 'step', text: 'Working…' }), line({ type: 'error' })]) });
        await expect(sendAgentDola('hi', '/home', {}, progress)).rejects.toThrow();
        expect(apiClient.get).not.toHaveBeenCalled();

        vi.mocked(apiClient.post).mockResolvedValue({ data: streamOf([line({ type: 'text', text: 'Half' })]) });
        vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
        await expect(sendAgentDola('hi', '/home', {}, progress)).rejects.toThrow('The connection ended');
    });

    it('sends the plain request when no one is watching', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'INFO', reply: 'Plain.' } });

        await sendAgentDola('hi', '/home');

        expect(vi.mocked(apiClient.post).mock.calls[0][0]).toBe('/agent-dola/messages');
    });
});
