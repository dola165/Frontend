import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { isAdult } from '../../../utils/age';
import { appLanguage } from '../../../utils/formatting';
import { clearSetupRecovery, isRecord, isRequestId, readSetupRecovery, writeSetupRecovery } from '../../organizations/setup/setupRecovery';
import type { Town } from '../../start/towns';
import { useOtherClub } from '../../clubOperations/leaving/useOtherClub';
import { createPage, type CreatedPage, type CreateRequest, type SimilarPage } from '../api';
import { pt } from '../copy';
import { DEFAULT_CLUB_CATEGORY, isPageKind, ORGANIZATION_TYPE, type BusinessKind, type PageKind } from '../model/kinds';

interface Pending { requestId: string; body: CreateRequest }
const RECOVERY = 'page-create';
const validPending = (value: unknown): value is Pending =>
  isRecord(value) && isRequestId(value.requestId) && isRecord(value.body) && typeof value.body.displayName === 'string' && isPageKind(value.body.pageKind);


/** The new page in edit mode; or, for an organiser set up from the Draw room, the Draw room with it chosen. */
export const pageDestination = (created: CreatedPage, draw: boolean) => (draw ? `/world/tournaments?peek=draw-o${created.id}` : `${created.profilePath}?edit=1&new=1`);

export type CreateOutcome = { kind: 'created'; created: CreatedPage } | { kind: 'exists'; match: SimilarPage } | { kind: 'failed' };

/**
 * The one create action: the start sheet, Agent Dola and tests all go through it. Idempotent on a weak connection:
 * the request is saved with its id before it is sent, and a retry with the same name reuses it, so two pages are
 * never created. Under-age accounts are refused here and by the server.
 */
type CreateArgs = { kind: PageKind; name: string; town: Town | null; draw?: boolean; business?: BusinessKind | null };

export function useCreatePage() {
  const { user, refreshNavigationCapabilities } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(() => readSetupRecovery(user?.id, RECOVERY, validPending));
  // Staff means one club (release 7): starting a club while staff elsewhere asks "Leave {club} first", then tries again.
  const other = useOtherClub();
  const again = useRef<((args: CreateArgs) => Promise<CreateOutcome>) | null>(null);

  const create = useCallback(async ({ kind, name, town, draw = false, business = null }: CreateArgs): Promise<CreateOutcome> => {
    if (busy) return { kind: 'failed' };
    const displayName = name.trim().replace(/\s+/g, ' ');
    if (!isAdult(user?.dob)) { setError(pt('Pages are for adults. Ask an adult at your club to create it and invite you.')); return { kind: 'failed' }; }
    const same = pending && pending.body.displayName === displayName && pending.body.pageKind === kind && (pending.body.businessKind ?? null) === business ? pending : null;
    const requestId = same?.requestId ?? crypto.randomUUID();
    const request: Pending = same ?? { requestId, body: { requestId, displayName, pageKind: kind, organizationType: ORGANIZATION_TYPE[kind], clubCategory: kind === 'CLUB' ? DEFAULT_CLUB_CATEGORY : null,
      ...(business ? { businessKind: business } : {}), venueEnabled: false, tournamentEnabled: draw, location: town ? { latitude: town.latitude, longitude: town.longitude, city: town.name } : null, language: appLanguage() === 'ka' ? 'ka' : 'en' } };
    // Saved before sending: leaving the page can never turn an unanswered request into a fresh one.
    writeSetupRecovery(user?.id, RECOVERY, request);
    setPending(request);
    setBusy(true); setError('');
    try {
      const created = await createPage(request.body);
      clearSetupRecovery(user?.id, RECOVERY); setPending(null);
      navigate(pageDestination(created, draw));
      void refreshNavigationCapabilities().catch(() => undefined);
      return { kind: 'created', created };
    } catch (failure) {
      const response = (failure as { response?: { status?: number; data?: { code?: string; match?: SimilarPage } } }).response;
      const settled = response?.status != null && response.status < 500;
      if (settled) { clearSetupRecovery(user?.id, RECOVERY); setPending(null); }
      if (response?.status === 409 && response.data?.code === 'PAGE_EXISTS' && response.data.match) return { kind: 'exists', match: response.data.match };
      if (other.catchOther(failure, () => void again.current?.({ kind, name, town, draw, business }))) return { kind: 'failed' };
      if (promptEmailConfirmation(failure)) return { kind: 'failed' };
      setError(extractApiErrorMessage(failure, pt(settled ? 'Could not create the page. Try again: nothing is lost.' : 'The last try was not answered. Try again with the same name; it never makes two pages.')));
      return { kind: 'failed' };
    } finally { setBusy(false); }
  }, [busy, navigate, pending, refreshNavigationCapabilities, user?.dob, user?.id, other]);
  useEffect(() => { again.current = create; }, [create]);

  return { create, busy, error, clearError: () => setError(''), unanswered: pending !== null, otherClub: other.notice };
}
