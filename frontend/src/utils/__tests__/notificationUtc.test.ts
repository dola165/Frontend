import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { formatNotificationTime } from '../notifications';

// Sanitized actual PostgreSQL wire samples from NotificationTimestampIntegrationTest:
// JVM Asia/Tbilisi, transaction-local database Pacific/Auckland. No actor/private data.
const samples = [
    { writer: 'ANNOUNCEMENT', wire: '2026-10-17T22:46:51.077519', databaseAfterUtc: '2026-10-17T22:46:51.080272', epochMillis: 1792277211077 },
    { writer: 'DEVELOPMENT_SEED', wire: '2026-10-17T22:46:51.213559', databaseAfterUtc: '2026-10-17T22:46:51.215499', epochMillis: 1792277211213 },
    { writer: 'DIRECT', wire: '2026-10-17T22:46:50.988140', databaseAfterUtc: '2026-10-17T22:46:50.991346', epochMillis: 1792277210988 },
    { writer: 'FOLLOWER', wire: '2026-10-17T22:46:51.144181', databaseAfterUtc: '2026-10-17T22:46:51.146820', epochMillis: 1792277211144 },
];

beforeEach(async () => {
    vi.stubEnv('TZ', 'Asia/Tbilisi');
    await i18n.changeLanguage('en');
    vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it.each(samples)('$writer persisted UTC notice reads as current in a non-UTC browser timezone', sample => {
    vi.setSystemTime(new Date(`${sample.databaseAfterUtc}Z`));
    expect(new Date().getTimezoneOffset()).toBe(-240);
    expect(Date.parse(`${sample.wire}Z`)).toBe(sample.epochMillis);
    expect(formatNotificationTime(sample.wire)).toBe('this minute');
    expect(formatNotificationTime(sample.wire)).toBe(formatNotificationTime(`${sample.wire}Z`));
    const tbilisi = new Date(sample.epochMillis + 4 * 60 * 60 * 1000).toISOString().replace('Z', '+04:00');
    expect(formatNotificationTime(sample.wire)).toBe(formatNotificationTime(tbilisi));
});
