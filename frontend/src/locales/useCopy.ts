import i18next from 'i18next';
import { useTranslation } from 'react-i18next';

type Values = Record<string, string | number>;
const fill = (text: string, values?: Values) => values ? text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => key in values ? String(values[key]) : match) : text;
const english = <T extends Record<string, string>>(table: T, key: string, values?: Values) => {
    const count = typeof values?.count === 'number' ? values.count : null;
    return count !== null && `${key}_other` in table ? table[`${key}_${count === 1 ? 'one' : 'other'}`] ?? table[`${key}_other`] : table[key] ?? key;
};

/**
 * Copy for one locale namespace, with the English text as the fallback and i18n plurals:
 * `copy('waiting', { count })` reads `waiting_one` / `waiting_other`. Values are filled in
 * even where i18n has not started (tests, the first render), so no raw `{{name}}` is shown.
 */
export function useCopy<T extends Record<string, string>>(namespace: string, table: T) {
    const { t } = useTranslation();
    return (key: PluralBase<T> | (keyof T & string), values?: Values): string =>
        fill(String(t(`${namespace}.${key}`, { defaultValue: english(table, key, values), ...values })), values);
}

/** The same lookup outside React, for helpers such as date labels. Follows the app language. */
export function translate<T extends Record<string, string>>(namespace: string, table: T, key: PluralBase<T> | (keyof T & string), values?: Values): string {
    const fallback = english(table, key, values);
    return fill(i18next.isInitialized ? String(i18next.t(`${namespace}.${key}`, { defaultValue: fallback, ...values })) : fallback, values);
}

type PluralBase<T> = { [K in keyof T]: K extends `${infer Base}_other` ? Base : never }[keyof T];
export type Copy = ReturnType<typeof useCopy>;
