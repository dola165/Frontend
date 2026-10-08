import { useEffect, useRef } from 'react';
import { LandingAtmosphere } from './LandingAtmosphere';

/** Oversized chalk markings and floodlights, drawn once rather than painted every frame. */
export function LandingLightRails({ variant = 'flow' }: { variant?: 'flow' | 'horizon' | 'orbit' }) {
    return <div className={`landing-light-rails light-rails-${variant}`} aria-hidden="true"><LandingAtmosphere>
        <svg viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice" fill="none" className="landing-touchlines">
            <g className="touchline-markings" stroke="currentColor" strokeWidth="1.2">
                <rect x="80" y="85" width="1280" height="590" rx="2" />
                <path d="M720 85V675M80 215H270V545H80M1360 215H1170V545H1360M80 290H155V470H80M1360 290H1285V470H1360" />
                <circle cx="720" cy="380" r="102" />
                <path d="M270 310Q343 380 270 450M1170 310Q1097 380 1170 450" />
                <circle cx="720" cy="380" r="4" fill="currentColor" />
            </g>
            <path className="touchline-pass" d="M340 565Q550 235 760 355T1150 190" stroke="currentColor" strokeWidth="1.4" strokeDasharray="7 13" />
            <g className="touchline-players" stroke="currentColor" strokeWidth="2">
                <circle cx="340" cy="565" r="9"/><circle cx="760" cy="355" r="9"/><circle cx="1150" cy="190" r="9"/>
                <path d="M518 195l14 14m0-14-14 14M1010 477l14 14m0-14-14 14" />
            </g>
        </svg>
        <div className="touchline-floodlight"/><div className="touchline-floodlight floodlight-away"/>
    </LandingAtmosphere></div>;
}

/** No idle rendering loop: only visible sections animate and input updates are batched. */
export function LandingLightField({ paused }: { paused: boolean }) {
    const fieldRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const root = fieldRef.current?.closest<HTMLElement>('.gk-landing');
        if (!root || typeof window.matchMedia !== 'function' || typeof requestAnimationFrame !== 'function') return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
        let frame = 0;
        let activeCard: HTMLElement | null = null;
        let bounds: DOMRect | null = null;
        let pointerX = 0, pointerY = 0;
        let progressDirty = true, pointerDirty = false;
        const resetCard = () => {
            activeCard?.style.removeProperty('--card-turn-x');
            activeCard?.style.removeProperty('--card-turn-y');
            activeCard = null;
            bounds = null;
        };
        const update = () => {
            frame = 0;
            if (progressDirty) {
                const travel = document.documentElement.scrollHeight - window.innerHeight;
                progressRef.current?.style.setProperty('--reading-progress', String(travel > 0 ? window.scrollY / travel : 0));
                progressDirty = false;
            }
            if (pointerDirty && activeCard && bounds) {
                const x = (pointerX - bounds.left) / bounds.width;
                const y = (pointerY - bounds.top) / bounds.height;
                activeCard.style.setProperty('--card-turn-x', `${(y - .5) * -2}deg`);
                activeCard.style.setProperty('--card-turn-y', `${(x - .5) * 2}deg`);
            }
            pointerDirty = false;
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
        const scroll = () => { progressDirty = true; resetCard(); schedule(); };
        const move = (event: PointerEvent) => {
            if (paused || reduce.matches || event.pointerType !== 'mouse') return;
            const card = event.target instanceof Element ? event.target.closest<HTMLElement>('.landing-professional,.competition-visual,.week-visual,.volunteer-interactive') : null;
            if (activeCard !== card) { resetCard(); activeCard = card; bounds = card?.getBoundingClientRect() ?? null; }
            if (!card) return;
            pointerX = event.clientX; pointerY = event.clientY; pointerDirty = true; schedule();
        };
        const visibility = () => { root.dataset.pageVisible = String(!document.hidden); };
        const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
            for (const entry of entries) (entry.target as HTMLElement).dataset.lightActive = String(entry.isIntersecting);
        }, { rootMargin: '80px' });
        root.querySelectorAll('.landing-chapter,.landing-belong,.landing-path-section,.landing-journey-card,.landing-auth,.landing-extra-time,.landing-origin,.landing-final').forEach(element => observer?.observe(element));
        visibility(); schedule();
        window.addEventListener('scroll', scroll, { passive: true });
        window.addEventListener('resize', scroll);
        root.addEventListener('pointermove', move, { passive: true });
        root.addEventListener('pointerleave', resetCard);
        document.addEventListener('visibilitychange', visibility);
        reduce.addEventListener('change', resetCard);
        return () => {
            cancelAnimationFrame(frame); observer?.disconnect(); resetCard();
            window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll);
            root.removeEventListener('pointermove', move); root.removeEventListener('pointerleave', resetCard);
            document.removeEventListener('visibilitychange', visibility); reduce.removeEventListener('change', resetCard);
        };
    }, [paused]);
    return <><div className="landing-light-field" ref={fieldRef} aria-hidden="true"/><div className="landing-reading-progress" ref={progressRef} aria-hidden="true"/></>;
}
