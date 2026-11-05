import { createContext } from 'react';
import type { Pins } from './usePins';

/** What a task's menu can reach where it is shown: your pins, and what to do once a task changed. */
export interface TaskMenuSupport { pins?: Pins; onChanged?: () => void }
export const TaskMenuContext = createContext<TaskMenuSupport>({});
