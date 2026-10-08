import { useId, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { authInputClass, authLabelClass, authPrimaryButtonClass, authSecondaryButtonClass } from './authClasses';

export function SecondFactorPrompt({ pending, error, onSubmit, onCancel }: {
    pending: boolean; error: string | null; onSubmit: (code: string) => void; onCancel: () => void;
}) {
    const [code, setCode] = useState('');
    const id = useId();
    return <section aria-labelledby={`${id}-title`} className="space-y-4">
        <ShieldCheck className="h-7 w-7 text-[color:var(--color-accent)]" aria-hidden="true" />
        <h2 id={`${id}-title`} className="text-xl font-semibold">Verify your sign-in</h2>
        <p className="text-sm">Enter the six-digit code from your authenticator app, or one unused recovery code.</p>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (code.trim() && !pending) onSubmit(code); }}>
            <label className={`${authLabelClass} block`} htmlFor={id}>Authenticator or recovery code</label>
            <input id={id} value={code} onChange={event => setCode(event.target.value)} type="text" autoComplete="one-time-code"
                autoCapitalize="none" spellCheck={false} maxLength={40} required disabled={pending} autoFocus className={authInputClass} />
            {error && <p role="alert" className="text-sm text-[color:var(--color-danger)]">{error}</p>}
            <button type="submit" disabled={pending || !code.trim()} className={authPrimaryButtonClass}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {pending ? 'Verifying…' : 'Verify and sign in'}
            </button>
            <button type="button" className={authSecondaryButtonClass} onClick={onCancel}>Cancel sign-in</button>
        </form>
    </section>;
}
