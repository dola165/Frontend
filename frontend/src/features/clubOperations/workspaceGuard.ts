/**
 * Moves within a workspace only when no open editor objects. Editors listen for `club-workspace-navigate`
 * (see `useClubEditorClose`) and cancel it to ask about unsaved changes; `proceed` runs once they allow it.
 */
export function guardWorkspaceNavigation(proceed: () => void) {
    if (window.dispatchEvent(new CustomEvent('club-workspace-navigate', { cancelable: true, detail: { proceed } }))) proceed();
}
