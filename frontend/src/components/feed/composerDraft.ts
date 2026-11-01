import { useOwnedDraft } from '../../utils/ownedDraft';
import type { AuthSessionId } from '../../utils/authStorage';

/** Caption and intended author travel together; a later login cannot revive this login's draft. */
export function useComposerDraft(identity: string, sessionId: AuthSessionId) {
  const empty = { content: '', authorKey: null as string | null, authorName: '', sessionId };
  const owned = useOwnedDraft(`post-composer.${identity}`, empty);
  const draft = owned.draft.sessionId === sessionId ? owned.draft : empty;
  return { draft, reset: owned.reset, change: (patch: Partial<typeof empty>) => owned.change({ ...draft, ...patch, sessionId }) };
}
