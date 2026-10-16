import { defaultBoxes } from '../boxes/defaultBoxes';
import type { BoxRenderers } from '../edit/boxRegistry';

/**
 * The club page in edit mode draws its boxes with the page DNA's views (the same blocks the club page shows
 * visitors, drawn by the Home chat, stay in view mode). Replace a view here to show the club page's own block
 * in edit mode too, keeping the ghost and the editor.
 */
export const clubBoxes: BoxRenderers = { ...defaultBoxes };
