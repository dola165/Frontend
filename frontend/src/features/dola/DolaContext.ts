import { createContext, useContext } from 'react';
import type { DolaState } from './DolaProvider';

export const DolaContext = createContext<DolaState | null>(null);
export function useDola() {
    const context = useContext(DolaContext);
    if (!context) throw new Error('DolaProvider is required');
    return context;
}
