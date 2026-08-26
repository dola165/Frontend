import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Mail, Loader2 } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';
import { authInputClass, authLabelClass, authPrimaryButtonClass } from '../components/auth/authClasses';

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await apiClient.post<{ message?: string }>('/auth/forgot-password', {
        email: email.trim()
      });
      setSuccessMessage(response.data?.message || t('auth.forgot.successFallback'));
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, t('auth.forgot.errorFallback')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0f1117] p-6 text-[#f4f4f5] selection:bg-[#16a34a]/20">
      {/* layered glow backdrop — matches AuthSplitShell */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,200,83,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(0,200,83,0.07),transparent_42%)]" />

      <Link to="/login" className="absolute left-8 top-8 z-10 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]">
        <ArrowLeft className="h-4 w-4" /> {t('auth.forgot.backToLogin')}
      </Link>

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-[#16a34a]/40 bg-[#16a34a]/10 text-[#16a34a]">
            <Mail className="h-8 w-8" />
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">{t('auth.forgot.title')}</h1>
          <p className="text-sm leading-6 text-[#a1a1aa]">{t('auth.forgot.subtitle')}</p>
        </div>

        <div className="theme-surface theme-border rounded-xl border p-6 shadow-2xl sm:p-8">
          {successMessage && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-400">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className={`${authLabelClass} mb-2 block`}>{t('auth.forgot.emailLabel')}</label>
              <input
                type="email"
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

          <p className="mt-6 text-xs font-medium leading-relaxed text-[#71717a]">
            {t('auth.forgot.privacyNote')}
          </p>
        </div>
      </div>
    </div>
  );
};
