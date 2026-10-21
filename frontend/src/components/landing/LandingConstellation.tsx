import { visualColors } from '../../styles/visualColors';
import { useId, useRef, type PointerEvent } from 'react';
import { Heart, MoveUpRight, Shield, UsersRound } from 'lucide-react';

const people = [
    { label: 'I want to play', detail: 'Find your club', Icon: UsersRound },
    { label: 'I run a club', detail: 'Build something together', Icon: Shield },
    { label: 'I love the game', detail: 'Find your people', Icon: Heart },
];
const positions = [[14, 50], [32, 22], [30, 43], [30, 65], [35, 83], [52, 30], [51, 54], [56, 78], [76, 22], [80, 49], [78, 78]];

/** A lightweight, decorative pitch. The real controls remain ordinary buttons. */
export function LandingConstellation({ selected, onSelect, paused }: { selected: number; onSelect: (index: number) => void; paused: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const id = useId().replace(/:/g, '');
    const light = `${id}-light`;
    const move = (event: PointerEvent<HTMLDivElement>) => {
        if (paused || event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const rect = event.currentTarget.getBoundingClientRect();
        ref.current?.style.setProperty('--field-x', `${((event.clientX - rect.left) / rect.width - .5) * 10}deg`);
        ref.current?.style.setProperty('--field-y', `${((event.clientY - rect.top) / rect.height - .5) * -6}deg`);
    };
    const reset = () => {
        ref.current?.style.setProperty('--field-x', '0deg');
        ref.current?.style.setProperty('--field-y', '0deg');
    };

    return <div ref={ref} className="landing-constellation" data-selected={selected} onPointerMove={move} onPointerLeave={reset}>
        <div className="constellation-art" aria-hidden="true">
            <div className="constellation-halo" />
            <div className="constellation-grid" />
            <svg className="constellation-wires" viewBox="0 0 1200 540" fill="none" preserveAspectRatio="none">
                <defs><linearGradient id={light} x1="0" y1="1" x2="0" y2="0"><stop stopColor={visualColors.landingConstellationPaint20} /><stop offset="1" stopColor={visualColors.landingConstellationPaint21} stopOpacity=".05" /></linearGradient></defs>
                {[0, 1, 2].map((n) => <g key={n} className={`constellation-wire constellation-wire-${n}`}>
                    <path d={n === 0 ? 'M180 510V405Q180 382 205 370L450 258' : n === 1 ? 'M600 510V334' : 'M1020 510V405Q1020 382 995 370L750 258'} stroke={`url(#${light})`} strokeWidth="2" />
                    <path className="constellation-current" d={n === 0 ? 'M180 510V405Q180 382 205 370L450 258' : n === 1 ? 'M600 510V334' : 'M1020 510V405Q1020 382 995 370L750 258'} stroke={visualColors.landingConstellationPaint22} strokeWidth="3" strokeDasharray="6 240" />
                </g>)}
                <path d="M70 330 600 70 1130 330M70 350 600 90 1130 350" stroke={visualColors.landingConstellationPaint23} strokeOpacity=".08" />
            </svg>
            <div className="constellation-scene">
                <div className="constellation-underlay constellation-underlay-two" />
                <div className="constellation-underlay" />
                <div className="constellation-pitch">
                    <div className="constellation-scan" />
                    <svg viewBox="0 0 640 360" fill="none" className="constellation-pitch-lines">
                        <rect x="22" y="22" width="596" height="316" rx="2" /><path d="M320 22V338M22 90H108V270H22M618 90H532V270H618M22 137H56V223H22M618 137H584V223H618" /><circle cx="320" cy="180" r="49" /><circle cx="320" cy="180" r="2" fill="currentColor" /><path d="M108 143Q140 180 108 217M532 143Q500 180 532 217" />
                    </svg>
                    {positions.map(([x, y], index) => <span key={index} className="constellation-player" style={{ left: `${x}%`, top: `${y}%` }}><i /></span>)}
                    <div className="constellation-pass"><i /></div>
                    {[0,1,2,3].map(index=><span className={`constellation-floodlight floodlight-${index}`} key={index}><i/><b/></span>)}
                    <div className="constellation-center"><span>G</span><small>CONNECTING<br />THE GAME</small></div>
                </div>
            </div>
            <span className="constellation-coordinate constellation-coordinate-left">A PLACE TO PLAY</span>
            <span className="constellation-coordinate constellation-coordinate-right">A PLACE TO BELONG</span>
        </div>
        <div className="constellation-people" role="tablist" aria-label="Your place in football">
            {people.map(({ label, detail, Icon }, index) => <button key={label} type="button" role="tab" id={`landing-role-${['player', 'club', 'supporter'][index]}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} aria-controls="landing-role-panel" onClick={() => onSelect(index)} onKeyDown={event => {
                const next = event.key === 'ArrowRight' ? (index + 1) % people.length : event.key === 'ArrowLeft' ? (index + people.length - 1) % people.length : event.key === 'Home' ? 0 : event.key === 'End' ? people.length - 1 : null;
                if (next !== null) {
                    event.preventDefault();
                    onSelect(next);
                    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                }
            }}><span className="constellation-person-icon"><Icon size={21} strokeWidth={1.4} /></span><span><strong>{label}</strong><small>{detail}</small></span><MoveUpRight size={17} /></button>)}
        </div>
    </div>;
}
