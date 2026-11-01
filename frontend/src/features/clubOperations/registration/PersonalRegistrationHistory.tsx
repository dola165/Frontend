import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Field } from '../../../design/primitives';
import { assertCurrentAuthSession, getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { loadRegistrationScopes, type RegistrationScope } from './api';
import { PersonalRegistration } from './RegistrationPanel';
import './registration.css';

/** Private self/selected-child entry. Choices come from retained domain records, including departed clubs. */
export function PersonalRegistrationHistory({ person }: { person: number }) {
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  return <HistorySession key={`${session}:${person}`} person={person} session={session} />;
}
function HistorySession({ person, session }: { person: number; session: ReturnType<typeof getAuthSessionId> }) {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false), [scopes, setScopes] = useState<RegistrationScope[] | null>(null);
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadRegistrationScopes(person, controller.signal, session).then(value => {
      assertCurrentAuthSession(session); if (!controller.signal.aborted) { setScopes(value); setError(''); }
    }).catch(e => { if (!controller.signal.aborted) { setScopes(null); setError(extractApiErrorMessage(e, 'Registration history could not load.')); } });
    return () => controller.abort();
  }, [person, session, open, attempt]);
  const keyOf = (scope: RegistrationScope) => `${person}:${scope.clubId}:${scope.squadId ?? 'club'}`;
  const chosen = scopes?.find(scope => keyOf(scope) === params.get('registrationScope')) ?? scopes?.[0];
  return <details className="registration registration__personal" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Registration and eligibility history</summary>
    {open && <>{error ? <div role="alert"><p>{error}</p><Button onClick={() => setAttempt(value => value + 1)}>Try again</Button></div>
      : !scopes ? <p role="status">Loading registration history…</p>
        : !scopes.length ? <p>No club registration history is available to this account.</p>
          : <><Field label="Club and record scope" htmlFor={`registration-history-${person}`}><select className="gk-input" id={`registration-history-${person}`} title={chosen ? `${chosen.clubName} · ${chosen.squadName ?? 'Whole club records'}` : undefined} value={chosen ? keyOf(chosen) : ''} onChange={event => {
            const next = new URLSearchParams(params); next.set('registrationScope', event.target.value); setParams(next, { replace: true });
          }}>{scopes.map(scope => <option key={keyOf(scope)} value={keyOf(scope)}>{scope.clubName} · {scope.squadName ?? (scope.squadId ? `Earlier squad #${scope.squadId}` : 'Whole club records')}</option>)}</select></Field>
            {chosen && <PersonalRegistration club={chosen.clubId} person={person} squad={chosen.squadId} />}</>}</>}
  </details>;
}
