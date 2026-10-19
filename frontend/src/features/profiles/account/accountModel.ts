import type { EntityTabItem } from '../../../components/layout/EntityTabs';
import type { MyTryoutApplication } from '../../../api/tryouts';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { formatDateTime } from '../../../utils/formatting';
import type { useAccountCopy } from './accountCopy';

export type AccountTab = 'profile' | 'security' | 'sessions' | 'accounts' | 'danger';
export type Account = {
    id: number;
    username: string;
    email: string;
    role: string;
    displayName: string;
    emailVerified: boolean;
    emailVerifiedAt?: string | null;
    passwordLoginEnabled: boolean;
    fullName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    playerProfile?: {
        primaryPosition?: string | null;
        secondaryPosition?: string | null;
        preferredFoot?: string | null;
        heightCm?: number | null;
        weightKg?: number | null;
        availabilityStatus?: string | null;
    } | null;
    linkedAccounts: Array<{ provider: string; linkedAt?: string | null }>;
    sessionsSupported: boolean;
    sessionRevocationSupported: boolean;
    accountDeletionSupported: boolean;
};
export type SessionSummary = {
    sessions: Array<{ id: number; current: boolean; status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'; expiresAt?: string | null }>;
    activeCount: number;
    revokedCount: number;
    expiredCount: number;
};
export type TryoutApp = MyTryoutApplication;
export type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };
export type AccountCopy = ReturnType<typeof useAccountCopy>;
export type AccountError = { literal: string } | { fallback: string };
export const accountError = (failure: unknown, fallback: string): AccountError => {
    const literal = extractApiErrorMessage(failure, '');
    return literal ? { literal } : { fallback };
};
export const accountErrorText = (error: AccountError, copy: (english: string) => string) =>
    'literal' in error ? error.literal : copy(error.fallback);

export const accountTabItems: EntityTabItem[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'accounts', label: 'Linked Accounts' },
    { id: 'danger', label: 'Danger' }
];
export const normalizeAccountTab = (value: string | null): AccountTab =>
    value === 'security' || value === 'sessions' || value === 'accounts' || value === 'danger' ? value : 'profile';
export const fmt = (value?: string | null) => (value ? formatDateTime(value) : null);

// Style primitives — use FC workspace tokens
export const surfaceClass = 'bg-[var(--fc-card-bg)] border border-[var(--fc-border)] rounded-xl';
export const insetClass = 'border border-[var(--fc-border)] bg-[var(--fc-page-bg)] rounded-xl';
export const labelClass = 'text-xs font-semibold text-[var(--fc-text-secondary)]';
export const inputClass = 'w-full rounded-xl border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2.5 text-sm text-[var(--fc-text-primary)] outline-none transition-colors placeholder:text-[var(--fc-text-muted)] focus:border-[var(--fc-accent)] focus:ring-1 focus:ring-[var(--fc-accent)]/30';
export const btnPrimaryClass = 'inline-flex items-center gap-2 rounded-xl bg-[var(--fc-accent)] px-4 py-2.5 text-sm font-semibold text-[color:var(--color-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-50';
export const btnSecondaryClass = 'inline-flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--fc-text-primary)] transition-colors hover:bg-[var(--fc-surface-hover)] disabled:opacity-50';
