import { useTranslation } from 'react-i18next';
import { appLanguage } from '../../utils/formatting';
import { PAGES_KA } from './copy.ka';

export type CopyVars = Record<string, string | number>;
const fill = (text: string, vars?: CopyVars) => (vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text);

/** Page copy: the English text is the key of its Georgian translation (World's pattern); `{name}` is filled from `vars`. */
export function pt(en: string, vars?: CopyVars): string {
  return fill(appLanguage() === 'ka' ? PAGES_KA[en] ?? en : en, vars);
}

/** `pt` for components: re-renders the component when the app language changes. */
export function usePagesCopy() {
  useTranslation();
  return pt;
}
