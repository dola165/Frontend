import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigationCapability } from '../../context/useNavigationCapability';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, root, type Bootstrap } from './api';
import { withoutLife } from './life';

export function useClubOperations(club: number) {
  const [boot, setBoot] = useState<Bootstrap | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  // Life is held back in release 17 until the server lists `care.life`: no tool, switch or record of it shows.
  const life = useNavigationCapability('care.life') === true;
  const refresh = useCallback(async () => { const value = await get<Bootstrap>(root(club)); setBoot(value); setError(''); }, [club]);
  useEffect(() => {
    const c = new AbortController();
    void get<Bootstrap>(root(club), c.signal).then(value => { if (!c.signal.aborted) setBoot(value); })
      .catch(e => { if (!c.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load club responsibilities.')); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [club]);
  const shown = useMemo(() => (boot && !life ? withoutLife(boot) : boot), [boot, life]);
  return { boot: shown, loading, error, refresh };
}
