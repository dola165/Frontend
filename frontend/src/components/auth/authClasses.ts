// Shared class strings for the auth family (Register / Login / Onboarding).
// The codebase hand-rolls these per form; centralizing them keeps the
// redesigned pages pixel-identical and prevents the drift we already see
// between Login (--fc-* vars) and Register (raw hex).

export const authInputClass =
    'theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-[#f4f4f5] outline-none transition-colors focus:border-[#16a34a] placeholder:text-[#a1a1aa]';

export const authInputErrorClass =
    'theme-surface-strong w-full border border-[color:var(--state-danger)] px-3 py-3 text-sm font-semibold text-[#f4f4f5] outline-none transition-colors placeholder:text-[#a1a1aa]';

export const authPrimaryButtonClass =
    'w-full mt-2 inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] text-white px-4 py-3 text-[11px] font-semibold transition-colors disabled:opacity-50';

export const authGhostButtonClass =
    'w-full py-3 text-[11px] font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const authSecondaryButtonClass =
    'border border-[#ffffff0d] bg-[#0f1117] px-4 py-3 text-[11px] font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors';

export const authLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]';

export const authHintClass = 'text-[10px] font-semibold text-muted';

export const authFieldErrorClass = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--state-danger)]';

export const authDividerClass = 'my-8 flex items-center gap-4';
export const authDividerLineClass = 'h-px bg-[#ffffff0d] flex-1';
export const authDividerLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-muted';

export const authRoleCardClass = (active: boolean): string =>
    `rounded-xl border px-4 py-4 text-left transition-colors ${
        active ? 'border-[#16a34a] bg-[#16a34a]/10' : 'border-[#ffffff0d] hover:border-strong'
    }`;
