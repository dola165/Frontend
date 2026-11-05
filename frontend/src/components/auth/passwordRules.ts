import type { TFunction } from 'i18next';

/** What a new password needs, as sign-up and a child's own account show it under the field. */
export const passwordRules = (t: TFunction) => [
    { key: 'length', test: (value: string) => value.length >= 8, label: t('auth.register.ruleLength') },
    { key: 'upper', test: (value: string) => /[A-Z]/.test(value), label: t('auth.register.ruleUpper') },
    { key: 'lower', test: (value: string) => /[a-z]/.test(value), label: t('auth.register.ruleLower') },
    { key: 'digit', test: (value: string) => /\d/.test(value), label: t('auth.register.ruleDigit') },
];
