import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveNotificationLanguage } from '../../api/notificationPreferences';

/**
 * Push and email speak `notification_preferences.language`. When a signed-in person switches the
 * app's language (header, account menu, the Android app's setting), save it there too, so the next
 * push and email speak it. Loading the app in a language changes nothing; only a switch does.
 */
export function useSaveNotificationLanguage(signedIn: boolean) {
    const { i18n } = useTranslation();
    useEffect(() => {
        if (!signedIn) return;
        let current = i18n.resolvedLanguage ?? i18n.language;
        const switched = (next: string) => {
            const language = next.startsWith('ka') ? 'ka' : 'en';
            const before = (current ?? '').startsWith('ka') ? 'ka' : 'en';
            current = next;
            if (language !== before) void saveNotificationLanguage(language).catch(() => undefined);
        };
        i18n.on('languageChanged', switched);
        return () => { i18n.off('languageChanged', switched); };
    }, [i18n, signedIn]);
}
