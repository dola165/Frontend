import { useEffect, useId, useRef, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { Button, Field, GkRoot } from '../../../design/primitives';
import type { ImportField } from './domain';
import '../org-tools.css';

interface ImportTable { sheets: string[]; sheet: string; columns: string[]; rows: string[][]; rowNumbers?: number[] }
export function ImportMapping({ fields, single = false, onMapped }: { fields: ImportField[]; single?: boolean; onMapped: (rows: Record<string, string>[], rowNumbers?: number[]) => void }) {
  const [file, setFile] = useState<File | null>(null), [table, setTable] = useState<ImportTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({}), [rowIndex, setRowIndex] = useState('0');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null), idBase = useId();
  useEffect(() => () => request.current?.abort(), []);
  async function load(next: File, sheet?: string) {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setTable(null); setFile(next);
    try {
      if (next.size > 2 * 1024 * 1024) throw new Error('Choose a file up to 2 MB.');
      if (!/\.(xlsx|csv)$/i.test(next.name)) throw new Error('Choose an XLSX workbook or UTF-8 CSV file.');
      const data = new FormData(); data.append('file', next); if (sheet) data.append('sheet', sheet);
      const response = await apiClient.post<ImportTable>('/organizations/setup/import-file', data, { signal: controller.signal, headers: { 'Content-Type': undefined } });
      if (controller.signal.aborted) return;
      setTable(response.data); setRowIndex('0');
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
      setMapping(Object.fromEntries(fields.map(field => [field.key, response.data.columns.find(column => normalize(column) === normalize(field.key) || normalize(column) === normalize(field.label)) ?? ''])));
    } catch (err) { if (!controller.signal.aborted) setError(extractApiErrorMessage(err, err instanceof Error ? err.message : 'Could not read this file.')); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function useRows() {
    if (!table) return;
    const selected = single ? [table.rows[Number(rowIndex)]] : table.rows;
    const numbers = table.rowNumbers ?? table.rows.map((_, index) => index + 2);
    onMapped(selected.map(row => Object.fromEntries(fields.map(field => [field.key, mapping[field.key] ? row[table.columns.indexOf(mapping[field.key])] ?? '' : '']))), single ? [numbers[Number(rowIndex)]] : numbers);
  }
  const used = Object.values(mapping).filter(Boolean);
  const invalid = fields.some(field => field.required && !mapping[field.key]) || new Set(used).size !== used.length;
  return <GkRoot className="org-tool"><section className="org-tool__import" aria-label="Import from file">
    <h3 className="org-tool__subtitle">Import from Excel or CSV</h3>
    <p className="org-tool__hint">Use the first row for unique column names. XLSX or UTF-8 CSV, up to 500 data rows, 40 columns and 2 MB. Replace formulas with values; macros and links to other workbooks are not supported.</p>
    <p className="org-tool__hint"><a className="org-tool__link" href="/templates/organization-setup.xlsx" download>Download the Excel template</a> and replace the example rows with your own data.</p>
    <label className="gk-btn gk-btn--secondary org-tool__file">Choose file<input type="file" className="gk-visually-hidden" accept=".xlsx,.csv" disabled={busy} onChange={e => { const selected = e.target.files?.[0]; if (selected) void load(selected); }} /></label>
    {file && !busy && !error && <p className="org-tool__hint">{file.name}</p>}
    {busy && <p className="org-tool__hint" role="status">Reading file…</p>}{error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    {table && <>
      {table.sheets.length > 1 && <Field label="Worksheet" htmlFor={`${idBase}-sheet`}><select id={`${idBase}-sheet`} className="gk-input org-tool__select" value={table.sheet} onChange={e => { if (file) void load(file, e.target.value); }}>{table.sheets.map(name => <option key={name}>{name}</option>)}</select></Field>}
      <h4 className="org-tool__subtitle">Match the columns</h4>
      <div className="org-tool__pair">{fields.map(field => <Field key={field.key} label={field.label} hint={field.required ? 'Required' : 'Optional'} htmlFor={`${idBase}-${field.key}`}><select id={`${idBase}-${field.key}`} className="gk-input" value={mapping[field.key] ?? ''} onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}><option value="">{field.required ? 'Choose a column' : 'Leave blank'}</option>{table.columns.map(column => <option key={column}>{column}</option>)}</select></Field>)}</div>
      {single && table.rows.length > 1 && <Field label="Choose the organization row" htmlFor={`${idBase}-row`}><select id={`${idBase}-row`} className="gk-input" value={rowIndex} onChange={e => setRowIndex(e.target.value)}>{table.rows.map((row, i) => <option key={i} value={i}>Row {table.rowNumbers?.[i] ?? i + 2}: {row.slice(0, 2).join(' · ')}</option>)}</select></Field>}
      <div className="org-tool__table"><table><caption>File preview · first {Math.min(table.rows.length, 5)} of {table.rows.length} rows</caption><thead><tr><th>File row</th>{table.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.slice(0, 5).map((row, i) => <tr key={i}><td className="gk-num">{table.rowNumbers?.[i] ?? i + 2}</td>{row.map((value, col) => <td key={col}>{value}</td>)}</tr>)}</tbody></table></div>
      {new Set(used).size !== used.length && <p className="gk-notice gk-notice--danger" role="alert">Use a different source column for each field.</p>}
      <div><Button variant="primary" disabled={invalid} onClick={useRows}>{single ? 'Use this row in the form' : 'Validate mapped rows'}</Button></div>
    </>}
  </section></GkRoot>;
}
