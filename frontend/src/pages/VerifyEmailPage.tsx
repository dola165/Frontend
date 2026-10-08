import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Loader2, Mail, MailWarning, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import { useAuth } from '../context/AuthContext';
import { authInputClass, authLabelClass, authPrimaryButtonClass } from '../components/auth/authClasses';
import {
  buildLoginPath,
  getAuthFlow,
  publicContinuationPath,
  rememberAuthDestination,
  rememberAuthFlow,
  resolvePostAuthRedirect,
} from '../utils/authRedirect';

type VerifyState = 'pending' | 'loading' | 'success' | 'error' | 'invitation';
type VerificationResponse = { message?: string; email?: string; passwordSetupRequired?: boolean };

// React StrictMode intentionally remounts effects in development. Keeping the
// in-flight request at module scope makes one verification token one request.
const verificationRequests = new Map<string, Promise<VerificationResponse>>();

const verifyOnce = (token: string, accept = false) => {
  const key = `${accept ? 'accept' : 'verify'}:${token}`;
  const existing = verificationRequests.get(key);
  if (existing) return existing;
  const request = apiClient.post<VerificationResponse>(accept ? '/auth/accept-account-invitation' : '/auth/verify-email', { token })
    .then((response) => response.data)
    .catch((error) => {
      verificationRequests.delete(key);
      throw error;
    });
  verificationRequests.set(key, request);
  if (verificationRequests.size > 20) verificationRequests.delete(verificationRequests.keys().next().value!);
  return request;
};

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  return <VerificationForm key={searchParams.get('token') ?? 'pending'} />;
};

