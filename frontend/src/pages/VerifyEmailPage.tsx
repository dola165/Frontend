import { useEffect, useMemo, useState } from 'react';
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

type VerifyState = 'pending' | 'loading' | 'success' | 'error';
type VerificationResponse = { message?: string; email?: string };

// React StrictMode intentionally remounts effects in development. Keeping the
// in-flight request at module scope makes one verification token one request.
const verificationRequests = new Map<string, Promise<VerificationResponse>>();

const verifyOnce = (token: string) => {
  const existing = verificationRequests.get(token);
  if (existing) return existing;
  const request = apiClient.post<VerificationResponse>('/auth/verify-email', { token })
    .then((response) => response.data)
    .catch((error) => {
      verificationRequests.delete(token);
      throw error;
    });
  verificationRequests.set(token, request);
  return request;
};

export const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { status, bootstrapSession } = useAuth();
  const token = searchParams.get('token');
  const pending = searchParams.get('pending') === '1';
  const requestedDestination = resolvePostAuthRedirect(searchParams.get('next'), '/home');
  const initialFlow = getAuthFlow();
  const [verifyState, setVerifyState] = useState<VerifyState>(token ? 'loading' : pending || initialFlow.awaitingVerification ? 'pending' : 'error');
  const [message, setMessage] = useState(token ? t('auth.verify.verifyingMessage') : pending || initialFlow.awaitingVerification
    ? t('auth.verify.pendingMessage')
    : t('auth.verify.missingToken'));
  const [email, setEmail] = useState(initialFlow.email ?? '');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  useEffect(() => {
    rememberAuthDestination(searchParams.get('next'));
  }, [searchParams]);

  useEffect(() => {
    if (!token) return;
    let active = true;

    void verifyOnce(token)
      .then(async (data) => {
        if (!active) return;
        const verifiedEmail = data.email ?? email;
        if (verifiedEmail) setEmail(verifiedEmail);
        rememberAuthFlow({
          email: verifiedEmail || undefined,
          nextPath: requestedDestination,
          newAccount: true,
          awaitingVerification: false,
        });
        setVerifyState('success');
        setMessage(data.message || t('auth.verify.successFallback'));
        if (status === 'authenticated') await bootstrapSession();
      })
      .catch((error) => {
        if (!active) return;
        const code = extractApiErrorCode(error);
        setMessage(code === 'expired_token'
          ? t('auth.verify.expired')
          : code === 'used_token'
            ? t('auth.verify.used')
            : extractApiErrorMessage(error, t('auth.verify.invalid')));
        setVerifyState('error');
      });

    return () => { active = false; };
  }, [bootstrapSession, email, requestedDestination, status, t, token]);

  const statusBlock = useMemo(() => {
    if (verifyState === 'loading') return {
      icon: <Loader2 className="h-6 w-6 animate-spin" />,
      title: t('auth.verify.verifying'),
      className: 'border-[#16a34a]/30 bg-[#16a34a]/10 text-[#16a34a]',
    };
    if (verifyState === 'success') return {
      icon: <BadgeCheck className="h-6 w-6" />,
      title: t('auth.verify.verified'),
      className: 'border-[#16a34a]/30 bg-[#16a34a]/10 text-[#16a34a]',
    };
    if (verifyState === 'pending') return {
      icon: <Mail className="h-6 w-6" />,
      title: t('auth.verify.checkInbox'),
      className: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    };
    return {
      icon: <MailWarning className="h-6 w-6" />,
      title: t('auth.verify.verificationIssue'),
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    };
  }, [t, verifyState]);

  const handleResend = async () => {
    if (!email.trim()) {
      setResendError(t('auth.verify.emailRequired'));
      return;
    }
    setIsSendingVerification(true);
    setResendMessage(null);
    setResendError(null);
    try {
      const response = await apiClient.post<{ message?: string }>('/auth/resend-verification', {
        email: email.trim().toLowerCase(),
        continuationPath: publicContinuationPath(requestedDestination),
      });
      rememberAuthFlow({ email: email.trim().toLowerCase(), awaitingVerification: true });
      setResendMessage(response.data.message || t('auth.verify.resendMessageFallback'));
    } catch (error) {
      setResendError(extractApiErrorMessage(error, t('auth.verify.resendErrorFallback')));
    } finally {
      setIsSendingVerification(false);
    }
  };

  const canContinue = verifyState === 'success' || verifyState === 'pending';

  return (
    <div className="relative min-h-screen bg-[#0f1117] p-6 text-[#f4f4f5]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,200,83,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(0,200,83,0.07),transparent_42%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <div className="theme-surface theme-border w-full rounded-xl border p-6 shadow-2xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-[#16a34a]/40 bg-[#16a34a]/10 text-[#16a34a]">
              <BadgeCheck className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t('auth.verify.title')}</h1>
            <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">{t('auth.verify.subtitle')}</p>
          </div>

          <div className={`rounded-lg border p-5 ${statusBlock.className}`}>
            <div className="flex items-start gap-3">
              {statusBlock.icon}
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest">{statusBlock.title}</h2>
                <p className="mt-2 text-sm font-medium leading-6">{message}</p>
              </div>
            </div>
          </div>

          {canContinue && (
            <Link to={buildLoginPath(requestedDestination)} className={`${authPrimaryButtonClass} mt-6 rounded-xl`}>
              {verifyState === 'success' ? t('auth.verify.continueLogin') : t('auth.verify.alreadyVerified')}
            </Link>
          )}

          {verifyState !== 'loading' && verifyState !== 'success' && (
            <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
              <div className="space-y-2">
                <label htmlFor="verification-email" className={authLabelClass}>{t('auth.verify.emailLabel')}</label>
                <input
                  id="verification-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className={authInputClass}
                  placeholder="you@example.com"
                />
              </div>
              {resendMessage && <p className="rounded-lg border border-[#16a34a]/30 bg-[#16a34a]/10 px-4 py-3 text-sm font-semibold text-[#16a34a]">{resendMessage}</p>}
              {resendError && <p className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300"><ShieldAlert className="mt-0.5 h-4 w-4" />{resendError}</p>}
              <button type="button" onClick={() => void handleResend()} disabled={isSendingVerification} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-semibold text-[#f4f4f5] disabled:opacity-60">
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
