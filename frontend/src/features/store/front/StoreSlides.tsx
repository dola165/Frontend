import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cataloguePath } from '../query';

const SLIDES = [
    { image: '/football/touchline.jpg', eyebrow: 'New season', title: 'Club shirts for 2026/27', line: 'Home and away shirts from the clubs on GrassKickZ', action: 'Shop shirts', to: cataloguePath({ seller: 'clubs', category: 'SHIRT' }) },
    { image: '/football/ball-field.jpg', eyebrow: 'Sold by GrassKickZ', title: 'Equip the whole squad', line: 'Match balls, cones, bibs and goals, delivered to your ground', action: 'Shop equipment', to: cataloguePath({ seller: 'grasskickz' }) },
    { image: '/landing/after-the-whistle.png', eyebrow: 'Support your club', title: 'Every purchase backs a club', line: 'Scarves, memberships and match tickets from the clubs you follow', action: 'Explore club stores', to: cataloguePath({ seller: 'clubs' }) },
];
const EVERY = 6000;

/** A slideshow of campaign banners: it moves on its own, pauses under the pointer, and the arrows and dots move it by hand. */
export function StoreSlides() {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        if (paused || typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const timer = window.setInterval(() => setIndex(current => (current + 1) % SLIDES.length), EVERY);
        return () => window.clearInterval(timer);
    }, [paused, index]);
    const go = (next: number) => setIndex((next + SLIDES.length) % SLIDES.length);
    return (
        <section className="gk-store-slides" aria-roledescription="carousel" aria-label="Highlights" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
            <div className="gk-store-slides__track" style={{ transform: `translateX(-${index * 100}%)` }}>
                {SLIDES.map((slide, i) => (
                    <article key={slide.title} className="gk-store-slide" aria-hidden={i !== index} inert={i !== index ? true : undefined} aria-roledescription="slide" aria-label={`${i + 1} of ${SLIDES.length}`}>
                        <img className="gk-store-slide__pic" src={slide.image} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
                        <div className="gk-store-slide__text">
                            <span className="gk-store-door__eyebrow">{slide.eyebrow}</span>
                            <h2 className="gk-store-slide__title">{slide.title}</h2>
                            <p className="gk-store-door__line">{slide.line}</p>
                            <Link className="gk-store-door__chip" to={slide.to}>{slide.action}</Link>
                        </div>
                    </article>
                ))}
            </div>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--prev" aria-label="Previous slide" onClick={() => go(index - 1)}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" className="gk-store-rail__arrow gk-store-rail__arrow--next" aria-label="Next slide" onClick={() => go(index + 1)}><ChevronRight aria-hidden="true" /></button>
            <div className="gk-store-slides__dots" role="tablist" aria-label="Slides">
                {SLIDES.map((slide, i) => <button key={slide.title} type="button" role="tab" aria-selected={i === index} aria-label={slide.title} onClick={() => go(i)} />)}
            </div>
        </section>
    );
}
