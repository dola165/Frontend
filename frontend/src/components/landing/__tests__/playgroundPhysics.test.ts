import { describe, expect, it } from 'vitest';
import { advanceBall, kick, newBall, type BallState, type PitchMode } from '../playgroundPhysics';

function finish(ball: BallState, mode: PitchMode = 'free', fps = 60) {
    for (let i = 0; i < fps * 12 && ball.phase === 'moving'; i++) ball = advanceBall(ball, 1 / fps, mode);
    return ball;
}

describe('extra-time football physics', () => {
    it('scores a straight free kick at different frame rates', () => {
        for (const fps of [30, 60, 144]) expect(finish(kick(newBall(), 0, 70), 'free', fps).phase).toBe('goal');
    });
    it('bounces away from a defender instead of tunneling through it', () => {
        const result = advanceBall({ ...newBall(), x: 445, y: 246, vx: 1100, phase: 'moving' }, .06, 'rebounds');
        expect(result.x).toBeLessThan(468);
        expect(result.vx).toBeLessThan(0);
        expect(result.phase).toBe('moving');
    });
    it('does not count a shot outside the goal opening', () => {
        const result = advanceBall({ ...newBall(), x: 870, y: 120, vx: 1100, phase: 'moving' }, .06, 'free');
        expect(result.phase).toBe('moving');
        expect(result.vx).toBeLessThan(0);
        expect(result.x).toBeLessThanOrEqual(888);
    });
    it('eventually stops a missed shot and allows a new ball', () => {
        expect(finish(kick(newBall(), -1.3, 10)).phase).toBe('miss');
        expect(newBall()).toMatchObject({ phase: 'ready', vx: 0, vy: 0 });
    });
    it('does not advance a ready or completed ball and clamps background time gaps', () => {
        const ready = newBall();
        expect(advanceBall(ready, 1, 'free')).toBe(ready);
        const moving = kick(ready, 0, 70);
        expect(advanceBall(moving, 20, 'free')).toEqual(advanceBall(moving, .06, 'free'));
        const goal = finish(moving);
        expect(advanceBall(goal, .02, 'free')).toBe(goal);
    });
});
