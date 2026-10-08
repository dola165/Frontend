import { EmptyState } from '../../components/ui/EmptyState';
import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import './organization-portfolio.css';

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
  return <section className="org-portfolio" aria-labelledby={`portfolio-${id}`}>
    <div className="org-portfolio-heading"><div><p className="org-profile-kicker">Facilities</p><h2 id={`portfolio-${id}`}>Venues owned or operated</h2></div>{data?.canManageRelationships && (venues.length > 0 || adding) && <button className="org-profile-action" type="button" onClick={() => setAdding(v => !v)}>{adding ? 'Close form' : 'Link a venue'}</button>}</div>
    <p className="org-portfolio-help">See the venues connected to this organization and open the workspace you have access to. Ownership declarations are recorded separately from verification.</p>
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt(v => v + 1)}>Retry</button></p>}
    {!data && !error && <p role="status">Loading venues…</p>}
    {adding && <form onSubmit={save} className="org-portfolio-form"><fieldset disabled={busy}><legend>Link an existing venue</legend><p>You must be an owner or administrator of both organizations. Linking a venue does not change anyone’s access.</p><label>Venue<select required value={venue} onChange={e => setVenue(e.target.value)}><option value="">{options === null ? 'Loading…' : 'Choose a venue'}</option>{options?.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? ` · ${v.city}` : ''}</option>)}</select></label><label>Relationship<select value={relationship} onChange={e => setRelationship(e.target.value as 'OWNS' | 'OPERATES')}><option value="OPERATES">Operates this venue</option><option value="OWNS">Owns this venue · declared, not verified</option></select></label>{options?.length === 0 && <p>No venues are available with your current owner or administrator access.</p>}<button className="org-profile-action org-profile-action--primary" disabled={busy || !venue}>{busy ? 'Saving…' : 'Save relationship'}</button></fieldset></form>}
    {data && !venues.length && !adding && <EmptyState icon={MapPin} title="No venues are listed here yet." description={data.canManageRelationships ? "Connect an existing venue to show where your organization operates. The venue keeps its own bookings and access." : "Venues connected to this organization will appear here when its team adds them."} action={data.canManageRelationships ? {label:"Link a venue",onClick:()=>setAdding(true)} : undefined}/>}
    <div className="org-portfolio-grid">{venues.map(v => <article key={v.id} className="org-portfolio-venue"><p className="org-profile-kicker">{v.published ? 'Venue' : 'Draft venue'}</p><h3>{v.name}</h3>{v.city && <p>{v.city}</p>}<ul className="org-portfolio-relations">{data?.venues.filter(r => r.id === v.id).map(r => <li key={r.relationshipId}><span>{r.relationship === 'OWNS' ? 'Owned · declared, not verified' : 'Operated'}</span>{r.canEnd && <button type="button" onClick={() => setEnding(r)} aria-label={`End ${r.relationship === 'OWNS' ? 'ownership' : 'operation'} relationship with ${r.name}`}>End relationship</button>}</li>)}</ul><div className="org-profile-actions">{v.canManage && <Link className="org-profile-action org-profile-action--primary" to={`/stadiums/${v.id}/manage`}>Manage venue</Link>}<Link className="org-profile-action" to={`/stadiums/${v.id}`}>View venue</Link></div></article>)}</div>
    {ending && <section className="org-portfolio-confirm" aria-label="End venue relationship"><h3>End this {ending.relationship === 'OWNS' ? 'ownership' : 'operation'} relationship?</h3><p>{ending.name} will no longer be listed under this relationship. Existing bookings and access remain unchanged.</p><button type="button" disabled={busy} className="org-profile-action" onClick={() => void end()}>{busy ? 'Saving…' : 'End relationship'}</button><button type="button" disabled={busy} className="org-profile-action" onClick={() => setEnding(null)}>Keep relationship</button></section>}
  </section>;
}
