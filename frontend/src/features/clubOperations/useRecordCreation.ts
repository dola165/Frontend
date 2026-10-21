import { useLayoutEffect, useRef, useState } from 'react';
import { post, root, type Bootstrap, type OperationRecord } from './api';
import { appLanguage } from '../../utils/formatting';
import { assertCurrentAuthSession, getAuthSessionId } from '../../utils/authStorage';

function marker(scope: string) { try { return sessionStorage.getItem(scope); } catch { return null; } }
function remember(scope: string, key: string) { try { sessionStorage.setItem(scope, key); } catch { /* The visible warning tells the person to keep this page open. */ } }
function forget(scope: string, key: string) { try { if (marker(scope) === key) sessionStorage.removeItem(scope); } catch { /* No payload is stored here. */ } }

/** A create response may be lost after persistence. Keep its exact request in this account's
 * component memory. Storage carries only an opaque unresolved marker, never form contents. */
export function useRecordCreation(boot: Pick<Bootstrap, 'clubId' | 'actorId'>, kind: string) {
  const scope = `gk-record-create:${boot.actorId}:${boot.clubId}:${kind}`;
  const [blocked] = useState(() => Boolean(marker(scope)));
  const [uncertain, setUncertain] = useState(false);
  const [authSessionId] = useState(getAuthSessionId);
  const activeScope = useRef<string | null>(scope);
  useLayoutEffect(() => { activeScope.current = scope; return () => { activeScope.current = null; }; }, [scope]);
  const attempt = useRef<{ scope: string; key: string; body: unknown; serialized: string } | null>(null);
  const ka = appLanguage() === 'ka';
  const message = blocked
    ? ka ? 'წინა შენახვა არ დადასტურებულა. გადატვირთვისას დეტალები წაიშალა. ახალი ჩანაწერის შექმნამდე შეამოწმეთ არსებული ჩანაწერები.' : 'A previous save was not confirmed. Reloading cleared its details. Review existing records before creating another.'
    : uncertain ? ka ? 'შენახვის პასუხი არ მოსულა. ჩანაწერი შეიძლება შენახული იყოს. დატოვეთ ეს გვერდი ღია; გამეორება ამავე მოთხოვნას ამოწმებს.' : 'The save response did not arrive. This may already be saved. Keep this page open; retry checks the same request.' : '';
  const create = async (body: unknown) => {
    if (activeScope.current !== scope) throw new Error(ka ? 'ეს ჩანაწერის ფორმა უკვე დახურულია.' : 'This record editor is no longer active.');
    assertCurrentAuthSession(authSessionId);
    if (blocked) throw new Error(message);
    const recovering = attempt.current !== null;
    const serialized = JSON.stringify(body);
    if (attempt.current && (attempt.current.scope !== scope || attempt.current.serialized !== serialized)) throw new Error(ka ? 'წინა მოთხოვნის შედეგი უცნობია. გაიმეორეთ იგივე დეტალები.' : 'The previous save is unresolved. Retry its original details.');
    const request = attempt.current ?? { scope, key: crypto.randomUUID(), body: JSON.parse(serialized), serialized };
    attempt.current = request; remember(scope, request.key);
    try {
      const record = await post<OperationRecord>(`${root(boot.clubId)}/records`, request.body, { 'Idempotency-Key': request.key }, authSessionId);
      attempt.current = null; forget(scope, request.key); setUncertain(false); return record;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      // A definite rejection can be corrected. Unknown outcomes and consumed-key conflicts
      // retain the submitted request; they never silently get another identity.
      if (!recovering && status && [400, 401, 403, 404, 422].includes(status)) { attempt.current = null; forget(scope, request.key); setUncertain(false); }
      else setUncertain(true);
      throw error;
    }
  };
  return { create, blocked, uncertain, message };
}

