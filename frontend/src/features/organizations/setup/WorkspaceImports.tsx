import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { Badge, Button, Field, GkRoot } from '../../../design/primitives';
import { ImportMapping } from './ImportMapping';
import '../org-tools.css';
import { squadFields, venueFields } from './domain';
import { clearSetupRecovery, isRecord, isRequestId, readSetupRecovery, writeSetupRecovery } from './setupRecovery';

interface Preview { fingerprint: string; ready: number; duplicates: number; errors: number; rows: { row: number; values: Record<string, string>; status: string; issues: string[] }[] }
interface Request { requestId: string; kind: string; rows: { values: Record<string, string> }[]; previewFingerprint?: string }
interface Receipt { created: number; skipped: number }
interface Recovery { request: Request; preview: Preview; rowNumbers: number[]; pending: boolean; receipt: Receipt | null }
type Props = { id: number; clubId: number | null; blocked: boolean };

function validRecovery(value: unknown): value is Recovery {
  if (!isRecord(value) || !isRecord(value.request) || !isRecord(value.preview)) return false;
  const request = value.request, preview = value.preview;
  return isRequestId(request.requestId) && ['SQUADS', 'VENUES'].includes(String(request.kind))
    && Array.isArray(request.rows) && request.rows.length > 0 && request.rows.length <= 500
    && request.rows.every(row => isRecord(row) && isRecord(row.values) && Object.keys(row.values).length <= 12 && Object.values(row.values).every(cell => typeof cell === 'string' && cell.length <= 2000))
    && typeof preview.fingerprint === 'string' && /^[\da-f]{64}$/i.test(preview.fingerprint)
    && ['ready', 'duplicates', 'errors'].every(key => Number.isSafeInteger(preview[key]) && Number(preview[key]) >= 0)
    && Array.isArray(preview.rows) && preview.rows.length === request.rows.length
    && preview.rows.every(row => isRecord(row) && Number.isSafeInteger(row.row) && Number(row.row) > 0 && isRecord(row.values)
      && Object.values(row.values).every(cell => typeof cell === 'string') && ['READY', 'DUPLICATE', 'INVALID'].includes(String(row.status)) && Array.isArray(row.issues) && row.issues.every(issue => typeof issue === 'string'))
    && Array.isArray(value.rowNumbers) && value.rowNumbers.length === request.rows.length && value.rowNumbers.every(row => Number.isSafeInteger(row) && row > 0)
    && typeof value.pending === 'boolean' && (value.receipt === null || (isRecord(value.receipt) && Number.isSafeInteger(value.receipt.created) && Number.isSafeInteger(value.receipt.skipped)));
}

export function WorkspaceImports(props: Props) {
  const { user, sessionId } = useAuth();
  return <ImportWorkspace key={`${user?.id}:${sessionId}:${props.id}`} {...props} />;
}

