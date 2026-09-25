import { useCallback, useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, root, type Bootstrap } from './api';

export function useClubOperations(club: number) {
  const [boot, setBoot] = useState<Bootstrap | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const refresh = useCallback(async () => { const value = await get<Bootstrap>(root(club)); setBoot(value); setError(''); }, [club]);
  useEffect(() => {
    const c = new AbortController();
    void get<Bootstrap>(root(club), c.signal).then(value => { if (!c.signal.aborted) setBoot(value); })
      .catch(e => { if (!c.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load club responsibilities.')); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [club]);
  return { boot, loading, error, refresh };
}
