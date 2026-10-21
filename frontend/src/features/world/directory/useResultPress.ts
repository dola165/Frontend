import type { MouseEvent, ReactNode } from 'react';
import { usePeek } from '../peek/usePeek';

/** Something inside a result that does its own thing (a link, a button, a field). */
const OWN_ACTION = 'a, button, input, select, textarea, label, summary, [role="button"]';

/**
 * Pressing a result (a row, a card): a press anywhere on it shows it beside the list (or in a drawer), except on its
 * own links (its name goes to the full page) and buttons, or while text is being selected. `toggle` is for its details
 * button: it shows the result (from the keyboard, the pane then takes focus), or closes it when it is shown. `shown`: it
 * is shown now.
 */
export function useResultPress(peek?: string) {
    const drawers = usePeek();
    return {
        press: (event: MouseEvent<HTMLElement>) => {
            if (!peek || (event.target as Element).closest(OWN_ACTION) || window.getSelection()?.toString()) return;
            drawers.open(peek);
        },
        toggle: (event: MouseEvent<HTMLElement>) => {
            if (!peek) return;
            if (drawers.value === peek) drawers.closeAll(); else drawers.open(peek, { focus: event.detail === 0 });
        },
        shown: Boolean(peek && drawers.value === peek),
    };
}

/** The lines of a result that say something (no empty ones). */
export const keptLines = (lines: ReactNode[]) => lines.filter(line => line != null && line !== false && line !== '');
