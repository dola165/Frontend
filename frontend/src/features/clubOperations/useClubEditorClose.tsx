import { useEffect, useState } from 'react';
import { EditorDiscardPrompt } from '../../components/workspace/editor/WorkspaceEditor';

/** Unsaved sensitive fields stay in component memory; navigation asks before discarding. */
export function useClubEditorClose(dirty: boolean, busy: boolean, onClose: () => void) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  useEffect(() => {
    const navigate = (event: Event) => {
      if (!dirty && !busy) return;
      event.preventDefault();
      if (!busy) setPending(() => (event as CustomEvent<{ proceed: () => void }>).detail.proceed);
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('club-workspace-navigate', navigate);
    window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('club-workspace-navigate', navigate); window.removeEventListener('beforeunload', unload); };
  }, [dirty, busy]);
  return {
    requestClose: () => { if (busy) return; if (dirty) setPending(() => onClose); else onClose(); },
    confirmation: pending ? <EditorDiscardPrompt disabled={busy} onKeepEditing={() => setPending(null)} onDiscard={() => { const proceed = pending; setPending(null); proceed(); }} /> : undefined,
  };
}
