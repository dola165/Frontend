import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ initiate: vi.fn(), poll: vi.fn(), login: vi.fn() }));
vi.mock('../../api/auth', () => ({ initiateQrSession: api.initiate, pollQrStatus: api.poll }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ loginWithAccessToken: api.login }) }));
vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div> }));
import { QrLoginSection } from './QrLoginSection';

beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const session = (sessionCode = 'first', expiresIn = 120) => ({ sessionCode, pollToken: 'poll-test-only', expiresIn });
const mount = async () => { const view = render(<QrLoginSection onBack={() => {}} />); await act(async () => {}); return view; };

it('actually generates a fresh QR session after expiration', async () => {
    api.initiate.mockResolvedValueOnce(session('first', 1)).mockResolvedValueOnce(session('second'));
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    fireEvent.click(screen.getByRole('button', { name: 'Generate new code' }));
    await act(async () => {});
    expect(api.initiate).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('qr-code')).toHaveTextContent('grasskickz://login/second');
});

it('retries an initialization failure', async () => {
    api.initiate.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(session('retry'));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => {});
    expect(screen.getByTestId('qr-code')).toHaveTextContent('grasskickz://login/retry');
});

it('keeps slow polling sequential', async () => {
    api.initiate.mockResolvedValue(session());
    let resolve!: (value: { status: string }) => void;
    api.poll.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ status: 'PENDING' });
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(11000); });
    expect(api.poll).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ status: 'PENDING' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(api.poll).toHaveBeenCalledTimes(2);
});

it('ignores a successful poll after the QR screen was closed', async () => {
    api.initiate.mockResolvedValue(session());
    let resolve!: (value: { status: string; accessToken: string }) => void;
    api.poll.mockImplementation(() => new Promise(done => { resolve = done; }));
    const view = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    view.unmount();
    await act(async () => { resolve({ status: 'CONFIRMED', accessToken: 'test-only' }); });
    expect(api.login).not.toHaveBeenCalled();
});
