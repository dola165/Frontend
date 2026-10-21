import { useEffect, useRef, type PropsWithChildren } from 'react';

/** Pause ambient CSS animation whenever the story leaves the viewport. */
export function LandingAtmosphere({ children }: PropsWithChildren) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => {
            element.dataset.inView = String(entry.isIntersecting);
        }, { rootMargin: '120px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return <div ref={ref} className="landing-atmosphere" data-in-view="false">{children}</div>;
}
