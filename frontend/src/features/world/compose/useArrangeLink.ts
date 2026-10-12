import { peekClick, usePeek } from '../peek/usePeek';
import { arrangePath, arrangePeek, type ArrangeSeed } from './arrangeSeed';

/**
 * A link that opens Arrange a match where the person is (beside the list, or in the drawer over the page), filled in
 * from what it was pressed on; with a modifier, or outside World, it opens World's Matches with the form instead.
 */
export function useArrangeLink() {
    const drawers = usePeek();
    return (seed: ArrangeSeed) => ({ to: arrangePath(seed), onClick: peekClick(arrangePeek(seed), drawers.open) });
}
