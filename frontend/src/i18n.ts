import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en';
import ka from './locales/ka';
import { experienceEn, experienceKa } from './locales/experience';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: { ...en, experience: experienceEn } },
      ka: { translation: { ...ka, experience: experienceKa } },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ka'],
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
