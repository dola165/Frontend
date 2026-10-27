import i18n from '../i18n';
import { chooseThemePreference, hasChosenTheme, isThemePreference, type ThemePreference } from '../theme';
import { decodeBody, nativeCall } from './bridge';

export interface AndroidPreferences { theme: ThemePreference; language: 'en' | 'ka' }

export function isAndroidPreferences(value: unknown): value is AndroidPreferences {
    if (!value || typeof value !== 'object') return false;
    const prefs = value as Partial<AndroidPreferences>;
    return typeof prefs.theme === 'string' && isThemePreference(prefs.theme) && (prefs.language === 'en' || prefs.language === 'ka');
}

/**
 * The app's own settings arrive at launch, on every change broadcast, and after the person picks on the app's
 * settings page (`picked`). A pick there is a choice. Otherwise the app's default (map-light, which it stores until a
 * pick) is no choice and never touches the stored one; a dark or light it stored after an earlier pick counts only
 * while nothing was chosen since.
 */
export async function applyAndroidPreferences(value: unknown, { picked = false }: { picked?: boolean } = {}) {
    if (!isAndroidPreferences(value)) return;
    if (value.theme !== 'map-light' && (picked || !hasChosenTheme())) chooseThemePreference(value.theme);
    window.dispatchEvent(new CustomEvent('grasskickz:appearance', { detail: value.theme }));
    if (i18n.resolvedLanguage !== value.language) await i18n.changeLanguage(value.language);
}

export async function updateAndroidPreferences(change: Partial<AndroidPreferences> = {}) {
    const reply = await nativeCall({ kind: 'preferences', ...change });
    const preferences: unknown = JSON.parse(new TextDecoder().decode(decodeBody(reply.body ?? '')));
    if (!isAndroidPreferences(preferences)) throw new Error('App preferences could not be loaded. Try again.');
    await applyAndroidPreferences(preferences, { picked: change.theme !== undefined });
    return preferences;
}

export async function installAndroidPreferences() {
    window.addEventListener('grasskickz:preferences', event => {
        void applyAndroidPreferences((event as CustomEvent<unknown>).detail);
    });
    await updateAndroidPreferences();
}
