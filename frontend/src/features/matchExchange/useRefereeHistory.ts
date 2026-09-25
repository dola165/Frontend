import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';

/** Owner-only records must never survive an account or exact-destination change. */
export function useRefereeHistory<T>(path: string) {
  const { sessionId } = useAuth();
  const key = `${sessionId}:${path}`;
  const [result, setResult] = useState<{ key: string; data?: T; error: string }>();
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let loading = false;
    const refresh = async () => {
      if (loading || controller.signal.aborted || document.visibilityState === 'hidden') return;
      loading = true;
      const config: AuthSessionRequestConfig = { signal: controller.signal, _authSessionId: sessionId };
      try {
        const response = await apiClient.get<T>(path, config);
        if (!controller.signal.aborted) setResult({ key, data: response.data, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted) setResult(current => ({
          key,
          data: isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0)
            ? undefined : current?.key === key ? current.data : undefined,
          error: extractApiErrorMessage(cause, 'Could not load your referee history.'),
        }));
      } finally { loading = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [key, path, revision, sessionId]);
  return { data: result?.key === key ? result.data : undefined, error: result?.key === key ? result.error : '', reload };
}
