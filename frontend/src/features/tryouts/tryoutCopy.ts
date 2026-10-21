import { useTranslation } from 'react-i18next';
import { appLocale } from '../../utils/formatting';

export function useTryoutCopy() {
  const { i18n } = useTranslation();
  const ka = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('ka');
  return (en: string, ge: string) => ka ? ge : en;
}
export function postingLabel(status: string, copy: (en: string, ge: string) => string) {
  const labels: Record<string, string> = {
    OPEN: copy('Applications open', 'განაცხადების მიღება ღიაა'), CLOSED: copy('Applications closed', 'განაცხადების მიღება დახურულია'),
    FILLED: copy('Places filled', 'ადგილები შევსებულია'), EXPIRED: copy('Tryout date passed', 'სინჯის თარიღი გასულია'),
    CANCELLED: copy('Cancelled', 'გაუქმებულია'), UNAVAILABLE: copy('Posting unavailable', 'განცხადება მიუწვდომელია'),
    PENDING: copy('Awaiting club review', 'ელოდება კლუბის განხილვას'), SHORTLISTED: copy('Shortlisted', 'შერჩეულ კანდიდატებშია'),
    ACCEPTED: copy('Accepted for a trial', 'სინჯზე მიღებულია'), REJECTED: copy('Declined by club', 'კლუბმა უარყო'),
    WITHDRAWN: copy('Withdrawn by you', 'თქვენ მიერ გაუქმებულია'), DECLINED: copy('Application closed', 'განაცხადი დახურულია'),
  };
  return labels[status] || status.replaceAll('_', ' ');
}
export function tryoutDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(appLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}
