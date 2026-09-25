import axios, { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';

export const isAndroidApp = import.meta.env.VITE_ANDROID_APP === 'true';
type Reply = { id: string; status?: number; body?: string; bodyText?: string; headers?: Record<string, string>; error?: string };
type NativePort = { postMessage: (message: string) => void; onmessage: ((event: MessageEvent<string>) => void) | null };
declare global { interface Window { GrassKickZ?: NativePort } }
const pending = new Map<string, { resolve: (reply: Reply) => void; reject: (error: Error) => void }>();
const documentId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let sequence = 0;

export function nativeCall(message: Record<string, unknown>, signal?: AbortSignal): Promise<Reply> {
    const port = window.GrassKickZ;
    if (!port) return Promise.reject(new Error('The app connection is unavailable. Close this screen and try again.'));
    port.onmessage = event => {
        const reply = JSON.parse(event.data) as Reply;
        const operation = pending.get(reply.id);
        if (!operation) return;
        pending.delete(reply.id);
        if (reply.error) operation.reject(new Error(reply.error)); else operation.resolve(reply);
    };
    return new Promise((resolve, reject) => {
        const id = `${documentId}:${++sequence}`;
        const abort = () => { window.clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(id); port.postMessage(JSON.stringify({ kind: 'cancel', id })); reject(new axios.CanceledError()); };
        if (signal?.aborted) { reject(new axios.CanceledError()); return; }
        signal?.addEventListener('abort', abort, { once: true });
        const timer = window.setTimeout(() => {
            pending.delete(id); signal?.removeEventListener('abort', abort);
            port.postMessage(JSON.stringify({ kind: 'cancel', id }));
            reject(new Error('The request timed out. Check whether your change was saved before trying again.'));
        }, 90_000);
        const finish = () => { window.clearTimeout(timer); signal?.removeEventListener('abort', abort); };
        pending.set(id, { resolve: reply => { finish(); resolve(reply); }, reject: error => { finish(); reject(error); } });
        port.postMessage(JSON.stringify({ ...message, id }));
    });
}

export function decodeBody(value: string): Uint8Array<ArrayBuffer> {
    // A direct copy avoids the intermediate array and per-byte callback in
    // Uint8Array.from, particularly costly for protected photos on phones.
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
}
function encodeBody(bytes: Uint8Array): string {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(binary);
}

/** The native HTTP client owns credentials and refresh. No bearer or cookie crosses this port. */
export const nativeAdapter: AxiosAdapter = async config => {
    const url = new URL(axios.getUri(config), window.location.origin);
    if (url.origin !== window.location.origin || !(url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/'))) throw new Error('Unsupported app request.');
    const headers = new Headers();
    for (const [key, value] of Object.entries(config.headers.toJSON())) {
        if (typeof value === 'string' && key.toLowerCase() !== 'authorization') headers.set(key, value);
    }
    if (config.data instanceof FormData) headers.delete('Content-Type');
    const request = new Request(url, { method: config.method?.toUpperCase() ?? 'GET', headers, body: config.data });
    const body = new Uint8Array(await request.arrayBuffer());
    // The shared media service accepts 10 MiB files. Leave room for multipart fields.
    if (body.length > 12 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.');
    const binaryResponse = config.responseType === 'blob' || config.responseType === 'arraybuffer';
    const reply = await nativeCall({ kind: 'request', path: url.pathname + url.search, method: request.method,
        headers: Object.fromEntries(request.headers), body: encodeBody(body), responseEncoding: binaryResponse ? 'base64' : 'text' }, config.signal as AbortSignal | undefined);
    // Older APKs still return base64; accept both while keeping binary responses lossless.
    const data = !binaryResponse && typeof reply.bodyText === 'string' ? reply.bodyText : (() => {
        const bytes = decodeBody(reply.body ?? '');
        return config.responseType === 'blob' ? new Blob([bytes], { type: reply.headers?.['content-type'] })
            : config.responseType === 'arraybuffer' ? bytes.buffer : new TextDecoder().decode(bytes);
    })();
    const response = { data, status: reply.status ?? 500, statusText: '', headers: AxiosHeaders.from(reply.headers), config };
    if (config.validateStatus && !config.validateStatus(response.status)) throw new AxiosError('The request could not be completed.', AxiosError.ERR_BAD_RESPONSE, config, undefined, response);
    return response;
};

export async function nativeSession(): Promise<{ active: boolean; session: string }> {
    const reply = await nativeCall({ kind: 'session' });
    return JSON.parse(new TextDecoder().decode(decodeBody(reply.body ?? '')));
}

export function installNativeFetch() {
    if (!isAndroidApp) return;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
        await nativeCall({ kind: 'share', title: data.title ?? '', text: data.text ?? '', url: data.url ?? '' });
    } });
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return original(input, init);
        const reply = await nativeCall({ kind: 'request', path: url.pathname + url.search, method: request.method,
            headers: Object.fromEntries(request.headers), body: encodeBody(new Uint8Array(await request.arrayBuffer())) }, request.signal);
        return new Response(reply.status === 204 ? null : decodeBody(reply.body ?? ''), { status: reply.status, headers: reply.headers });
    };
}
