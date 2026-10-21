/** The set-up steps answered right in Dola's bubble: one or two words, saved through the same actions as the boxes. */
export const QUICK_STEPS = ['name', 'about', 'contact', 'fees'] as const;
export type QuickStep = typeof QUICK_STEPS[number];
export const isQuick = (step: string): step is QuickStep => (QUICK_STEPS as readonly string[]).includes(step);
