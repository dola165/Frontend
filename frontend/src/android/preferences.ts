import i18n from '../i18n';
import { chooseThemePreference, isThemePreference, THEME_CHOSEN_KEY, type ThemePreference } from '../theme';
import { decodeBody, nativeCall } from './bridge';

export interface AndroidPreferences { theme: ThemePreference; language: 'en' | 'ka' }

export function isAndroidPreferences(value: unknown): value is AndroidPreferences {
    if (!value || typeof value !== 'object') return false;
    const prefs = value as Partial<AndroidPreferences>;
    return typeof prefs.theme === 'string' && isThemePreference(prefs.theme) && (prefs.language === 'en' || prefs.language === 'ka');
}

export async function applyAndroidPreferences(value: unknown) {
    if (!isAndroidPreferences(value)) return;
    // The app stores map-light (dark) until the person picks: only a picked dark or light counts as a choice.
    if (value.theme === 'map-light') { localStorage.setItem('theme-preference', value.theme); localStorage.removeItem(THEME_CHOSEN_KEY); }
    else chooseThemePreference(value.theme);
    window.dispatchEvent(new CustomEvent('grasskickz:appearance', { detail: value.theme }));
    if (i18n.resolvedLanguage !== value.language) await i18n.changeLanguage(value.language);
}

export async function updateAndroidPreferences(change: Partial<AndroidPreferences> = {}) {
    const reply = await nativeCall({ kind: 'preferences', ...change });
    const preferences: unknown = JSON.parse(new TextDecoder().decode(decodeBody(reply.body ?? '')));
    if (!isAndroidPreferences(preferences)) throw new Error('App preferences could not be loaded. Try again.');
    await applyAndroidPreferences(preferences);
    return preferences;
}

export async function installAndroidPreferences() {
    window.addEventListener('grasskickz:preferences', event => {
        void applyAndroidPreferences((event as CustomEvent<unknown>).detail);
    });
    await updateAndroidPreferences();
}
