// Shared class strings for the auth family (Register / Login / Onboarding).
// The codebase hand-rolls these per form; centralizing them keeps the
// redesigned pages pixel-identical and prevents the drift we already see
// between Login (--fc-* vars) and Register (raw hex).

export const authInputClass =
    'theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)] placeholder:text-[var(--color-secondary)]';

export const authInputErrorClass =
    'theme-surface-strong w-full border border-[color:var(--state-danger)] px-3 py-3 text-sm font-semibold text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-secondary)]';

export const authPrimaryButtonClass =
    'w-full mt-2 inline-flex items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-[var(--color-on-accent)] px-4 py-3 text-[11px] font-semibold transition-colors disabled:opacity-50';

export const authGhostButtonClass =
    'w-full py-3 text-[11px] font-semibold text-[var(--color-secondary)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const authSecondaryButtonClass =
    'border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-4 py-3 text-[11px] font-semibold text-[var(--color-secondary)] hover:text-[var(--color-text)] transition-colors';

export const authLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)]';

export const authHintClass = 'text-[10px] font-semibold text-muted';

export const authFieldErrorClass = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--state-danger)]';

export const authDividerClass = 'my-8 flex items-center gap-4';
export const authDividerLineClass = 'h-px bg-[color-mix(in_srgb,_var(--color-ink)_5.1%,_transparent)] flex-1';
export const authDividerLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-muted';

export const authRoleCardClass = (active: boolean): string =>
    `rounded-xl border px-4 py-4 text-left transition-colors ${
        active ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] hover:border-strong'
    }`;
