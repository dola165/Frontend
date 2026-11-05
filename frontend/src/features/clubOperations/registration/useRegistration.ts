import { useCallback, useEffect, useRef, useState } from 'react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { getAuthSessionId } from '../../../utils/authStorage';
import { loadRegistration, type RegistrationProfile } from './api';

export function useRegistration(club: number, person: number, squad: number | null) {
  const [data, setData] = useState<RegistrationProfile | null>(null), [error, setError] = useState('');
  const [session] = useState(getAuthSessionId);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setError(''); setData(null);
    try {
      const value = await loadRegistration(club, person, squad, controller.signal, session);
      if (!controller.signal.aborted) setData(value);
    } catch (e) { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Registration records could not load.')); }
  }, [club, person, squad, session]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => { clearTimeout(timer); request.current?.abort(); }; }, [load]);
  return { data, error, load };
}
