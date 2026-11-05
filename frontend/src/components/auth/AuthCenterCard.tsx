import type { ReactNode } from 'react';
import { GrasskickzLogo } from '../layout/GrasskickzLogo';

/** One calm card in the middle of the screen, for a single step of an account (waiting, approving). */
export function AuthCenterCard({ icon, title, line, children }: { icon: ReactNode; title: string; line?: ReactNode; children?: ReactNode }) {
    return <div className="relative min-h-screen bg-[var(--color-surface)] px-4 py-10 text-[var(--color-text)]">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col items-center justify-center gap-6">
            <GrasskickzLogo wordmark />
            <main className="theme-surface theme-border w-full rounded-xl border p-6 sm:p-8">
                <div className="mb-6 flex flex-col items-center gap-4 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-accent)]/12 text-[var(--color-accent)]">{icon}</span>
                    <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                    {line && <p className="text-sm leading-6 text-[var(--color-secondary)]">{line}</p>}
                </div>
                {children}
            </main>
        </div>
    </div>;
}
