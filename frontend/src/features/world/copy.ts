import { useTranslation } from 'react-i18next';
import { appLanguage } from '../../utils/formatting';
import { WORLD_KA } from './copy.ka';

export type CopyVars = Record<string, string | number>;

const fill = (text: string, vars?: CopyVars) => vars
    ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
    : text;

/**
 * World copy. The English text is both the default and the key of its Georgian translation,
 * so directory definitions stay readable; `{name}` placeholders are filled from `vars`.
 * Text with no translation (names, codes such as "U12") is shown as given.
 */
export function wt(en: string, vars?: CopyVars): string {
    return fill(appLanguage() === 'ka' ? WORLD_KA[en] ?? en : en, vars);
}

/** `wt` for components: re-renders the component when the app language changes. */
export function useWorldCopy() {
    useTranslation();
    return wt;
}

export const isGeorgian = () => appLanguage() === 'ka';

/** "3 clubs" in English; Georgian keeps the noun singular after a number ("3 კლუბი"). */
export function plural(count: number, one: string, other = `${one}s`) {
    const number = count.toLocaleString(isGeorgian() ? 'ka-GE' : 'en-GB');
    return isGeorgian() ? `${number} ${wt(one)}` : `${number} ${count === 1 ? one : other}`;
}

/** Joins words into "a, b or c" in the current language. */
export function anyOf(items: string[]) {
    if (items.length < 2) return items.join('');
    return `${items.slice(0, -1).join(', ')} ${wt('or')} ${items[items.length - 1]}`;
}
