import { type CSSProperties, type PropsWithChildren, useEffect, useRef, useState } from 'react';

interface LandingRevealProps extends PropsWithChildren {
    className?: string;
    delayMs?: number;
}

/**
 * A deliberately small reveal primitive for the public landing page. It never
 * owns layout and renders its children immediately when the visitor prefers
 * reduced motion.
 */
export const LandingReveal = ({ children, className = '', delayMs = 0 }: LandingRevealProps) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(() => (
        typeof window === 'undefined'
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || typeof IntersectionObserver === 'undefined'
    ));

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof window === 'undefined') {
            return;
        }

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const style = { '--landing-reveal-delay': `${delayMs}ms` } as CSSProperties;

    return (
        <div ref={ref} style={style} className={`landing-reveal ${isVisible ? 'landing-reveal--visible' : ''} ${className}`}>
            {children}
        </div>
    );
};
