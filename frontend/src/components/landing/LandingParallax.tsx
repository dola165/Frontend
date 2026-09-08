import { type PropsWithChildren, useEffect, useRef } from 'react';

interface LandingParallaxProps extends PropsWithChildren {
    className?: string;
    depth?: number;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);

/** Decorative-only parallax. It moves a layer, never the content it sits behind. */
export const LandingParallax = ({ children, className = '', depth = 0.12 }: LandingParallaxProps) => {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof window === 'undefined') {
            return;
        }

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            return;
        }

        let frame = 0;
        const update = () => {
            frame = 0;
            const rect = element.getBoundingClientRect();
            const viewportCenter = window.innerHeight / 2;
            const elementCenter = rect.top + rect.height / 2;
            const offset = clamp((viewportCenter - elementCenter) * depth, -24, 24);
            element.style.setProperty('--landing-parallax-y', `${offset.toFixed(2)}px`);
        };
        const requestUpdate = () => {
            if (frame === 0) {
                frame = window.requestAnimationFrame(update);
            }
        };

        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        requestUpdate();

        return () => {
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
            if (frame !== 0) {
                window.cancelAnimationFrame(frame);
            }
        };
    }, [depth]);

    return (
        <div ref={ref} className={`landing-parallax ${className}`}>
            {children}
        </div>
    );
};
