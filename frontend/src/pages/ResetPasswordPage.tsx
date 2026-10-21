import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import { authInputClass, authLabelClass, authPrimaryButtonClass } from '../components/auth/authClasses';
import { buildLoginPath, rememberAuthDestination, resolvePostAuthRedirect } from '../utils/authRedirect';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  return <ResetPasswordForm key={token} token={token} />;
};

const ResetPasswordForm = ({ token }: { token: string | null }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const destination = resolvePostAuthRedirect(searchParams.get('next'), '');
  useEffect(() => { rememberAuthDestination(destination); }, [destination]);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
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
    if (request.current || successMessage) return;

    if (!token) {
      setErrorMessage(t('auth.reset.unusableToken'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t('auth.reset.mismatch'));
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setErrorMessage(t('auth.register.errPasswordWeak'));
      return;
    }

    const controller = new AbortController(); request.current = controller;
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await apiClient.post<{ message?: string }>('/auth/reset-password', {
        token,
        newPassword: password
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setSuccessMessage(response.data?.message || t('auth.reset.successFallback'));
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = extractApiErrorCode(error);
      if (code === 'expired_token') {
        setErrorMessage(t('auth.reset.expired'));
      } else if (code === 'used_token') {
        setErrorMessage(t('auth.reset.used'));
      } else {
        setErrorMessage(extractApiErrorMessage(error, t('auth.reset.failed')));
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--color-surface)] p-6 text-[var(--color-text)] selection:bg-[var(--color-accent)]/20">
      {/* layered glow backdrop — matches AuthSplitShell */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,_var(--color-accent)_12%,_transparent),transparent_36%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,_var(--color-accent)_7%,_transparent),transparent_42%)]" />

      <Link to={buildLoginPath(destination)} className="absolute left-8 top-8 z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-secondary)] transition-colors hover:text-[var(--color-text)]">
        <ArrowLeft className="h-4 w-4" /> {t('auth.reset.backToLogin')}
      </Link>

      <div className="relative mx-auto flex min-h-screen max-w-md items-center justify-center">
        <div className="theme-surface theme-border w-full rounded-xl border p-6 shadow-2xl sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <KeyRound className="h-8 w-8" />
            </div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">{t('auth.reset.title')}</h1>
            <p className="text-sm leading-6 text-[var(--color-secondary)]">{t('auth.reset.subtitle')}</p>
          </div>

          {tokenError && (
            <div role="alert" className="mb-6 flex items-start gap-2 rounded-lg border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 p-4 text-sm font-semibold text-[color:var(--color-danger)]">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{tokenError}</span>
            </div>
          )}

          {errorMessage && (
            <div role="alert" className="mb-6 flex items-start gap-2 rounded-lg border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 p-4 text-sm font-semibold text-[color:var(--color-danger)]">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div role="status" className="mb-6 flex items-start gap-2 rounded-lg border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent)]/10 p-4 text-sm font-semibold text-[color:var(--color-accent)]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {successMessage && <Link to={buildLoginPath(destination)} className={`${authPrimaryButtonClass} mb-6`}>{t('auth.reset.backToLogin')}</Link>}
          {(tokenError || errorMessage) && <Link to="/forgot-password" className="mb-6 inline-block app-text-action">Request a new reset link</Link>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="reset-password" className={`${authLabelClass} mb-2 block`}>{t('auth.reset.newPasswordLabel')}</label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-describedby="reset-password-rules"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={Boolean(tokenError) || Boolean(successMessage) || isSubmitting}
                className={authInputClass}
                placeholder={t('auth.reset.placeholder')}
              />
              <p id="reset-password-rules" className="mt-2 text-xs text-[var(--color-secondary)]">{[t('auth.register.ruleLength'), t('auth.register.ruleUpper'), t('auth.register.ruleLower'), t('auth.register.ruleDigit')].join(' · ')}</p>
            </div>

            <div>
              <label htmlFor="reset-password-confirm" className={`${authLabelClass} mb-2 block`}>{t('auth.reset.confirmPasswordLabel')}</label>
              <input
                id="reset-password-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={Boolean(tokenError) || Boolean(successMessage) || isSubmitting}
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

          <p className="mt-6 text-xs font-medium leading-relaxed text-[var(--color-secondary)]">
            {t('auth.reset.note')}
          </p>
        </div>
      </div>
    </div>
  );
};
