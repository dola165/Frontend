import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDolaPanelSize } from './useDolaPanelSize';

const viewport = (width: number) => { Object.defineProperty(window, 'innerWidth', { value: width, configurable: true }); window.dispatchEvent(new Event('resize')); };
beforeEach(() => { localStorage.clear(); viewport(1440); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('Dola panel size', () => {
    it('persists width per account and clamps it without losing the larger-screen preference', () => {
        const hook = renderHook(() => useDolaPanelSize(7));
        act(() => hook.result.current.setWidth(850));
        act(() => vi.advanceTimersByTime(160));
        expect(localStorage.getItem('gk-dola-width:7')).toBe('850');
        act(() => viewport(1100));
        expect(hook.result.current.width).toBe(620);
        act(() => viewport(1920));
        expect(hook.result.current.width).toBe(850);
        hook.unmount();
        expect(renderHook(() => useDolaPanelSize(7)).result.current.width).toBe(850);
        expect(renderHook(() => useDolaPanelSize(8)).result.current.width).toBe(420);
    });
    it('bounds dragging, adapts page layout and resets to the responsive default', () => {
        const { result } = renderHook(() => useDolaPanelSize(7));
        expect(result.current.layout).toBe('both');
        act(() => result.current.setWidth(2000));
        expect(result.current.width).toBe(900); expect(result.current.layout).toBe('compact');
        act(() => result.current.setWidth(-20));
        expect(result.current.width).toBe(340);
        act(() => result.current.reset());
        expect(result.current.width).toBe(389);
        act(() => viewport(390));
        expect(result.current.resizable).toBe(false);
    });
    it('ignores invalid preferences', () => {
        localStorage.setItem('gk-dola-width:7', 'Infinity');
        expect(renderHook(() => useDolaPanelSize(7)).result.current.width).toBe(389);
    });
});
