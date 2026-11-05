import { useContext, type ReactNode } from 'react';
import { TaskMenuContext, type TaskMenuSupport } from './taskMenuContext';

/** Gives the task menus under it your pins and a way to refresh, on top of what an outer provider gives. */
export function TaskMenuProvider({ pins, onChanged, children }: TaskMenuSupport & { children: ReactNode }) {
    const outer = useContext(TaskMenuContext);
    return <TaskMenuContext.Provider value={{ pins: pins ?? outer.pins, onChanged: onChanged ?? outer.onChanged }}>{children}</TaskMenuContext.Provider>;
}
