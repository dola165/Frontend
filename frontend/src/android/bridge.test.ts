import axios from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
import { decodeBody, nativeAdapter, nativeCall } from './bridge';

afterEach(() => { delete window.GrassKickZ; vi.unstubAllGlobals(); });
it('copies every binary byte intact, including empty and large media responses', () => {
    expect(decodeBody('')).toEqual(new Uint8Array());
    const binary = Array.from({ length: 262144 }, (_, i) => String.fromCharCode(i % 256)).join('');
    const result = decodeBody(btoa(binary));
    expect(result.length).toBe(binary.length);
    expect(result.every((value, index) => value === index % 256)).toBe(true);
});
function port(reply: (request: Record<string, unknown>) => Record<string, unknown>) {
    const messages: Record<string, unknown>[] = [];
    window.GrassKickZ = { onmessage: null, postMessage: message => {
        const request = JSON.parse(message); messages.push(request);
        queueMicrotask(() => window.GrassKickZ?.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ id: request.id, ...reply(request) }) })));
    } };
    return messages;
}
it('uses only the app API and preserves a server conflict', async () => {
    const messages = port(() => ({ status: 409, headers: { 'content-type': 'application/json' }, body: btoa('{"code":"STALE_VERSION"}') }));
    const client = axios.create({ baseURL: `${location.origin}/api`, adapter: nativeAdapter });
    await expect(client.patch('/clubs/17/jobs/4', { version: 1 })).rejects.toMatchObject({ response: { status: 409, data: { code: 'STALE_VERSION' } } });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ path: '/api/clubs/17/jobs/4', method: 'PATCH' });
});
it('does not pass an authorization header to JavaScript transport', async () => {
    const messages = port(() => ({ status: 200, body: btoa('[]') }));
    await axios.get(`${location.origin}/api/clubs`, { adapter: nativeAdapter, headers: { Authorization: 'Bearer must-not-forward' } });
    expect(messages[0].headers).not.toHaveProperty('authorization');
});
it('supports protected image bytes', async () => {
    port(() => ({ status: 200, headers: { 'content-type': 'image/png' }, body: btoa('image-bytes') }));
    const result = await axios.get(`${location.origin}/uploads/image.png`, { adapter: nativeAdapter, responseType: 'arraybuffer' });
    expect(new TextDecoder().decode(result.data)).toBe('image-bytes');
});
it('uses native text replies for JSON without base64 decoding and preserves Georgian text', async () => {
    const messages = port(() => ({ status: 200, bodyText: '{"name":"თბილისი ⚽"}' }));
    const decode = vi.spyOn(window, 'atob');
    const result = await axios.get(`${location.origin}/api/clubs`, { adapter: nativeAdapter });
    expect(result.data).toEqual({ name: 'თბილისი ⚽' });
    expect(messages[0]).toMatchObject({ responseEncoding: 'text' });
    expect(decode).not.toHaveBeenCalled();
    decode.mockRestore();
});
it('keeps binary callers on the lossless protocol and accepts empty text replies', async () => {
    const messages = port(() => ({ status: 200, body: btoa(String.fromCharCode(0, 255, 128, 65)) }));
    const image = await axios.get(`${location.origin}/uploads/image.png`, { adapter: nativeAdapter, responseType: 'arraybuffer' });
    expect([...new Uint8Array(image.data)]).toEqual([0, 255, 128, 65]);
    expect(messages[0]).toMatchObject({ responseEncoding: 'base64' });
    port(() => ({ status: 204, bodyText: '' }));
    const empty = await axios.delete(`${location.origin}/api/clubs/1/follow`, { adapter: nativeAdapter });
    expect(empty.data).toBe('');
});
it('preserves multipart fields and replaces a header that lacks its boundary', async () => {
    const messages = port(() => ({ status: 201, body: btoa('{"id":21}') }));
    const form = new FormData(); form.append('caption', 'Training photo');
    await axios.post(`${location.origin}/api/media/upload`, form, { adapter: nativeAdapter, headers: { 'Content-Type': 'multipart/form-data' } });
    const request = messages[0];
    const headers = request.headers as Record<string, string>;
    const boundary = headers['content-type'].split('boundary=')[1];
    const body = atob(request.body as string);
    expect(boundary).toBeTruthy();
    expect(body).toContain(`--${boundary}`);
    expect(body).toContain('name="caption"');
    expect(body).toContain('Training photo');
});
it('rejects third-party destinations before calling native', async () => {
    const messages = port(() => ({ status: 200 }));
    await expect(axios.get('https://third-party.test/api/users/me', { adapter: nativeAdapter })).rejects.toThrow('Unsupported app request');
    expect(messages).toHaveLength(0);
});
it('cancels a pending operation without retrying it', async () => {
    const send = vi.fn(); window.GrassKickZ = { postMessage: send, onmessage: null };
    const controller = new AbortController();
    const request = nativeCall({ kind: 'request', path: '/api/clubs' }, controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(JSON.parse(send.mock.calls[1][0])).toMatchObject({ kind: 'cancel' });
});
it('reports an unavailable native connection', async () => {
    await expect(nativeCall({ kind: 'session' })).rejects.toThrow('app connection is unavailable');
});
