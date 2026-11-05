import { useMemo } from 'react';
import { useWorldData } from '../useWorldData';
import type { AnySource } from './types';
import type { DirectoryData } from './useDirectoryData';

/**
 * The chosen result when the loaded pages do not hold it (a club Dola found outside the filters on screen), looked up
 * on its own while the map is open, and the results to put on the map with it. Once a page holds it (more were
 * shown), the list's own copy is used. The rows under the map stay the list's own.
 */
export function useOutsideChoice(source: AnySource, selected: string | undefined, data: DirectoryData, open: boolean) {
    const held = !selected || data.items.some(item => source.key(item) === selected);
    const looking = Boolean(source.one && selected && !held && !data.loading && open);
    const one = useWorldData(looking ? `one|${source.id}|${selected}` : null, signal => source.one!(selected!, { signal }));
    const outside = looking && one.data && source.key(one.data) === selected ? one.data : undefined;
    const items = useMemo(() => outside ? [...data.items, outside] : data.items, [data.items, outside]);
    return { outside, items };
}
