import { useTranslation } from 'react-i18next';

export function useResultCopy() {
  const { i18n } = useTranslation();
  const language = i18n.language?.startsWith('ka') ? 'ka' : 'en';
  return { language, copy: (en: string, ka: string) => language === 'ka' ? ka : en };
}

