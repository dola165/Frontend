import { http, HttpHandler, HttpResponse } from 'msw';
import { users, currentUserId } from '../data/store';
import { createUser } from '../data/factories';
import { simulateLatency } from '../utils';
import { isUnder13 } from '../../utils/age';

const API = '*/api';

const makeToken = (userId: number, role: string) => {
  const payload = { sub: userId, role, iat: Date.now() };
  return `mock-jwt.${btoa(JSON.stringify(payload))}.mock-sig`;
};

export const authHandlers: HttpHandler[] = [

  // -- CSRF (returns 200 with JSON body matching real CsrfToken) --
  http.get(`${API}/auth/csrf`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      headerName: 'X-XSRF-TOKEN',
      parameterName: '_csrf',
      token: `mock-xsrf-${Date.now()}`,
    });
  }),

  // -- login --
  http.post(`${API}/auth/login`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();

    for (const u of users().values()) {
      if (u.email === email && u.password === body.password) {
        currentUserId(u.id);
        return HttpResponse.json({
          accessToken: makeToken(u.id, u.role ?? 'PLAYER'),
          mustChangePassword: false,
        });
      }
    }

    return HttpResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }),

  // -- register (returns 201 with message only — NO accessToken) --
  http.post(`${API}/auth/register`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as { email?: string; password?: string; username?: string; fullName?: string; role?: string; dateOfBirth?: string };

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return HttpResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    if (!body.dateOfBirth) {
      return HttpResponse.json({ error: 'Date of birth is required.' }, { status: 400 });
    }
    if (isUnder13(body.dateOfBirth)) {
      return HttpResponse.json({ error: 'You must be at least 13 years old to register.' }, { status: 400 });
    }

    for (const u of users().values()) {
      if (u.email === email) {
        return HttpResponse.json({ error: 'Email already registered.' }, { status: 409 });
      }
    }

    const newUser = createUser({
      email,
      password: body.password ?? 'mock',
      username: body.username,
      fullName: body.fullName,
      role: (body.role as 'PLAYER' | 'FAN' | 'ORGANIZER' | 'COACH' | 'ADMIN') ?? 'PLAYER',
      dob: body.dateOfBirth,
      profileComplete: false,
    });
    users().set(newUser.id, newUser);

    return HttpResponse.json({ message: 'User registered successfully' }, { status: 201 });
  }),

  // -- refresh --
  http.post(`${API}/auth/refresh`, async () => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) {
      return HttpResponse.json({ error: 'Refresh token flow failed.' }, { status: 401 });
    }

    const user = users().get(uid);
    if (!user) {
      currentUserId(null);
      return HttpResponse.json({ error: 'Refresh token flow failed.' }, { status: 401 });
    }

    return HttpResponse.json({ accessToken: makeToken(user.id, user.role ?? 'PLAYER') });
  }),

  // -- logout --
  http.post(`${API}/auth/logout`, async () => {
    await simulateLatency();
    currentUserId(null);
    return HttpResponse.json({ message: 'Logged out successfully' });
  }),

  // -- google OAuth (reads `token` + optional `role` from body) --
  http.post(`${API}/auth/google`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as { token?: string; role?: string };
    const email = body.token ? `google-${body.token.substring(0, 8)}@test.dev` : 'google@test.dev';

    let user = [...users().values()].find((u) => u.email === email);
    if (!user) {
      user = createUser({ email, password: '', username: email.split('@')[0], role: body.role ?? 'PLAYER' });
      users().set(user.id, user);
    }

    currentUserId(user.id);
    return HttpResponse.json({ accessToken: makeToken(user.id, user.role ?? 'PLAYER') });
  }),

  // -- forgot password --
  http.post(`${API}/auth/forgot-password`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  }),

  // -- reset password --
  http.post(`${API}/auth/reset-password`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Password updated successfully.' });
  }),

  // -- send verification --
  http.post(`${API}/auth/send-verification`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Verification email sent.', emailVerified: false });
  }),

  // -- verify email --
  http.post(`${API}/auth/verify-email`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Email verified successfully.' });
  }),

  // -- change password --
  http.post(`${API}/auth/change-password`, async () => {
    await simulateLatency();
    return HttpResponse.json({ message: 'Password changed successfully.' });
  }),

  // -- sessions (returns AccountSessionSummaryDto — an object, not array) --
  http.get(`${API}/auth/sessions`, async () => {
    await simulateLatency();
    const uid = currentUserId();
    if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json({
      sessions: [{
        id: 1,
        device: 'Mock Browser',
        ip: '127.0.0.1',
        current: true,
        createdAt: new Date().toISOString(),
      }],
      total: 1,
    });
  }),

  // -- revoke other sessions --
  http.post(`${API}/auth/sessions/revoke-others`, async () => {
    await simulateLatency();
    return HttpResponse.json({ revokedCount: 0 });
  }),

  // ── QR Code Login ─────────────────────────────────────────────────────

  // QR initiate
  http.post(`${API}/auth/qr/initiate`, async () => {
    await simulateLatency();
    return HttpResponse.json({
      sessionCode: 'mock-qr-session-abc123def456',
      pollToken: 'mock-poll-token-xyz789',
      expiresIn: 120,
    });
  }),

  // QR status (auto-confirms after ~5 polls for demo)
  http.get(`${API}/auth/qr/status/:code`, async () => {
    await simulateLatency();
    const prev = (typeof globalThis !== 'undefined' && (globalThis as any).__qrPollCount) || 0;
    const count = prev + 1;
    if (typeof globalThis !== 'undefined') (globalThis as any).__qrPollCount = count;

    if (count >= 5) {
      if (typeof globalThis !== 'undefined') (globalThis as any).__qrPollCount = 0;
      const token = makeToken(currentUserId() ?? 1, 'PLAYER');
      return HttpResponse.json({ status: 'CONFIRMED', accessToken: token, expiresIn: 900 });
    }
    return HttpResponse.json({ status: 'PENDING', expiresIn: 120 - count * 2 });
  }),

  // QR confirm (phone)
  http.post('/api/qr/confirm', async () => {
    await simulateLatency();
    return HttpResponse.json({ confirmed: true });
  }),
];
