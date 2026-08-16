import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GrasskickzLogo } from '../layout/GrasskickzLogo';

interface AuthSplitShellProps {
    heroMicro: string; // e.g. 'Recruitment Channel' / 'Command Center'
    heroTitle: string; // e.g. 'Draft Day' / 'Welcome Back'
    heroTagline: string;
    chips?: string[]; // truthful capability chips — no fake stats
    cardHeader?: ReactNode; // mobile-only brand block rendered inside the card (lg:hidden)
    children: ReactNode; // form card content
    footer: ReactNode; // bottom cross-link line (e.g. 'Already drafted? Access Database')
}

/**
 * Split-screen auth layout ("LandingPage-lite"): brand hero on the left,
 * form card on the right. Hero is hidden below lg so the form renders first
 * on mobile; the card is not sticky (the register form is the tallest
 * element on the page, so stickiness would add nothing).
 */
export const AuthSplitShell = ({ heroMicro, heroTitle, heroTagline, chips, cardHeader, children, footer }: AuthSplitShellProps) => {
    const { t } = useTranslation();

    return (
        <div className="relative min-h-screen bg-[#0f1117] text-[#f4f4f5]">
            {/* layered glow backdrop — ClubHero pattern */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,200,83,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(0,200,83,0.07),transparent_42%)]" />

            <Link
                to="/"
                className="absolute top-8 left-8 z-10 inline-flex items-center gap-2 text-[11px] font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
            >
                <ArrowLeft className="w-5 h-5" /> {t('auth.common.backToBase')}
            </Link>

            <main className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,420px)]">
                {/* brand hero — hidden on mobile */}
                <section className="hidden flex-col justify-center gap-8 lg:flex">
                    <GrasskickzLogo />
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#16a34a]">{heroMicro}</p>
                        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl">{heroTitle}</h1>
                        <p className="mt-4 max-w-xl text-base leading-7 text-[#a1a1aa]">{heroTagline}</p>
                    </div>
                    {chips && chips.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                            {chips.map((chip) => (
                                <div
                                    key={chip}
                                    className="rounded-full border border-[#ffffff0d] bg-[#16181d] px-4 py-2 text-sm text-[#f4f4f5]"
                                >
                                    {chip}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* form column — first on mobile */}
                <section className="w-full">
                    <div className="theme-surface theme-border rounded-xl border p-6 shadow-2xl sm:p-8">
                        {cardHeader}
                        {children}
                    </div>
                    <div className="mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
                        {footer}
                    </div>
                </section>
            </main>
        </div>
    );
};
