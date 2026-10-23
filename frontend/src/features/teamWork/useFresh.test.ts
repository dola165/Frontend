import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useFresh } from './useFresh';

it('marks nothing on the first load, then only the keys that arrived or moved', () => {
    const { result, rerender } = renderHook(({ keys }: { keys: string[] | null }) => useFresh(keys), { initialProps: { keys: null as string[] | null } });
    expect(result.current.size).toBe(0);
    rerender({ keys: ['1:PLANNED', '2:IN_PROGRESS'] });
    expect(result.current.size).toBe(0);
    rerender({ keys: ['1:PLANNED', '2:NEEDS_LOOK', '3:PLANNED'] });
    expect([...result.current]).toEqual(['2:NEEDS_LOOK', '3:PLANNED']);
    rerender({ keys: ['1:PLANNED', '2:NEEDS_LOOK', '3:PLANNED'] });
    expect([...result.current]).toEqual(['2:NEEDS_LOOK', '3:PLANNED']);
    rerender({ keys: ['1:PLANNED', '2:NEEDS_LOOK'] });
    expect(result.current.size).toBe(0);
});
