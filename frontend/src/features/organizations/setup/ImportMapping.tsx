import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { ImportField } from './domain';

interface ImportTable { sheets: string[]; sheet: string; columns: string[]; rows: string[][]; rowNumbers?: number[] }
export function ImportMapping({ fields, single = false, onMapped }: { fields: ImportField[]; single?: boolean; onMapped: (rows: Record<string, string>[], rowNumbers?: number[]) => void }) {
  const [file, setFile] = useState<File | null>(null), [table, setTable] = useState<ImportTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({}), [rowIndex, setRowIndex] = useState('0');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
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
  return <section className="org-setup-import" aria-label="Import from file">
    <h3>Import from Excel or CSV</h3>
    <p>Use the first nonempty row for unique column names. XLSX or UTF-8 CSV files can contain up to 500 data rows, 40 columns and be up to 2 MB. Replace formulas with values; macros and external workbook links are not supported.</p>
    <a href="/templates/organization-setup.xlsx" download>Download the Excel template</a><p>Replace the example rows with your own data before importing.</p>
    <label>Choose file<input type="file" accept=".xlsx,.csv" disabled={busy} onChange={e => { const selected = e.target.files?.[0]; if (selected) void load(selected); }} /></label>
    {busy && <p role="status">Reading file…</p>}{error && <p role="alert">{error}</p>}
    {table && <>
      {table.sheets.length > 1 && <label>Worksheet<select value={table.sheet} onChange={e => { if (file) void load(file, e.target.value); }}>{table.sheets.map(name => <option key={name}>{name}</option>)}</select></label>}
      <h4>Match the columns</h4><div className="org-setup-fields">{fields.map(field => <label key={field.key}>{field.label}{field.required ? ' *' : ''}<select value={mapping[field.key] ?? ''} onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}><option value="">{field.required ? 'Choose a column' : 'Leave blank'}</option>{table.columns.map(column => <option key={column}>{column}</option>)}</select></label>)}</div>
      {single && table.rows.length > 1 && <label>Choose the organization row<select value={rowIndex} onChange={e => setRowIndex(e.target.value)}>{table.rows.map((row, i) => <option key={i} value={i}>Row {table.rowNumbers?.[i] ?? i + 2}: {row.slice(0, 2).join(' · ')}</option>)}</select></label>}
      <div className="org-setup-table"><table><caption>File preview · first {Math.min(table.rows.length, 5)} of {table.rows.length} rows</caption><thead><tr><th>File row</th>{table.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.slice(0, 5).map((row, i) => <tr key={i}><td>{table.rowNumbers?.[i] ?? i + 2}</td>{row.map((value, col) => <td key={col}>{value}</td>)}</tr>)}</tbody></table></div>
      {new Set(used).size !== used.length && <p role="alert">Use a different source column for each field.</p>}
      <button type="button" className="org-setup-primary" disabled={invalid} onClick={useRows}>{single ? 'Use this row in the form' : 'Validate mapped rows'}</button>
    </>}
  </section>;
}
