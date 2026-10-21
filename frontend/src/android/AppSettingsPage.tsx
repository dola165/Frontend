import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ThemePreference } from '../theme';
import { updateAndroidPreferences, type AndroidPreferences } from './preferences';

export function AppSettingsPage({ theme }: { theme: ThemePreference }) {
    const { t, i18n } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function change(value: Partial<AndroidPreferences>) {
        if (busy) return;
        setBusy(true); setError('');
        try { await updateAndroidPreferences(value); }
        catch { setError(i18n.resolvedLanguage === 'ka' ? 'პარამეტრები ვერ შეინახა. სცადეთ ხელახლა.' : 'Your preference could not be saved. Please try again.'); }
        finally { setBusy(false); }
    }
    const ka = i18n.resolvedLanguage === 'ka';
    return <main className="mx-auto max-w-xl space-y-7 px-4 py-6">
        <h1 className="text-2xl font-bold">{ka ? 'აპის პარამეტრები' : 'App settings'}</h1>
        <fieldset className="space-y-3" disabled={busy}>
            <legend className="mb-3 font-semibold">{t('nav.appearance')}</legend>
            {([
                ['map-light', t('nav.mapLightMode')], ['dark', t('nav.darkMode')], ['light', t('nav.lightMode')],
            ] as const).map(([value, label]) => <label key={value} className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-4 py-3">
                <input type="radio" name="appearance" value={value} checked={theme === value} onChange={() => void change({ theme: value })} />
                <span>{label}</span>
            </label>)}
        </fieldset>
        <fieldset className="space-y-3" disabled={busy}>
            <legend className="mb-3 font-semibold">{t('nav.language')}</legend>
            {([['en', 'English'], ['ka', 'ქართული']] as const).map(([value, label]) => <label key={value} className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-4 py-3">
                <input type="radio" name="language" value={value} checked={(ka ? 'ka' : 'en') === value} onChange={() => void change({ language: value })} />
                <span lang={value}>{label}</span>
            </label>)}
            <p className="text-sm text-[var(--fc-text-secondary)]">{ka ? 'თარგმანის არმქონე ტექსტი ინგლისურად გამოჩნდება.' : 'Text without a translation continues to use English.'}</p>
        </fieldset>
        {busy && <p role="status">{ka ? 'ინახება…' : 'Saving…'}</p>}
        {error && <p role="alert">{error}</p>}
    </main>;
}
