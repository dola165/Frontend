import { useRef, useState } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { assertCurrentAuthSession, getAuthSessionId } from '../../../utils/authStorage';
import { post, root, type Bootstrap, type OperationRecord } from '../api';
import { useRecordCreation } from '../useRecordCreation';
import { registrationRoot } from './api';

/** Reuse the canonical create command and its retained key after an editor reload. No second receipt store. */
export function useRegistrationCreation(boot: Pick<Bootstrap, 'clubId' | 'actorId'>, kind: string) {
  const fresh = useRecordCreation(boot, kind);
  const [session] = useState(getAuthSessionId);
  const marker = `gk-record-create:${boot.actorId}:${boot.clubId}:${kind}`;
  const [key] = useState(() => { try { return sessionStorage.getItem(marker); } catch { return null; } });
  const [uncertain, setUncertain] = useState(false);
  const retry = useRef<{ serialized: string; body: unknown } | null>(null);
  const forget = () => { try { if (sessionStorage.getItem(marker) === key) sessionStorage.removeItem(marker); } catch { /* No payload is persisted. */ } };
  const create = async (body: unknown): Promise<OperationRecord> => {
    if (!fresh.blocked || !key) return fresh.create(body);
    assertCurrentAuthSession(session);
    const serialized = JSON.stringify(body);
    if (retry.current && retry.current.serialized !== serialized) throw new Error('Retry the same recovery details or open the saved record.');
    retry.current ??= { serialized, body: JSON.parse(serialized) };
    try {
      const saved = await post<OperationRecord>(`${root(boot.clubId)}/records`, retry.current.body, { 'Idempotency-Key': key }, session);
      forget(); setUncertain(false); return saved;
    } catch (error) {
      const code = (error as { response?: { status?: number } }).response?.status;
      if (code && [400, 401, 403, 404, 422].includes(code)) { retry.current = null; setUncertain(false); }
      else setUncertain(true);
      throw error;
    }
  };
  const recover = async () => {
    assertCurrentAuthSession(session);
    const config: AuthSessionRequestConfig = { _authSessionId: session };
    const outcome = (await apiClient.get<{ id: number }>(`${registrationRoot(boot.clubId)}/creations/${key}`, config)).data;
    const saved = (await apiClient.get<OperationRecord>(`${root(boot.clubId)}/records/${outcome.id}`, config)).data;
    forget(); return saved;
  };
  return { create, recover, recovering: fresh.blocked && !!key, blocked: fresh.blocked && !key,
    uncertain: fresh.uncertain || uncertain, message: fresh.blocked ? 'A previous save was not confirmed. Open its saved outcome, or re-enter the original details to retry the same key. No new request identity will be created.' : fresh.message };
}
