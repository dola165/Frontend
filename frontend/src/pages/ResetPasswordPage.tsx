import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import { authInputClass, authLabelClass, authPrimaryButtonClass } from '../components/auth/authClasses';

export const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tokenError = useMemo(() => {
    if (!token?.trim()) {
      return t('auth.reset.missingToken');
    }
    return null;
  }, [token, t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token) {
      setErrorMessage(t('auth.reset.unusableToken'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t('auth.reset.mismatch'));
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await apiClient.post<{ message?: string }>('/auth/reset-password', {
        token,
        newPassword: password
      });
      setSuccessMessage(response.data?.message || t('auth.reset.successFallback'));
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      const code = extractApiErrorCode(error);
      if (code === 'expired_token') {
        setErrorMessage(t('auth.reset.expired'));
      } else if (code === 'used_token') {
        setErrorMessage(t('auth.reset.used'));
      } else {
        setErrorMessage(extractApiErrorMessage(error, t('auth.reset.failed')));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0f1117] p-6 text-[#f4f4f5] selection:bg-[#16a34a]/20">
      {/* layered glow backdrop — matches AuthSplitShell */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,200,83,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(0,200,83,0.07),transparent_42%)]" />

      <Link to="/login" className="absolute left-8 top-8 z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]">
        <ArrowLeft className="h-4 w-4" /> {t('auth.reset.backToLogin')}
      </Link>

      <div className="relative mx-auto flex min-h-screen max-w-md items-center justify-center">
        <div className="theme-surface theme-border w-full rounded-xl border p-6 shadow-2xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-[#16a34a]/40 bg-[#16a34a]/10 text-[#16a34a]">
              <KeyRound className="h-8 w-8" />
            </div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">{t('auth.reset.title')}</h1>
            <p className="text-sm leading-6 text-[#a1a1aa]">{t('auth.reset.subtitle')}</p>
          </div>

          {tokenError && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-400">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{tokenError}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-400">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className={`${authLabelClass} mb-2 block`}>{t('auth.reset.newPasswordLabel')}</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={Boolean(tokenError) || Boolean(successMessage)}
                className={authInputClass}
                placeholder={t('auth.reset.placeholder')}
              />
            </div>

            <div>
              <label className={`${authLabelClass} mb-2 block`}>{t('auth.reset.confirmPasswordLabel')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={Boolean(tokenError) || Boolean(successMessage)}
                className={authInputClass}
                placeholder={t('auth.reset.placeholder')}
              />
            </div>

            <button
              type="submit"
              disabled={Boolean(tokenError) || Boolean(successMessage) || isSubmitting}
              className={`${authPrimaryButtonClass} rounded-xl`}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('auth.reset.submit')}
            </button>
          </form>

          <p className="mt-6 text-xs font-medium leading-relaxed text-[#71717a]">
            {t('auth.reset.note')}
          </p>
        </div>
      </div>
    </div>
  );
};
