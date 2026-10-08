import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';

type EligibilityRequest = { actor: number | null; enabled: boolean; revision: number };
type EligibilityState = {
  request: EligibilityRequest;
  status: 'ready' | 'error';
  eligible: boolean;
};

/** The registration command rechecks this private domain hint when submitted. */
export function usePlayerEntryEligibility(actor: number | null, enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<EligibilityState | null>(null);
  const request = useMemo(() => ({ actor, enabled, revision }), [actor, enabled, revision]);
  useEffect(() => {
    if (!request.enabled || request.actor == null) return;
    const controller = new AbortController();
    apiClient.get<{ eligible: boolean }>('/competitions/player-eligibility', { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (typeof data?.eligible !== 'boolean') throw new Error('Missing player eligibility');
        setState({ request, status: 'ready', eligible: data.eligible });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ request, status: 'error', eligible: false });
      });
    return () => controller.abort();
  }, [request]);
  const current = state?.request === request ? state : null;
  return {
    eligible: current?.status === 'ready' && current.eligible,
    status: !enabled || actor == null ? 'inactive' : current?.status ?? 'pending',
    retry: () => setRevision(value => value + 1),
  };
}
