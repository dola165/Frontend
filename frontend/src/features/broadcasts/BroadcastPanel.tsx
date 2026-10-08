import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { isCurrentAuthSession } from '../../utils/authStorage';
import type { Match } from '../matchExchange/api';
import { broadcastRequest, safePlayerUrl, type Broadcast, type Playback, type Workspace } from './api';
import { StreamPlayer } from './StreamPlayer';
import './broadcasts.css';

const states: Record<Broadcast['state'], string> = { DRAFT: 'Preparation saved', SCHEDULED: 'Waiting for camera', LIVE: 'Live at last check', INTERRUPTED: 'Source offline or processing', REPLAY_READY: 'Replay available at last check', REMOVED: 'Removed' };
export function BroadcastPanel({ match }: { match: Match }) {
  const { sessionId } = useAuth();
  return <Panel key={`${sessionId}:${match.event_id}`} match={match} />;
}
function Panel({ match }: { match: Match }) {
  const { sessionId } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [squadId, setSquadId] = useState('');
  const [title, setTitle] = useState(match.title);
  const [rights, setRights] = useState(false);
  const identity = useRef<{ payload: string; id: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); abort.current = controller;
    void broadcastRequest<Workspace>('get', `/match-exchange/${match.event_id}/broadcasts`, sessionId, controller.signal)
      .then(data => { if (!controller.signal.aborted) { setWorkspace(data); setError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setError(extractApiErrorMessage(cause, 'Could not load broadcasts.')); });
    return () => controller.abort();
  }, [match.event_id, sessionId, refresh]);
  async function prepare() {
    if (busy || !abort.current || !isCurrentAuthSession(sessionId)) return;
    const firstAvailable = workspace?.manageableSquads.find(s => !workspace.broadcasts.some(b => b.squadId === s.id));
    const payload = { squadId: Number(squadId || firstAvailable?.id), title: title.trim(), rightsConfirmed: rights };
    const key = JSON.stringify(payload);
    if (identity.current?.payload !== key) identity.current = { payload: key, id: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      await broadcastRequest('post', `/match-exchange/${match.event_id}/broadcasts`, sessionId, abort.current.signal, { ...payload, requestId: identity.current.id });
      if (isCurrentAuthSession(sessionId)) { identity.current = null; setRights(false); setRefresh(n => n + 1); }
    } catch (cause) { if (isCurrentAuthSession(sessionId)) setError(extractApiErrorMessage(cause, 'Could not save broadcast preparation.')); }
    finally { if (isCurrentAuthSession(sessionId)) setBusy(false); }
  }
  const squads = workspace?.manageableSquads.filter(s => !workspace.broadcasts.some(b => b.squadId === s.id)) || [];
  return <section id="broadcasts" className="mx-panel broadcast-panel" aria-labelledby="broadcast-heading">
    <h2 id="broadcast-heading">Match broadcast</h2>
    <p>Watch this match here when its broadcast is ready. Viewing follows the match’s access rules.</p>
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setRefresh(n => n + 1)}>Reload broadcasts</button></div>}
    {!workspace && !error && <p role="status">Loading broadcasts…</p>}
    {workspace?.broadcasts.map(b => <BroadcastCard key={`${b.id}:${b.revision}`} broadcast={b} changed={() => setRefresh(n => n + 1)} />)}
    {workspace && !workspace.broadcasts.length && <p>No broadcast has been shared yet.</p>}
    {squads.length > 0 && <details className="broadcast-prepare"><summary>Prepare a broadcast</summary>
      <form onSubmit={event => { event.preventDefault(); void prepare(); }}>
        <label>Broadcasting squad<select value={squadId || squads[0].id} onChange={e => setSquadId(e.target.value)}>{squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Broadcast title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={140} required /></label>
        <label className="broadcast-consent"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} required />I confirm the club has permission to film and share this match with its permitted viewers, including any required permission for children.</label>
        <p>Save preparation now. Streaming can be activated once the club’s streaming account is ready.</p>
        <button type="submit" disabled={busy || !rights}>{busy ? 'Saving…' : 'Save broadcast preparation'}</button>
      </form>
    </details>}
  </section>;
}
function BroadcastCard({ broadcast: b, changed }: { broadcast: Broadcast; changed: () => void }) {
  const { sessionId } = useAuth();
  const [inputId, setInputId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [watch, setWatch] = useState(false);
  const [playback, setPlayback] = useState<Playback>();
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { controller.current = new AbortController(); return () => controller.current?.abort(); }, []);
  useEffect(() => {
    if (!watch) return;
    const abort = new AbortController();
    let renew: ReturnType<typeof setTimeout>;
    let expiry: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const value = await broadcastRequest<Playback>('post', `/broadcasts/${b.id}/playback`, sessionId, abort.signal, {});
        safePlayerUrl(value);
        if (abort.signal.aborted) return;
        setPlayback(value); setError('');
        const remaining = new Date(value.expiresAt).getTime() - Date.now();
        clearTimeout(expiry);
        expiry = setTimeout(() => { setPlayback(undefined); setError('Viewing authorization expired. Retry to check access again.'); abort.abort(); }, remaining);
        renew = setTimeout(() => { void load(); }, Math.max(10000, remaining - 60000));
      } catch (cause) {
        if (!abort.signal.aborted) { setPlayback(undefined); setError(extractApiErrorMessage(cause, 'Could not open the stream.')); }
      }
    }
    void load();
    return () => { abort.abort(); clearTimeout(renew); clearTimeout(expiry); };
  }, [watch, b.id, sessionId, attempt]);
  async function action(name: 'source' | 'refresh' | 'remove') {
    if (busy || !controller.current) return;
    setBusy(true); setError('');
    try {
      await broadcastRequest(name === 'source' ? 'put' : 'post', `/broadcasts/${b.id}/${name}`, sessionId, controller.current.signal, { revision: b.revision, ...(name === 'source' ? { inputId: inputId.trim() } : {}) });
      if (isCurrentAuthSession(sessionId)) changed();
    } catch (cause) { if (isCurrentAuthSession(sessionId)) setError(extractApiErrorMessage(cause, 'The broadcast could not be updated. Reload and try again.')); }
    finally { if (isCurrentAuthSession(sessionId)) setBusy(false); }
  }
  return <article id={`broadcast-${b.id}`} className="broadcast-card">
    <h3>{b.title}</h3><p>{states[b.state]}{b.checkedAt && ` · Checked ${new Date(b.checkedAt).toLocaleString()}`}</p>
    <a href={`/match-exchange/${b.eventId}#broadcast-${b.id}`}>Open this broadcast’s match</a>
    {!b.streamingEnabled && <p>Preparation is saved. Streaming activation is pending.</p>}
    {error && <p role="alert">{error}</p>}
    {b.streamingEnabled && b.sourceRevision > 0 && <div className="mx-actions"><button type="button" onClick={() => { setWatch(true); setAttempt(n => n + 1); }}>Watch broadcast</button>{watch && <button type="button" onClick={() => { setWatch(false); setPlayback(undefined); }}>Close video</button>}</div>}
    {watch && (playback ? <StreamPlayer key={playback.iframeUrl} playback={playback} title={b.title} retry={() => { setPlayback(undefined); setAttempt(n => n + 1); }} /> : !error && <p role="status">Checking viewing access…</p>)}
    {b.canManage && <details><summary>Broadcast settings</summary>
      <p>This broadcast is available to people who can view the match. This is separate from permission to film it.</p>
      <p>Setup reference: <code>{b.setupName}</code></p>
      {b.streamingEnabled && <>
        <p>Use one dedicated Cloudflare Live Input with this exact name, automatic recording and signed playback. Keep the stream key in your broadcaster.</p>
        <form onSubmit={e => { e.preventDefault(); void action('source'); }}><label>Dedicated Live Input ID<input value={inputId} onChange={e => setInputId(e.target.value)} pattern="[a-f0-9]{32}" required autoComplete="off" /></label><button disabled={busy} type="submit">Attach source</button></form>
        {b.sourceRevision > 0 && <button disabled={busy} type="button" onClick={() => { void action('refresh'); }}>Check camera and recording</button>}
      </>}
      <p>Removing this broadcast stops new viewing access. Stop the camera separately to stop streaming and recording charges. Existing viewing access can last up to five minutes.</p>
      <button disabled={busy} type="button" onClick={() => { void action('remove'); }}>Remove broadcast from match</button>
    </details>}
  </article>;
}
