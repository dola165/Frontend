import { useTranslation } from 'react-i18next';
import { appLanguage } from '../../utils/formatting';
import { PAGES_KA } from '../pages/copy.ka';
import { WORLD_KA } from '../world/copy.ka';
import { COMMERCE_KA } from './copy.ka';
import { COMMERCE_EDITOR_KA } from './editorCopy.ka';
import { COMMERCE_FRONT_KA } from './frontCopy.ka';

/** Feature copy stays with commerce; names, user writing and API values remain unchanged. */
type Values = Record<string, string | number | null | undefined>;
export function ct(english: string, values?: Values): string;
export function ct(english: string | null | undefined, values?: Values): string | undefined;
export function ct(english: string | null | undefined, values?: Values): string | undefined {
    if (english == null) return undefined;
    const key = english.trim();
    const translated = appLanguage() === 'ka' ? COMMERCE_KA[key] ?? COMMERCE_EDITOR_KA[key] ?? COMMERCE_FRONT_KA[key] ?? WORLD_KA[key] ?? PAGES_KA[key] ?? key : key;
    const filled = values ? translated.replace(/\{(\w+)\}/g, (match, name: string) => name in values ? String(values[name] ?? '') : match) : translated;
    return `${english.match(/^\s*/)?.[0] ?? ''}${filled}${english.match(/\s*$/)?.[0] ?? ''}`;
}

export function useCommerceCopy() {
    useTranslation();
    return ct;
}
