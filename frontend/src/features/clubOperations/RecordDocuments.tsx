import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FileText, Upload } from 'lucide-react';
import { assertCurrentAuthSession, getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { Button, EmptyNote, List, ListRow } from '../../design/primitives';
import { get, root } from './api';

interface Document { id: number; file_name: string; bytes: number; created_at: string }

/** Private supporting documents of one record: only people with access to the record can open them. */
export function RecordDocuments(props: { club: number; record: number; canUpload: boolean }) {
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  return <DocumentSession key={String(session) + ':' + props.club + ':' + props.record} {...props} />;
}
function DocumentSession({ club, record, canUpload }: { club: number; record: number; canUpload: boolean }) {
  const [session] = useState(getAuthSessionId);
  const active = useRef(true), uploading = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [items, setItems] = useState<Document[]>([]), [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const path = `${root(club)}/records/${record}/documents`;
  useEffect(() => {
    const c = new AbortController();
    void get<Document[]>(path, c.signal).then(value => { if (!c.signal.aborted) { assertCurrentAuthSession(session); setItems(value); } }).catch(() => { if (!c.signal.aborted) { setItems([]); setError('Could not load supporting documents.'); } }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [path, refresh, session]);
  const refreshDocuments = () => { setItems([]); setError(''); setLoading(true); setRefresh(v => v + 1); };
  const upload = async (file: File) => {
    if (uploading.current) return;
    setError('');
    if (file.size > 5 * 1024 * 1024) { setError('Choose a PDF or image up to 5 MB.'); return; }
    uploading.current = true; setBusy(true);
    try { assertCurrentAuthSession(session); const body = new FormData(); body.append('file', file); const config: AuthSessionRequestConfig = { _authSessionId: session }; await apiClient.post(path, body, config); assertCurrentAuthSession(session); if (!active.current) return; refreshDocuments(); if (input.current) input.current.value = ''; }
    catch (e) { if (active.current) setError(extractApiErrorMessage(e, 'Upload was not confirmed. Refresh the document list before trying again.')); }
    finally { uploading.current = false; if (active.current) setBusy(false); }
  };
  const download = async (d: Document) => {
    setError('');
    try {
      assertCurrentAuthSession(session);
      const config: AuthSessionRequestConfig = { responseType: 'blob', _authSessionId: session };
      const response = await apiClient.get(`${path}/${d.id}`, config);
      assertCurrentAuthSession(session);
      if (!active.current) return;
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a'); link.href = url; link.download = d.file_name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { if (active.current) setError(extractApiErrorMessage(e, 'Could not download this document.')); }
  };
  return <details className="rec-disclosure">
    <summary>Supporting documents <span className="gk-faint gk-num">{items.length}</span></summary>
    <div className="rec-disclosure__body">
      <p className="gk-muted">Only people with access to this record can open its documents. PDF, PNG or JPEG, up to 5 MB.</p>
      {error && <div className="gk-notice gk-notice--danger" role="alert">{error}<Button size="sm" disabled={busy} onClick={refreshDocuments}>Refresh documents</Button></div>}
      {loading ? <p role="status">Loading supporting documents…</p> : error ? null : items.length ? <List label="Supporting documents">{items.map(d => <ListRow key={d.id} lead={<FileText aria-hidden="true" />} title={d.file_name} meta={`${Math.ceil(d.bytes / 1024)} KB`} trail="Download" onClick={() => { void download(d); }} />)}</List>
        : <EmptyNote title="No documents yet">{canUpload ? 'Attach evidence such as a certificate or a signed form.' : 'Documents added by the responsible staff appear here.'}</EmptyNote>}
      {canUpload && <div>
        <input aria-label="Supporting document" ref={input} hidden disabled={busy} type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
        <Button size="sm" disabled={busy} onClick={() => input.current?.click()}><Upload aria-hidden="true" />{busy ? 'Uploading…' : 'Add a document'}</Button>
      </div>}
    </div>
  </details>;
}
