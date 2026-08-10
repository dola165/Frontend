import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { initiateQrSession, pollQrStatus } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

type QrState =
  | { kind: 'initiating' }
  | { kind: 'active'; sessionCode: string; pollToken: string; expiresAt: number }
  | { kind: 'confirming' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

interface Props {
  onBack: () => void;
}

export const QrLoginSection = ({ onBack }: Props) => {
  const { loginWithAccessToken } = useAuth();
  const [state, setState] = useState<QrState>({ kind: 'initiating' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatingRef = useRef(false);

  // Initiate QR session
  useEffect(() => {
    let cancelled = false;
    initiateQrSession()
      .then((res) => {
        if (cancelled) return;
        setState({
          kind: 'active',
          sessionCode: res.sessionCode,
          pollToken: res.pollToken,
          expiresAt: Date.now() + res.expiresIn * 1000,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ kind: 'error', message: err?.message ?? 'Failed to generate QR code.' });
      });
    return () => { cancelled = true; };
  }, []);

  // Poll loop
  useEffect(() => {
    if (state.kind !== 'active') return;
    let failures = 0;

    pollRef.current = setInterval(async () => {
      const s = state as Extract<QrState, { kind: 'active' }>;
      try {
        const result = await pollQrStatus(s.sessionCode, s.pollToken);
        if (result.status === 'CONFIRMED' && result.accessToken && !navigatingRef.current) {
          navigatingRef.current = true;
          setState({ kind: 'confirming' });
          await loginWithAccessToken(result.accessToken);
          // AuthContext handles navigation via bootstrapSession
        }
      } catch {
        failures++;
        if (failures >= 5) {
          clearInterval(pollRef.current!);
          setState({ kind: 'error', message: 'Connection lost. Please try again.' });
        }
      }
    }, 2500);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state.kind === 'active' ? (state as any).sessionCode : null]);

  // Countdown
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (state.kind !== 'active') return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(((state as any).expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setState({ kind: 'expired' });
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.kind === 'active' ? (state as any).expiresAt : null]);

  const handleRetry = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    navigatingRef.current = false;
    setState({ kind: 'initiating' });
  };

  // ── Render ──

  if (state.kind === 'initiating' || state.kind === 'confirming') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--fc-accent)]" />
        <p className="text-sm text-[var(--fc-text-secondary)]">
          {state.kind === 'initiating' ? 'Generating QR code…' : 'Confirming sign-in…'}
        </p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-sm text-[var(--fc-state-danger)]">{state.message}</p>
        <button onClick={handleRetry} className="flex items-center gap-2 rounded-xl border border-[var(--fc-border)] px-4 py-2 text-xs font-semibold text-[var(--fc-text-primary)] hover:bg-[var(--fc-surface-hover)] transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
        <button onClick={onBack} className="text-xs text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">Back to email login</button>
      </div>
    );
  }

  if (state.kind === 'expired') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-sm text-[var(--fc-text-secondary)]">QR code expired.</p>
        <button onClick={handleRetry} className="flex items-center gap-2 rounded-xl border border-[var(--fc-accent)] bg-[var(--fc-accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--fc-accent)] hover:bg-[var(--fc-accent-soft)] transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Generate new code
        </button>
      </div>
    );
  }

  // active
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="rounded-xl bg-white p-3" style={{ width: 220, height: 220 }}>
        <QRCodeSVG
          value={`grasskickz://login/${state.sessionCode}`}
          size={196}
          bgColor="#ffffff"
          fgColor="#0f1117"
          level="M"
        />
      </div>
      <p className="text-xs text-[var(--fc-text-muted)]">
        Scan with the GrassKickZ app to sign in
      </p>
      <p className="text-xs text-[var(--fc-text-muted)]">
        Code expires in {mins}:{String(secs).padStart(2, '0')}
      </p>
      <div className="flex items-center gap-2 text-xs text-[var(--fc-text-secondary)]">
        <ShieldCheck className="h-3.5 w-3.5 text-[var(--fc-accent)]" />
        End-to-end encrypted
      </div>
      <button onClick={onBack} className="mt-2 text-xs text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)] transition-colors">
        Back to email login
      </button>
    </div>
  );
};
