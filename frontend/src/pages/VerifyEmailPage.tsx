import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BadgeCheck, Loader2, MailWarning, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import { useAuth } from '../context/AuthContext';
import { authPrimaryButtonClass } from '../components/auth/authClasses';

type VerifyState = 'loading' | 'success' | 'error';

export const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { status, bootstrapSession } = useAuth();
  const token = searchParams.get('token');
  const [verifyState, setVerifyState] = useState<VerifyState>(token ? 'loading' : 'error');
  const [message, setMessage] = useState<string>(token ? t('auth.verify.verifyingMessage') : t('auth.verify.missingToken'));
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  const canResendFromHere = status === 'authenticated';

  useEffect(() => {
    if (!token) {
      return;
    }

    let isCancelled = false;

    const verifyEmail = async () => {
      try {
        const response = await apiClient.post<{ message?: string }>('/auth/verify-email', { token });
        if (isCancelled) {
          return;
        }
        setVerifyState('success');
        setMessage(response.data?.message || t('auth.verify.successFallback'));
        if (status === 'authenticated') {
          await bootstrapSession();
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }
        const code = extractApiErrorCode(error);
        if (code === 'expired_token') {
          setMessage(t('auth.verify.expired'));
        } else if (code === 'used_token') {
          setMessage(t('auth.verify.used'));
        } else {
          setMessage(extractApiErrorMessage(error, t('auth.verify.invalid')));
        }
        setVerifyState('error');
      }
    };

    void verifyEmail();

    return () => {
      isCancelled = true;
    };
  }, [bootstrapSession, status, t, token]);

  const statusBlock = useMemo(() => {
    if (verifyState === 'loading') {
      return {
        icon: <Loader2 className="h-6 w-6 animate-spin text-[#16a34a]" />,
        title: t('auth.verify.verifying'),
        copy: message,
        className: 'border-[#16a34a]/30 bg-[#16a34a]/10 text-[#16a34a]'
      };
    }

    if (verifyState === 'success') {
      return {
        icon: <BadgeCheck className="h-6 w-6 text-[#16a34a]" />,
        title: t('auth.verify.verified'),
        copy: message,
        className: 'border-[#16a34a]/30 bg-[#16a34a]/10 text-[#16a34a]'
      };
    }

    return {
      icon: <MailWarning className="h-6 w-6 text-amber-500" />,
      title: t('auth.verify.verificationIssue'),
      copy: message,
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-400'
    };
  }, [message, t, verifyState]);

  const handleResend = async () => {
    setIsSendingVerification(true);
    setResendMessage(null);
    setResendError(null);

    try {
      const response = await apiClient.post<{ message?: string }>('/auth/send-verification');
      setResendMessage(response.data?.message || t('auth.verify.resendMessageFallback'));
      await bootstrapSession();
    } catch (error) {
      setResendError(extractApiErrorMessage(error, t('auth.verify.resendErrorFallback')));
    } finally {
      setIsSendingVerification(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0f1117] p-6 text-[#f4f4f5] selection:bg-[#16a34a]/20">
      {/* layered glow backdrop — matches AuthSplitShell */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,200,83,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(0,200,83,0.07),transparent_42%)]" />

      <Link to={canResendFromHere ? '/account?tab=security' : '/login'} className="absolute left-8 top-8 z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]">
        <ArrowLeft className="h-4 w-4" /> {canResendFromHere ? t('auth.verify.backToAccount') : t('auth.verify.backToLogin')}
      </Link>

      <div className="relative mx-auto flex min-h-screen max-w-md items-center justify-center">
        <div className="theme-surface theme-border w-full rounded-xl border p-6 shadow-2xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-[#16a34a]/40 bg-[#16a34a]/10 text-[#16a34a]">
              <BadgeCheck className="h-8 w-8" />
            </div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">{t('auth.verify.title')}</h1>
            <p className="text-sm leading-6 text-[#a1a1aa]">{t('auth.verify.subtitle')}</p>
          </div>

          <div className={`rounded-lg border p-5 ${statusBlock.className}`}>
            <div className="flex items-start gap-3">
              {statusBlock.icon}
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest">{statusBlock.title}</h2>
                <p className="mt-2 text-sm font-medium">{statusBlock.copy}</p>
              </div>
            </div>
          </div>

          {canResendFromHere && verifyState === 'error' && (
            <div className="mt-6">
              {resendMessage && (
                <div className="mb-4 rounded-lg border border-[#16a34a]/30 bg-[#16a34a]/10 px-4 py-3 text-sm font-semibold text-[#16a34a]">
                  {resendMessage}
                </div>
              )}
              {resendError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{resendError}</span>
                </div>
              )}
              <button
                onClick={() => void handleResend()}
                disabled={isSendingVerification}
                className={`${authPrimaryButtonClass} rounded-xl`}
              >
                {isSendingVerification ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                {t('auth.verify.resend')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