function ImportWorkspace({ id, clubId, blocked }: Props) {
  const { user } = useAuth();
  const purpose = `import:${id}`;
  const [recovery] = useState(() => readSetupRecovery(user?.id, purpose, validRecovery));
  const [kind, setKind] = useState(recovery?.request.kind ?? (clubId ? 'SQUADS' : 'VENUES'));
  const [preview, setPreview] = useState<Preview | null>(recovery && !recovery.receipt ? recovery.preview : null);
  const [rowNumbers, setRowNumbers] = useState<number[]>(recovery?.rowNumbers ?? []);
  const [receipt, setReceipt] = useState<Receipt | null>(recovery?.receipt ?? null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(recovery?.pending ?? false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const request = useRef<Request | null>(recovery?.request ?? null), active = useRef(true), submitting = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  function persist(value: Recovery) { setStorageAvailable(writeSetupRecovery(user?.id, purpose, value)); }
  function reset(nextKind = kind) {
    if (submitting.current || uncertain) return;
    clearSetupRecovery(user?.id, purpose); setKind(nextKind); setPreview(null); setReceipt(null); setError(''); request.current = null;
  }
  async function validate(rows: Record<string, string>[], numbers?: number[]) {
    if (submitting.current || uncertain) return;
    const next = { requestId: crypto.randomUUID(), kind, rows: rows.map(values => ({ values })) };
    const sourceRows = numbers ?? rows.map((_, index) => index + 2);
    request.current = next; submitting.current = true; setBusy(true); setError(''); setReceipt(null); setPreview(null); setRowNumbers(sourceRows);
    try {
      const response = await apiClient.post<Preview>(`/organizations/${id}/imports/preview`, next);
      if (active.current) { setPreview(response.data); persist({ request: next, preview: response.data, rowNumbers: sourceRows, pending: false, receipt: null }); }
    } catch (err) { if (active.current) setError(extractApiErrorMessage(err, 'Could not validate these rows.')); }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  }
  async function commit() {
    if (!request.current || !preview || submitting.current || preview.errors || (blocked && kind === 'VENUES')) return;
    submitting.current = true; setBusy(true); setError('');
    const saved: Recovery = { request: request.current, preview, rowNumbers, pending: true, receipt: null };
    persist(saved);
    try {
      const response = await apiClient.post<Receipt>(`/organizations/${id}/imports/commit`, { ...request.current, previewFingerprint: preview.fingerprint });
      if (active.current) {
        persist({ ...saved, pending: false, receipt: response.data });
        setReceipt(response.data); setPreview(null); request.current = null; setUncertain(false);
      }
    } catch (err) {
      if (active.current) {
        const status = (err as { response?: { status?: number } }).response?.status;
        const pending = status == null || status >= 500;
        setUncertain(pending); persist({ ...saved, pending });
        setError(extractApiErrorMessage(err, 'The response was interrupted. Retry the same import to recover its result.'));
      }
    } finally { submitting.current = false; if (active.current) setBusy(false); }
  }
  const noun = kind === 'SQUADS' ? 'squads' : 'venues';
  return <GkRoot className="org-tool"><section className="org-tool__section" aria-labelledby={`imports-${id}`}>
    <header className="org-tool__head"><div><h2 id={`imports-${id}`} className="org-tool__title">Import setup data</h2>
      <p className="org-tool__hint">Check a spreadsheet before any records are created. Existing names are skipped. Venues start as drafts, and ownership is recorded as your declaration.</p></div></header>
    <Field label="What are you importing?" htmlFor={`imports-${id}-kind`} hint={kind === 'SQUADS' ? 'Squad names, age groups and gender categories. Add players and staff in the club workspace.' : undefined}>
      <select id={`imports-${id}-kind`} className="gk-input org-tool__select" disabled={busy || uncertain} value={kind} onChange={e => reset(e.target.value)}>{clubId && <option value="SQUADS">Club squads</option>}<option value="VENUES">Venues owned or operated</option></select></Field>
    {!storageAvailable && <p className="gk-notice gk-notice--warning" role="status">This browser could not save the import for recovery. Keep this page open until the result is confirmed.</p>}
    {uncertain && <p className="gk-notice gk-notice--warning" role="status">An import is awaiting confirmation. Retry the same import to recover its receipt. The same rows will not be created twice.</p>}
    {blocked && kind === 'VENUES' ? <p className="gk-notice" role="status">Facility profile imports require content review for this organization.</p> : <>
      {!uncertain && !preview && !receipt && <fieldset className="org-tool__fieldset" disabled={busy}><ImportMapping key={kind} fields={kind === 'SQUADS' ? squadFields : venueFields} onMapped={(rows, numbers) => void validate(rows, numbers)} /></fieldset>}
      {preview && <div className="org-tool__card org-tool__review">
        <h3 className="org-tool__subtitle">Review before importing</h3>
        <p className="org-tool__facts"><Badge tone="accent">{preview.ready} ready</Badge><Badge>{preview.duplicates} duplicates</Badge><Badge tone={preview.errors ? 'danger' : 'neutral'}>{preview.errors} invalid</Badge></p>
        {storageAvailable && <p className="org-tool__hint">Your reviewed rows are saved for this account in this browser tab, so you can come back to this import later.</p>}
        {preview.errors > 0 && <p className="gk-notice gk-notice--danger" role="alert">Correct the listed rows in your file, then choose “Change file or mapping” to validate again. No rows have been imported.</p>}
        <div className="org-tool__table"><table><thead><tr><th>File row</th><th>Name</th><th>Result</th><th>Details</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.row}><td className="gk-num">{rowNumbers[row.row - 1] ?? row.row + 1}</td><td>{row.values.name}</td><td>{row.status === 'READY' ? 'Ready to create' : row.status === 'DUPLICATE' ? 'Will be skipped' : 'Needs correction'}</td><td>{row.issues.length ? row.issues.join(' ') : Object.entries(row.values).filter(([key]) => key !== 'name').map(([, value]) => value).filter(Boolean).join(' · ')}</td></tr>)}</tbody></table></div>
        <div className="org-tool__actions"><Button variant="primary" disabled={busy || preview.errors > 0 || (!preview.ready && !uncertain)} onClick={() => void commit()}>{busy ? 'Importing…' : uncertain ? 'Retry same import' : `Create ${preview.ready} ${noun}`}</Button><Button disabled={busy || uncertain} onClick={() => reset()}>Change file or mapping</Button></div>
      </div>}
    </>}
    {busy && !preview && <p className="org-tool__hint" role="status">Validating rows…</p>}{error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    {receipt && <div className="gk-notice org-tool__receipt"><span role="status" className="org-tool__grow">{receipt.created} {noun} created. {receipt.skipped} duplicate rows skipped.</span><Button size="sm" onClick={() => reset()}>Import another file</Button></div>}
  </section></GkRoot>;
}
