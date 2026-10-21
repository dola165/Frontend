import { visualColors } from '../../styles/visualColors';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowUpRight, RotateCcw, X } from 'lucide-react';
import { advanceBall, defenders, kick, newBall, type PitchMode } from './playgroundPhysics';

interface LandingPlaygroundProps { active: boolean; onActiveChange: (active: boolean) => void }
const W = 980, H = 520;

export const LandingPlayground = ({ active, onActiveChange }: LandingPlaygroundProps) => {
    const dialog = useRef<HTMLDialogElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const ball = useRef(newBall());
    const angleRef = useRef(0), powerRef = useRef(70), modeRef = useRef<PitchMode>('free');
    const dragging = useRef(false);
    const [angle, setAngle] = useState(0), [power, setPower] = useState(70);
    const [mode, setMode] = useState<PitchMode>('free');
    const [phase, setPhase] = useState<ReturnType<typeof newBall>['phase']>('ready');
    const [score, setScore] = useState({ goals: 0, shots: 0 });
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);

    const aim = useCallback((degrees: number) => { const next = Math.max(-80, Math.min(80, degrees)); angleRef.current = next * Math.PI / 180; setAngle(next); }, []);
    const strength = useCallback((value: number) => { powerRef.current = value; setPower(value); }, []);
    const shoot = useCallback(() => {
        if (ball.current.phase !== 'ready' || pausedRef.current) return;
        ball.current = kick(ball.current, angleRef.current, powerRef.current);
        setPhase('moving'); setScore(value => ({ ...value, shots: value.shots + 1 }));
    }, []);
    const reset = useCallback((all = false) => {
        ball.current = newBall(); dragging.current = false; setPhase('ready');
        if (all) setScore({ goals: 0, shots: 0 });
    }, []);

    useEffect(() => {
        const element = dialog.current;
        if (!active || !element) return;
        const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        element.showModal();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { element.close(); document.body.style.overflow = previousOverflow; focused?.focus({ preventScroll: true }); };
    }, [active]);

    useEffect(() => {
        const element = canvas.current;
        const ctx = element?.getContext('2d');
        if (!element || !ctx || !active) return;
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        element.width = W * scale; element.height = H * scale;
        ctx.scale(scale, scale);
        let frame = 0, last = 0;
        let trail: { x: number; y: number }[] = [];
        const line = (x: number, y: number, x2: number, y2: number) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); };
        const draw = (now: number) => {
            if (!document.hidden && !pausedRef.current) {
                const before = ball.current.phase;
                ball.current = advanceBall(ball.current, last ? (now - last) / 1000 : 0, modeRef.current);
                if (ball.current.phase !== before) {
                    setPhase(ball.current.phase);
                    if (ball.current.phase === 'goal') setScore(value => ({ ...value, goals: value.goals + 1 }));
                }
            }
            last = now;
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = visualColors.landingPlaygroundPaint24; ctx.fillRect(0, 0, W, H);
            for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? visualColors.landingPlaygroundPaint25 : visualColors.landingPlaygroundPaint26; ctx.fillRect(45 + i * 85.5, 45, 85.5, 430); }
            ctx.strokeStyle = visualColors.landingPlaygroundPaint27; ctx.lineWidth = 2;
            line(45, 45, 900, 45); line(45, 475, 900, 475); line(45, 45, 45, 475);
            line(900, 45, 900, 190); line(900, 330, 900, 475); line(472, 45, 472, 475);
            ctx.beginPath(); ctx.arc(472, 260, 65, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeRect(45, 155, 130, 210); ctx.strokeRect(770, 155, 130, 210);
            ctx.strokeStyle = visualColors.landingPlaygroundPaint28; ctx.lineWidth = 3; ctx.strokeRect(900, 190, 38, 140);
            ctx.lineWidth = 1; ctx.strokeStyle = visualColors.landingPlaygroundPaint29;
            for (let y = 200; y < 330; y += 10) line(900, y, 938, y);
            for (let x = 910; x < 938; x += 10) line(x, 190, x, 330);
            for (const item of defenders(modeRef.current)) {
                ctx.fillStyle = visualColors.landingPlaygroundPaint30; ctx.beginPath(); ctx.arc(item.x + 4, item.y + 7, item.radius + 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = visualColors.landingPlaygroundPaint31; ctx.strokeStyle = visualColors.landingPlaygroundPaint32; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = visualColors.landingPlaygroundPaint33; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('×', item.x, item.y + 7);
            }
            const b = ball.current;
            if (b.phase === 'moving') { trail.push({ x: b.x, y: b.y }); trail = trail.slice(-30); }
            else if (b.phase === 'ready') trail = [];
            if (trail.length > 1) {
                ctx.strokeStyle = visualColors.landingPlaygroundPaint34; ctx.lineWidth = 3; ctx.beginPath();
                trail.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
            }
            if (b.phase === 'ready') {
                const length = 90 + powerRef.current * 1.4;
                ctx.strokeStyle = visualColors.landingPlaygroundPaint35; ctx.lineWidth = 2; ctx.setLineDash([3, 9]);
                line(b.x, b.y, b.x + Math.cos(angleRef.current) * length, b.y + Math.sin(angleRef.current) * length); ctx.setLineDash([]);
                ctx.strokeStyle = dragging.current ? visualColors.landingPlaygroundPaint36 : visualColors.landingPlaygroundPaint37; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, dragging.current ? 26 : 23, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.fillStyle = visualColors.landingPlaygroundPaint38; ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 9, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.x / 25);
            ctx.fillStyle = visualColors.landingPlaygroundPaint39; ctx.strokeStyle = visualColors.landingPlaygroundPaint40; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = visualColors.landingPlaygroundPaint41; ctx.beginPath();
            for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4 - Math.PI / 2; const x = Math.cos(a) * 5, y = Math.sin(a) * 5; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); ctx.fill();
            for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4 - Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 12, Math.sin(a) * 12, 3.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
            ctx.fillStyle = visualColors.landingPlaygroundPaint42; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('GRASSKICKZ / EXTRA TIME', 47, 27); ctx.textAlign = 'right'; ctx.fillText('NO SCOUTS. NO PRESSURE.', 900, 502);
            frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [active]);

    const point = (event: PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height }; };
    const dragAim = (event: PointerEvent<HTMLCanvasElement>) => {
        const p = point(event), b = ball.current;
        const dx = b.x - p.x, dy = b.y - p.y;
        if (Math.hypot(dx, dy) < 5) return;
        aim(Math.atan2(dy, Math.max(5, dx)) * 180 / Math.PI);
        strength(Math.round(Math.min(100, Math.max(10, Math.hypot(dx, dy) * .65))));
    };

    return <dialog className="landing-playground" ref={dialog} aria-labelledby="playground-title" onCancel={() => onActiveChange(false)} onClose={() => { if (!dialog.current?.open) onActiveChange(false); }}>
        <div className="landing-playground-head"><div><span className="landing-eyebrow">You found extra time</span><h2 id="playground-title">Just one more shot<span>.</span></h2></div><button className="landing-playground-close" aria-label="Close Playground" onClick={() => onActiveChange(false)} autoFocus><X size={20} /></button></div>
        <div className="landing-playground-meta"><div role="group" aria-label="Pitch challenge">{(['free', 'rebounds'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => { modeRef.current = value; setMode(value); reset(true); }}>{value === 'free' ? 'Free kicks' : 'Play the rebounds'}</button>)}</div><span aria-label={`${score.goals} goals in ${score.shots} shots`}><strong>{score.goals.toString().padStart(2, '0')}</strong> goals <i>/</i> {score.shots} shots</span></div>
        <canvas ref={canvas} tabIndex={0} role="img" aria-label="Football playground. Drag the ball backwards and release to shoot. Or use the angle and power sliders and Shoot button below." onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); aim(angle + (event.key === 'ArrowUp' ? -5 : 5)); }
            if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (phase === 'ready') shoot(); else if (phase !== 'moving') reset(); }
        }} onPointerDown={event => { if (event.button !== 0 || ball.current.phase !== 'ready' || paused) return; const p = point(event); if (Math.hypot(p.x - ball.current.x, p.y - ball.current.y) > 45) return; dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (dragging.current) dragAim(event); }} onPointerUp={event => { if (!dragging.current) return; dragging.current = false; event.currentTarget.releasePointerCapture(event.pointerId); shoot(); }} onPointerCancel={() => { dragging.current = false; }} />
        <div className="landing-playground-status" role="status" aria-live="polite">{paused ? 'Taking a breather. Resume when you’re ready.' : phase === 'goal' ? 'Top corner energy. That’s a goal!' : phase === 'miss' ? 'The next one’s yours. Have another go.' : phase === 'moving' ? 'Go on, get in…' : mode === 'rebounds' ? 'Use the sides to find a way around the defenders.' : 'Drag the ball backwards. Aim. Let it fly.'}</div>
        <div className="landing-playground-controls"><label>Angle <span>{Math.round(angle)}°</span><input aria-label="Shot angle" type="range" min="-80" max="80" value={angle} disabled={phase === 'moving'} onChange={event => aim(Number(event.target.value))} /></label><label>Power <span>{power}%</span><input aria-label="Shot power" type="range" min="10" max="100" value={power} disabled={phase === 'moving'} onChange={event => strength(Number(event.target.value))} /></label><button className="landing-button landing-button-primary" disabled={phase === 'moving' || paused} onClick={() => phase === 'ready' ? shoot() : reset()}>{phase === 'ready' || phase === 'moving' ? 'Shoot' : 'Next ball'} <ArrowUpRight size={16} /></button><button className="landing-playground-reset" aria-label="Reset playground" onClick={() => reset(true)}><RotateCcw size={17} /></button></div>
        <div className="landing-playground-bottom"><span>↑ ↓ to aim · Space to shoot · Esc to leave</span><button onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>{paused ? 'Resume' : 'Pause'}</button></div>
    </dialog>;
};
