import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PlacedResults } from '../directory/mapPoints';
import { useDirectorySelection } from '../directory/useDirectorySelection';

type Placed = Pick<PlacedResults, 'pinOf' | 'keysOf' | 'points'>;
// Result 1 has its own pin; results 2 and 3 share one.
const placed = (ids = ['p1', 'p2']): Placed => ({
    pinOf: new Map([['1', 'p1'], ['2', 'p2'], ['3', 'p2']]), keysOf: new Map([['p1', ['1']], ['p2', ['2', '3']]]),
    points: ids.map(id => ({ id, lat: 41.7, lng: 44.8, label: id, tone: 'club' })),
});
function useChoice({ initial, pins = placed(), panel = null }: { initial?: string; pins?: Placed; panel?: HTMLElement | null }) {
    const [selected, setSelected] = useState(initial);
    return useDirectorySelection({ state: { selected, setSelected }, keys: ['1', '2', '3'], placed: pins, panel, list: { current: null } });
}

describe('choosing a result', () => {
    it('flies to a chosen result and keeps "Show all" on offer after the flight, until every pin is framed again', () => {
        const { result } = renderHook(useChoice, { initialProps: {} });
        act(() => result.current.choose('1'));
        expect(result.current.focus).toMatchObject({ id: 'p1' });
        expect(result.current.away).toBe(true);
        act(() => result.current.clear());
        expect(result.current.chosen).toBeUndefined();
        expect(result.current.focus).toBeUndefined();
        expect(result.current.away).toBe(true);
        const frame = result.current.frame;
        act(() => result.current.showAll());
        expect(result.current.away).toBe(false);
        expect(result.current.frame).toBe(frame + 1);
    });

    it('lets new pins end the offer, as they frame the map themselves', () => {
        const { result, rerender } = renderHook(useChoice, { initialProps: {} });
        act(() => result.current.choose('1'));
        act(() => result.current.selectPin('p2'));
        expect(result.current.away).toBe(true);
        rerender({ pins: placed(['p1', 'p2', 'p3']) });
        expect(result.current.away).toBe(false);
    });

    it('chooses the one result on a pressed pin, or lights several, without flying', () => {
        const { result } = renderHook(useChoice, { initialProps: {} });
        act(() => result.current.selectPin('p1'));
        expect(result.current.chosen).toBe('1');
        expect(result.current.focus).toBeUndefined();
        expect(result.current.away).toBe(false);
        act(() => result.current.selectPin('p2'));
        expect(result.current.chosen).toBeUndefined();
        expect(result.current.selectedPin).toBe('p2');
    });

    it('never repeats a flight another list made, so the same choice flies again after the list changes', () => {
        const first = renderHook(useChoice, { initialProps: {} });
        act(() => first.result.current.choose('1'));
        const token = first.result.current.focus!.token;
        first.unmount();
        const second = renderHook(useChoice, { initialProps: {} });
        act(() => second.result.current.choose('1'));
        expect(second.result.current.focus!.token).not.toBe(token);
        // A link that arrives with a choice flies to it too.
        expect(renderHook(useChoice, { initialProps: { initial: '1' } }).result.current.focus).toMatchObject({ id: 'p1' });
    });

    it('brings the chosen row into view whenever the panel opens on it', () => {
        const panel = document.createElement('div');
        panel.innerHTML = '<div class="gk-browse__body"><ul><li><button aria-current="true">Club 1</button></li></ul></div>';
        const body = panel.querySelector<HTMLElement>('.gk-browse__body')!;
        body.scrollTo = vi.fn() as typeof body.scrollTo;
        body.getBoundingClientRect = () => ({ top: 0, bottom: 100, height: 100 }) as DOMRect;
        panel.querySelector('button')!.getBoundingClientRect = () => ({ top: 300, bottom: 340, height: 40 }) as DOMRect;
        const { rerender } = renderHook(useChoice, { initialProps: { initial: '1', panel: null as HTMLElement | null } });
        expect(body.scrollTo).not.toHaveBeenCalled();
        rerender({ initial: '1', panel });
        expect(body.scrollTo).toHaveBeenCalledTimes(1);
        rerender({ initial: '1', panel: null });
        rerender({ initial: '1', panel });
        expect(body.scrollTo).toHaveBeenCalledTimes(2);
    });
});
