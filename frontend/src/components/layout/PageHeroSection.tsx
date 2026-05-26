import type { ReactNode } from 'react';
import { AppPageFrame } from './AppPageShell';

interface PageHeroSectionProps {
    children: ReactNode;
    className?: string;
    frameClassName?: string;
}

export const PageHeroSection = ({
    children,
    className = '',
    frameClassName = 'relative py-8 lg:py-10'
}: PageHeroSectionProps) => (
    <section className={`app-page-hero border-b border-subtle ${className}`.trim()}>
        <AppPageFrame className={frameClassName}>{children}</AppPageFrame>
    </section>
);
