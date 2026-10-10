import { createContext } from 'react';

/**
 * Moves within a workspace only when no open editor objects. Editors listen for `club-workspace-navigate`
 * (see `useClubEditorClose`) and cancel it to ask about unsaved changes; `proceed` runs once they allow it.
 * With a `scope`, only editors inside that scope are asked (closing a drawer asks its form, not the page's).
 */
export function guardWorkspaceNavigation(proceed: () => void, scope?: string) {
    if (window.dispatchEvent(new CustomEvent('club-workspace-navigate', { cancelable: true, detail: { proceed, scope } }))) proceed();
}

/** The scope editors below it belong to, such as a tool drawer (`tool`). */
export const EditorScope = createContext<string | undefined>(undefined);
