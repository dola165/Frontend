import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { Dialog } from '../../design/Dialog';
import { Badge, Button, ButtonLink, EmptyNote, Field, GkRoot, Skeleton } from '../../design/primitives';
import './org-tools.css';

interface Venue { relationshipId: number; id: number; name: string; city: string | null; relationship: 'OWNS' | 'OPERATES'; source: string; revision: number; published: boolean; canManage: boolean; canEnd: boolean }
interface Portfolio { clubId: number | null; canManageRelationships: boolean; venues: Venue[] }
interface Option { id: number; name: string; city: string | null }

export function OrganizationPortfolio({ id, revision = 0, hideWhenEmpty = false }: { id: number; revision?: number; hideWhenEmpty?: boolean }) {
  const [data, setData] = useState<Portfolio | null>(null), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0), [adding, setAdding] = useState(false), [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null), [venue, setVenue] = useState('');
  const [relationship, setRelationship] = useState<'OWNS' | 'OPERATES'>('OPERATES');
  const [ending, setEnding] = useState<Venue | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void apiClient.get<Portfolio>(`/organizations/${id}/portfolio`, { signal: controller.signal }).then(r => setData(r.data))
      .catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load this organization’s venues.')); });
    return () => controller.abort();
  }, [id, revision, attempt]);
  useEffect(() => {
    if (!adding) return;
    const controller = new AbortController(); setOptions(null);
    void apiClient.get<Option[]>(`/organizations/${id}/venue-candidates`, { signal: controller.signal }).then(r => setOptions(r.data))
      .catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load available venues.')); });
    return () => controller.abort();
  }, [adding, id]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!venue || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { const r = await apiClient.post<Portfolio>(`/organizations/${id}/venue-relationships`, { venueId: Number(venue), relationship }); setData(r.data); setAdding(false); setVenue(''); }
    catch (e) { setError(extractApiErrorMessage(e, 'Could not link this venue.')); }
    finally { saving.current = false; setBusy(false); }
  }
  async function end() {
    if (!ending || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { const r = await apiClient.post<Portfolio>(`/organizations/${id}/venue-relationships/${ending.relationshipId}/end`, { revision: ending.revision }); setData(r.data); setEnding(null); }
    catch (e) { setError(extractApiErrorMessage(e, 'Could not end this relationship.')); }
    finally { saving.current = false; setBusy(false); }
  }
  const venues = [...new Map(data?.venues.map(v => [v.id, v]) ?? []).values()];
  if (hideWhenEmpty && !error && !venues.length) return null;
  const relationName = (relation: Venue) => relation.relationship === 'OWNS' ? 'ownership' : 'operation';
  return <GkRoot className="org-tool"><section className="org-tool__section" aria-labelledby={`portfolio-${id}`}>
    <header className="org-tool__head">
      <div><h2 id={`portfolio-${id}`} className="org-tool__title">Venues owned or operated</h2>
        <p className="org-tool__hint">The venues connected to this organization. Ownership is a declaration and is recorded separately from verification.</p></div>
      {data?.canManageRelationships && (venues.length > 0 || adding) && <Button onClick={() => setAdding(v => !v)}>{adding ? 'Close form' : 'Link a venue'}</Button>}
    </header>
    {error && <div className="gk-notice gk-notice--danger"><span role="alert" className="org-tool__grow">{error}</span><Button size="sm" onClick={() => setAttempt(v => v + 1)}>Retry</Button></div>}
    {!data && !error && <div role="status" aria-label="Loading venues"><Skeleton height={72} /></div>}
    {adding && <form onSubmit={save} className="org-tool__card">
      <fieldset className="org-tool__fieldset" disabled={busy}>
        <legend className="org-tool__legend">Link an existing venue</legend>
        <p className="org-tool__hint">You must be an owner or administrator of both organizations. Linking a venue does not change anyone’s access.</p>
        <div className="org-tool__pair">
          <Field label="Venue" htmlFor={`portfolio-${id}-venue`}><select id={`portfolio-${id}-venue`} className="gk-input" required value={venue} onChange={e => setVenue(e.target.value)}><option value="">{options === null ? 'Loading…' : 'Choose a venue'}</option>{options?.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` · ${v.city}` : ''}</option>)}</select></Field>
          <Field label="Relationship" htmlFor={`portfolio-${id}-relationship`}><select id={`portfolio-${id}-relationship`} className="gk-input" value={relationship} onChange={e => setRelationship(e.target.value as 'OWNS' | 'OPERATES')}><option value="OPERATES">Operates this venue</option><option value="OWNS">Owns this venue · declared, not verified</option></select></Field>
        </div>
        {options?.length === 0 && <p className="org-tool__hint">No venues are available with your current owner or administrator access.</p>}
        <div><Button type="submit" variant="primary" disabled={busy || !venue}>{busy ? 'Saving…' : 'Save relationship'}</Button></div>
      </fieldset>
    </form>}
    {data && !venues.length && !adding && <div className="org-tool__card"><EmptyNote title="No venues are listed here yet." action={data.canManageRelationships ? <Button size="sm" onClick={() => setAdding(true)}>Link a venue</Button> : undefined}>
      {data.canManageRelationships ? 'Connect an existing venue to show where your organization operates. The venue keeps its own bookings and access.' : 'Venues connected to this organization appear here when its team adds them.'}</EmptyNote></div>}
    {venues.length > 0 && <ul className="org-tool__list">{venues.map(v => <li key={v.id}><article className="org-tool__venue">
      <div className="org-tool__venue-main">
        <h3 className="org-tool__name">{v.name}</h3>
        <p className="org-tool__hint">{[v.published ? 'Venue' : 'Draft venue', v.city].filter(Boolean).join(' · ')}</p>
        <ul className="org-tool__relations">{data?.venues.filter(r => r.id === v.id).map(r => <li key={r.relationshipId}>
          <Badge tone={r.relationship === 'OWNS' ? 'info' : 'neutral'}>{r.relationship === 'OWNS' ? 'Owned · declared, not verified' : 'Operated'}</Badge>
          {r.canEnd && <Button size="sm" variant="ghost" onClick={() => setEnding(r)} aria-label={`End ${relationName(r)} relationship with ${r.name}`}>End relationship</Button>}
        </li>)}</ul>
      </div>
      <div className="org-tool__actions">{v.canManage && <ButtonLink size="sm" to={`/stadiums/${v.id}/manage`}>Manage venue</ButtonLink>}<ButtonLink size="sm" variant="ghost" to={`/stadiums/${v.id}`}>View venue</ButtonLink></div>
    </article></li>)}</ul>}
    <Dialog open={ending !== null} role="alertdialog" size="sm" title={ending ? `End this ${relationName(ending)} relationship?` : ''} onClose={() => { if (!busy) setEnding(null); }}
      description={ending ? `${ending.name} will no longer be listed under this relationship. Existing bookings and access stay as they are.` : undefined}
      footer={<><Button variant="ghost" disabled={busy} onClick={() => setEnding(null)}>Keep relationship</Button><Button variant="danger" disabled={busy} onClick={() => void end()}>{busy ? 'Saving…' : 'End relationship'}</Button></>} />
  </section></GkRoot>;
}
