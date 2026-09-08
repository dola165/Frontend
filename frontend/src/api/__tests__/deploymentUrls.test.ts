import { describe, expect, it } from 'vitest';
import {
    buildServiceUrl,
    buildWebSocketUrlFromBase,
    resolveDeploymentUrls,
} from '../deploymentUrls';
import { resolveMediaUrlFromBase } from '../../utils/resolveMediaUrl';

describe('deployment URL configuration', () => {
    it.each([
        [undefined, 'https://grasskickz.com', 'https://grasskickz.com/api', 'https://grasskickz.com/', 'wss://grasskickz.com/ws-chat'],
        ['', 'http://localhost:5173', 'http://localhost:5173/api', 'http://localhost:5173/', 'ws://localhost:5173/ws-chat'],
        ['/api/', 'https://grasskickz.com', 'https://grasskickz.com/api', 'https://grasskickz.com/', 'wss://grasskickz.com/ws-chat'],
        ['api', 'https://grasskickz.com', 'https://grasskickz.com/api', 'https://grasskickz.com/', 'wss://grasskickz.com/ws-chat'],
        ['https://api.grasskickz.com/api', 'https://grasskickz.com', 'https://api.grasskickz.com/api', 'https://api.grasskickz.com/', 'wss://api.grasskickz.com/ws-chat'],
        ['http://localhost:8080/api/', 'http://localhost:5173', 'http://localhost:8080/api', 'http://localhost:8080/', 'ws://localhost:8080/ws-chat'],
        ['/gateway/api/', 'https://grasskickz.com', 'https://grasskickz.com/gateway/api', 'https://grasskickz.com/gateway/', 'wss://grasskickz.com/gateway/ws-chat'],
        ['https://api.example.test/gateway/api/', 'https://app.example.test', 'https://api.example.test/gateway/api', 'https://api.example.test/gateway/', 'wss://api.example.test/gateway/ws-chat'],
    ])('resolves API base %s against %s', (configured, origin, apiBase, serviceBase, socket) => {
        const resolved = resolveDeploymentUrls(configured, origin);
        expect(resolved.apiBaseUrl).toBe(apiBase);
        expect(resolved.serviceBaseUrl).toBe(serviceBase);
        expect(buildWebSocketUrlFromBase(resolved.serviceBaseUrl, '/ws-chat')).toBe(socket);
    });

    it('normalizes slash variations without losing a reverse-proxy prefix', () => {
        expect(buildServiceUrl('https://example.test/gateway/', '/uploads/player.jpg').toString())
            .toBe('https://example.test/gateway/uploads/player.jpg');
        expect(buildServiceUrl('https://example.test/gateway/', 'uploads/player.jpg').toString())
            .toBe('https://example.test/gateway/uploads/player.jpg');
    });

    it.each(['ftp://example.test/api', 'data:text/plain,api'])('rejects a non-HTTP API base: %s', (configured) => {
        expect(() => resolveDeploymentUrls(configured, 'https://grasskickz.com')).toThrow(/must use http or https/);
    });
});

describe('media URL resolution', () => {
    const base = 'https://api.example.test/gateway/';

    it.each([
        ['/uploads/player.jpg', 'https://api.example.test/gateway/uploads/player.jpg'],
        ['uploads/player.jpg', 'https://api.example.test/gateway/uploads/player.jpg'],
        [' https://cdn.example.test/p.jpg ', 'https://cdn.example.test/p.jpg'],
        ['data:image/png;base64,abc', 'data:image/png;base64,abc'],
        ['blob:https://app.example.test/id', 'blob:https://app.example.test/id'],
    ])('resolves %s', (value, expected) => {
        expect(resolveMediaUrlFromBase(value, base)).toBe(expected);
    });

    it.each([undefined, null, '', 'null', 'undefined', 'javascript:alert(1)', 'ftp://example.test/file'])(
        'does not render unusable media value %s', (value) => {
        expect(resolveMediaUrlFromBase(value, base)).toBeUndefined();
        },
    );
});
