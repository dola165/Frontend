import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Mail, Loader2 } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';
import { authInputClass, authLabelClass, authPrimaryButtonClass } from '../components/auth/authClasses';
import { buildLoginPath, rememberAuthDestination, resolvePostAuthRedirect } from '../utils/authRedirect';

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const destination = resolvePostAuthRedirect(search.get('next'), '');
  useEffect(() => { rememberAuthDestination(destination); }, [destination]);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await apiClient.post<{ message?: string }>('/auth/forgot-password', {
        email: email.trim().toLowerCase()
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setSuccessMessage(response.data?.message || t('auth.forgot.successFallback'));
    } catch (error) {
      if (!controller.signal.aborted) setErrorMessage(extractApiErrorMessage(error, t('auth.forgot.errorFallback')));
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--color-surface)] p-6 text-[var(--color-text)] selection:bg-[var(--color-accent)]/20">
      {/* layered glow backdrop — matches AuthSplitShell */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,_var(--color-accent)_12%,_transparent),transparent_36%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,_var(--color-accent)_7%,_transparent),transparent_42%)]" />

      <Link to={buildLoginPath(destination)} className="absolute left-8 top-8 z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-secondary)] transition-colors hover:text-[var(--color-text)]">
        <ArrowLeft className="h-4 w-4" /> {t('auth.forgot.backToLogin')}
      </Link>

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            <Mail className="h-8 w-8" />
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">{t('auth.forgot.title')}</h1>
          <p className="text-sm leading-6 text-[var(--color-secondary)]">{t('auth.forgot.subtitle')}</p>
        </div>

        <div className="theme-surface theme-border rounded-xl border p-6 shadow-2xl sm:p-8">
          {successMessage && (
            <div role="status" className="mb-6 flex items-start gap-2 rounded-lg border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent)]/10 p-4 text-sm font-semibold text-[color:var(--color-accent)]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div role="alert" className="mb-6 flex items-start gap-2 rounded-lg border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 p-4 text-sm font-semibold text-[color:var(--color-danger)]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="recovery-email" className={`${authLabelClass} mb-2 block`}>{t('auth.forgot.emailLabel')}</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                disabled={isSubmitting}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className={authInputClass}
                placeholder={t('auth.forgot.emailPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${authPrimaryButtonClass} rounded-xl`}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? t('auth.forgot.sending') : t('auth.forgot.send')}
            </button>
          </form>

          <p className="mt-6 text-xs font-medium leading-relaxed text-[var(--color-secondary)]">
            {t('auth.forgot.privacyNote')}
          </p>
        </div>
      </div>
    </div>
  );
};
