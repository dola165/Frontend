import type { WorkItem } from './api';

/**
 * What waits on the owner: tasks that need his look, and tasks carrying a question nobody has answered. The tabs
 * count them; Part 2 puts them on top.
 */
export const needsYou = (items: WorkItem[]) => items.filter(item => item.status === 'NEEDS_LOOK' || item.openQuestions > 0);
export const needsYouCount = (items: WorkItem[]) => needsYou(items).reduce((count, item) => count + (item.status === 'NEEDS_LOOK' ? 1 : 0) + item.openQuestions, 0);
