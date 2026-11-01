import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { get, root, type Choice, type OperationRecord } from '../api';
import { assertCurrentAuthSession, getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';

export type CareRecord = OperationRecord & { consentCurrent?: boolean; created_by?: number };
export interface PlayerCare { module: string; decisionMakers: Choice[]; records: CareRecord[]; usableConsents: CareRecord[]; historyLimit: string }
interface Result { key: string; data: PlayerCare | null; selected: CareRecord | null; error: string }
type ContextResult = { data: PlayerCare } | { failure: unknown };
const unavailableRecord = 'This record is unavailable under your current access and consent.';
function statusOf(failure: unknown) { return (failure as { response?: { status?: number } } | null)?.response?.status; }
function unavailable(failure: unknown) { return statusOf(failure) === 403 || statusOf(failure) === 404; }

export function usePrivateCare(club: number, squad: number, person: number, module: string, record: number | null) {
  const [result, setResult] = useState<Result | null>(null);
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  const pending = useRef<AbortController | null>(null);
  const key = JSON.stringify([session, club, squad, person, module, record]);
  const request = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    let authenticationDenied = false;
    const active = () => pending.current === controller && !controller.signal.aborted && isCurrentAuthSession(session);
    const mayPublish = () => active() && !authenticationDenied;
    const publish = (value: Omit<Result, 'key'>) => {
      if (mayPublish()) setResult(previous => mayPublish() ? { key, ...value } : previous);
    };
    const failed = (failure: unknown, denied = false) => {
      const mayFail = () => active() && (denied || !authenticationDenied);
      if (mayFail()) setResult(previous => mayFail() ? {
        key, data: null, selected: denied ? null : previous?.key === key ? previous.selected : null,
        error: denied ? unavailableRecord : extractApiErrorMessage(failure, 'Care information could not load. Keep your edits and retry.'),
      } : previous);
    };
    // Keep only this same session/record's in-memory edit during a retry. A denial clears it.
    setResult(previous => previous?.key === key && previous.selected ? { ...previous, data: null, error: '' } : null);
    try {
      assertCurrentAuthSession(session);
      const context: Promise<ContextResult> = get<PlayerCare>(`${root(club)}/care/players/${person}?squad=${squad}&module=${module}`, controller.signal)
        .then(data => ({ data }), failure => {
          if (statusOf(failure) === 401) { authenticationDenied = true; failed(failure, true); }
          return { failure };
        });
      let selected: CareRecord | null = null;
      if (record) {
        try {
          const direct = await get<CareRecord>(`${root(club)}/records/${record}`, controller.signal);
          assertCurrentAuthSession(session);
          const family = direct?.module === module || module === 'MEDICAL' && direct?.module === 'AVAILABILITY' && direct.kind === 'RESTRICTION';
          if (!direct || direct.id !== record || direct.club_id !== club || direct.squad_id !== squad || direct.subject_user_id !== person || !family) {
            publish({ data: null, selected: null, error: unavailableRecord }); return;
          }
          selected = direct;
          publish({ data: null, selected, error: '' });
        } catch (failure) { failed(failure, statusOf(failure) === 401 || unavailable(failure)); return; }
      }
      const outcome = await context;
      assertCurrentAuthSession(session);
      if ('data' in outcome) {
        if (outcome.data.module !== module) throw new Error('Care context does not match this care family. Retry to refresh it.');
        publish({ data: outcome.data, selected, error: '' });
      } else if (selected && unavailable(outcome.failure)) {
        publish({ data: null, selected, error: '' });
      } else failed(outcome.failure, selected !== null && statusOf(outcome.failure) === 401);
    } catch (failure) { failed(failure); }
  }, [club, squad, person, module, record, session, key]);
  useEffect(() => { void request(); return () => pending.current?.abort(); }, [request]);
  const current = result?.key === key ? result : null;
  return { data: current?.data ?? null, selected: current?.selected ?? null, error: current?.error ?? '', load: request };
}