const VerificationForm = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { status, bootstrapSession } = useAuth();
  const token = searchParams.get('token');
  const pending = searchParams.get('pending') === '1';
  const requestedDestination = resolvePostAuthRedirect(searchParams.get('next'), '');
  const initialFlow = getAuthFlow();
  const originalEmail = useRef(initialFlow.email ?? '');
  const [verifyState, setVerifyState] = useState<VerifyState>(token ? 'loading' : pending || initialFlow.awaitingVerification ? 'pending' : 'error');
  const [message, setMessage] = useState(token ? t('auth.verify.verifyingMessage') : pending || initialFlow.awaitingVerification
    ? t('auth.verify.pendingMessage')
    : t('auth.verify.missingToken'));
  const [email, setEmail] = useState(initialFlow.email ?? '');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const resendRequest = useRef<AbortController | null>(null);
  const [acceptInvitation, setAcceptInvitation] = useState(false);
  const [attempt, setAttempt] = useState(0), [retryable, setRetryable] = useState(false);
  useEffect(() => () => resendRequest.current?.abort(), []);

  useEffect(() => {
    rememberAuthDestination(searchParams.get('next'));
  }, [searchParams]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setVerifyState('loading'); setMessage(t('auth.verify.verifyingMessage')); setRetryable(false);

    const reviewOrVerify = async () => {
      if (!acceptInvitation) {
        const context = (await apiClient.post<{ accountInvitation: boolean; accountName?: string }>('/auth/verification-context', { token })).data;
        if (context.accountInvitation) {
          if (active) { setVerifyState('invitation'); setMessage(`You were invited to the existing player profile for ${context.accountName ?? 'you'}. Accept only if this is your identity. Club participation and guardian access remain separate.`); }
          return null;
        }
      }
      return verifyOnce(token, acceptInvitation);
    };
    void reviewOrVerify()
      .then(async (data) => {
        if (!active || !data) return;
        const verifiedEmail = data.email ?? originalEmail.current;
        if (verifiedEmail) setEmail(verifiedEmail);
        rememberAuthFlow({
          email: verifiedEmail || undefined,
          nextPath: requestedDestination,
          newAccount: true,
          awaitingVerification: false,
        });
        setVerifyState('success');
        setMessage(data.passwordSetupRequired ? 'Email verified. Check this mailbox for the password setup link, then sign in with your own password.' : data.message || t('auth.verify.successFallback'));
        if (status === 'authenticated') await bootstrapSession().catch(() => undefined);
      })
      .catch((error) => {
        if (!active) return;
        const code = extractApiErrorCode(error);
        const responseStatus = (error as { response?: { status?: number } }).response?.status;
        setRetryable(responseStatus == null || responseStatus >= 500);
        setMessage(code === 'expired_token'
          ? t('auth.verify.expired')
          : code === 'used_token'
            ? t('auth.verify.used')
            : extractApiErrorMessage(error, t('auth.verify.invalid')));
        setVerifyState('error');
      });

    return () => { active = false; };
  }, [acceptInvitation, attempt, bootstrapSession, requestedDestination, status, t, token]);

  const statusBlock = useMemo(() => {
    if (verifyState === 'loading') return {
      icon: <Loader2 className="h-6 w-6 animate-spin" />,
      title: t('auth.verify.verifying'),
      className: 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    };
    if (verifyState === 'success') return {
      icon: <BadgeCheck className="h-6 w-6" />,
      title: t('auth.verify.verified'),
      className: 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    };
    if (verifyState === 'invitation') return { icon: <Mail className="h-6 w-6" />, title: 'Review account invitation', className: 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]' };
    if (verifyState === 'pending') return {
      icon: <Mail className="h-6 w-6" />,
      title: t('auth.verify.checkInbox'),
      className: 'border-[color:var(--color-info)]/30 bg-[color:var(--color-info)]/10 text-[color:var(--color-info)]',
    };
    return {
      icon: <MailWarning className="h-6 w-6" />,
      title: t('auth.verify.verificationIssue'),
      className: 'border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]',
    };
  }, [t, verifyState]);

  const handleResend = async () => {
    if (resendRequest.current) return;
    if (!email.trim()) {
      setResendError(t('auth.verify.emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
      setResendError(t('auth.register.errEmailInvalid'));
      return;
    }
    const controller = new AbortController(); resendRequest.current = controller;
    const normalizedEmail = email.trim().toLowerCase();
    setIsSendingVerification(true);
    setResendMessage(null);
    setResendError(null);
    try {
      const response = await apiClient.post<{ message?: string }>('/auth/resend-verification', {
        email: normalizedEmail,
        continuationPath: publicContinuationPath(requestedDestination),
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      rememberAuthFlow({ email: normalizedEmail, awaitingVerification: true });
      setResendMessage(response.data.message || t('auth.verify.resendMessageFallback'));
    } catch (error) {
      if (!controller.signal.aborted) setResendError(extractApiErrorMessage(error, t('auth.verify.resendErrorFallback')));
    } finally {
      if (resendRequest.current === controller) resendRequest.current = null;
      if (!controller.signal.aborted) setIsSendingVerification(false);
    }
  };

  const canContinue = verifyState !== 'loading';

  return (
    <div className="relative min-h-screen bg-[var(--color-surface)] p-6 text-[var(--color-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,_var(--color-accent)_12%,_transparent),transparent_36%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,_var(--color-accent)_7%,_transparent),transparent_42%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <div className="theme-surface theme-border w-full rounded-xl border p-6 shadow-2xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <BadgeCheck className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t('auth.verify.title')}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--color-secondary)]">{t('auth.verify.subtitle')}</p>
          </div>

          <div role={verifyState === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-5 ${statusBlock.className}`}>
            <div className="flex items-start gap-3">
              {statusBlock.icon}
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest">{statusBlock.title}</h2>
                <p className="mt-2 text-sm font-medium leading-6">{message}</p>
              </div>
            </div>
          </div>
          {verifyState === 'invitation' && <button type="button" className={`${authPrimaryButtonClass} mt-6`} onClick={() => setAcceptInvitation(true)}>Accept my account invitation</button>}
          {verifyState === 'error' && retryable && <button type="button" className={`${authPrimaryButtonClass} mt-6`} onClick={() => setAttempt(value => value + 1)}>Retry verification</button>}

          {verifyState === 'pending' && <p className="mt-4 text-sm leading-6 text-[var(--color-secondary)]">Check spam and confirm the address below. If you left signup before finishing, <Link className="underline text-[var(--color-text)]" to="/signup">complete registration</Link> first.</p>}

          {canContinue && (
            <Link to={buildLoginPath(requestedDestination)} className={`${authPrimaryButtonClass} mt-6 rounded-xl`}>
              {verifyState === 'success' ? t('auth.verify.continueLogin') : t('auth.verify.alreadyVerified')}
            </Link>
          )}

          {verifyState !== 'loading' && verifyState !== 'success' && (
            <div className="mt-6 space-y-4 border-t border-[color:var(--color-border)]/10 pt-6">
              <div className="space-y-2">
                <label htmlFor="verification-email" className={authLabelClass}>{t('auth.verify.emailLabel')}</label>
                <input
                  id="verification-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  disabled={isSendingVerification}
                  className={authInputClass}
                  placeholder="you@example.com"
                />
              </div>
              {resendMessage && <p role="status" className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--color-accent)]">{resendMessage}</p>}
              {resendError && <p role="alert" className="flex items-start gap-2 rounded-lg border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--color-danger)]"><ShieldAlert className="mt-0.5 h-4 w-4" />{resendError}</p>}
              <button type="button" onClick={() => void handleResend()} disabled={isSendingVerification} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)]/15 px-4 py-3 text-xs font-semibold text-[var(--color-text)] disabled:opacity-60">
                {isSendingVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t('auth.verify.resend')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
