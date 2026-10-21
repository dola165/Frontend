export type PitchMode = 'free' | 'rebounds';
export type BallState = { x: number; y: number; vx: number; vy: number; phase: 'ready' | 'moving' | 'goal' | 'miss'; time: number };
export const newBall = (): BallState => ({ x: 160, y: 260, vx: 0, vy: 0, phase: 'ready', time: 0 });
export const defenders = (mode: PitchMode) => mode === 'rebounds' ? [{ x: 510, y: 246, radius: 30 }, { x: 700, y: 355, radius: 30 }] : [];
export const kick = (ball: BallState, angle: number, power: number): BallState => ({ ...ball, phase: 'moving', vx: Math.cos(angle) * (400 + power * 7), vy: Math.sin(angle) * (400 + power * 7), time: 0 });

/** Fixed small steps keep a fast ball from passing through defenders or goalposts. */
export function advanceBall(previous: BallState, elapsed: number, mode: PitchMode): BallState {
    if (previous.phase !== 'moving') return previous;
    const ball = { ...previous };
    const duration = Math.max(0, Math.min(elapsed, .06));
    const steps = Math.max(1, Math.ceil(duration / .004));
    const dt = duration / steps;
    for (let index = 0; index < steps; index++) {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.time += dt;
        const insideGoal = ball.y > 202 && ball.y < 318;
        if (ball.x >= 914 && insideGoal) { ball.phase = 'goal'; ball.vx = 0; ball.vy = 0; return ball; }
        if (ball.x < 57) { ball.x = 57; ball.vx = Math.abs(ball.vx) * .8; }
        if (ball.x > 888 && !insideGoal) { ball.x = 888; ball.vx = -Math.abs(ball.vx) * .8; }
        if (ball.y < 57) { ball.y = 57; ball.vy = Math.abs(ball.vy) * .8; }
        if (ball.y > 463) { ball.y = 463; ball.vy = -Math.abs(ball.vy) * .8; }
        for (const defender of defenders(mode)) {
            const dx = ball.x - defender.x, dy = ball.y - defender.y;
            const distance = Math.hypot(dx, dy);
            const radius = 12 + defender.radius;
            if (distance < radius) {
                const nx = distance > .001 ? dx / distance : -1, ny = distance > .001 ? dy / distance : 0;
                ball.x = defender.x + nx * radius; ball.y = defender.y + ny * radius;
                const dot = ball.vx * nx + ball.vy * ny;
                if (dot < 0) { ball.vx -= 1.85 * dot * nx; ball.vy -= 1.85 * dot * ny; }
            }
        }
        const friction = Math.exp(-.5 * dt);
        ball.vx *= friction; ball.vy *= friction;
        if (Math.hypot(ball.vx, ball.vy) < 28 || ball.time > 9) { ball.phase = 'miss'; ball.vx = 0; ball.vy = 0; return ball; }
    }
    return ball;
}
