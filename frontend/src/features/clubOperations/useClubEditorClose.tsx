import { useContext, useEffect, useState } from 'react';
import { DiscardPrompt } from './records/DiscardPrompt';
import { EditorScope } from './workspaceGuard';

/** Unsaved sensitive fields stay in component memory; navigation asks before discarding. */
export function useClubEditorClose(dirty: boolean, busy: boolean, onClose: () => void) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const scope = useContext(EditorScope);
  useEffect(() => {
    const navigate = (event: Event) => {
      const asked = (event as CustomEvent<{ scope?: string }>).detail?.scope;
      if (!dirty && !busy || asked && asked !== scope) return;
      event.preventDefault();
      if (!busy) setPending(() => (event as CustomEvent<{ proceed: () => void }>).detail.proceed);
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('club-workspace-navigate', navigate);
    window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('club-workspace-navigate', navigate); window.removeEventListener('beforeunload', unload); };
  }, [dirty, busy, scope]);
  return {
    /**
     * Closes the editor, asking first when there are unsaved changes. A function argument replaces the close,
     * for example to discard only a sub-form; anything else (such as a click event) is ignored.
     */
    requestClose: (then?: unknown) => {
      const proceed = typeof then === 'function' ? then as () => void : onClose;
      if (busy) return;
      if (dirty) setPending(() => proceed); else proceed();
    },
    confirmation: pending ? <DiscardPrompt disabled={busy} onKeepEditing={() => setPending(null)} onDiscard={() => { const proceed = pending; setPending(null); proceed(); }} /> : undefined,
  };
}
