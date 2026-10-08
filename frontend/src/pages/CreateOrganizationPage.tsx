import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { MiniMap } from '../components/MiniMap';
import { extractApiErrorMessage } from '../utils/apiError';
import { readTournamentSetupDraft } from '../features/tournaments/setupDraft';
import { organizationDestination } from '../features/organizations/onboarding/organizationOnboarding';
import { ImportMapping } from '../features/organizations/setup/ImportMapping';
import { clubCategories, organizationTypes, profileFields, typeLabel, type CreatedOrganization, type OrganizationType, type SetupDraft } from '../features/organizations/setup/domain';
import { clearSetupRecovery, isRecord, isRequestId, readSetupRecovery, writeSetupRecovery } from '../features/organizations/setup/setupRecovery';
import type { TournamentSetupDraft } from '../features/tournaments/setupDraft';
import '../features/organizations/setup/setup.css';

type Point = { lat: number; lng: number };
type CreationRequest = { id: string; body: SetupDraft & { location: { latitude: number; longitude: number; city: string | null } | null } };
interface CreationRecovery { form: SetupDraft; point: Point | null; city: string; step: number; request: CreationRequest | null; created: CreatedOrganization | null; tournamentDraft: TournamentSetupDraft | null }
function validRecovery(value: unknown): value is CreationRecovery {
  if (!isRecord(value) || !isRecord(value.form)) return false;
  const form = value.form;
  return ['displayName', 'description', 'clubCategory', 'website', 'publicEmail', 'publicPhone', 'addressText', 'focus'].every(key => typeof form[key] === 'string' && (form[key] as string).length <= 2000)
    && organizationTypes.some(([key]) => key === form.organizationType) && typeof form.venueEnabled === 'boolean' && typeof form.tournamentEnabled === 'boolean'
    && typeof value.city === 'string' && value.city.length <= 100 && [1, 2, 3].includes(Number(value.step))
    && (value.point === null || (isRecord(value.point) && typeof value.point.lat === 'number' && Math.abs(value.point.lat) <= 90 && typeof value.point.lng === 'number' && Math.abs(value.point.lng) <= 180))
    && (value.request === null || (isRecord(value.request) && isRequestId(value.request.id) && isRecord(value.request.body)))
    && (value.created === null || (isRecord(value.created) && Number.isSafeInteger(value.created.id) && Number(value.created.id) > 0
      && (value.created.clubId === null || (Number.isSafeInteger(value.created.clubId) && Number(value.created.clubId) > 0))
      && value.created.profilePath === (value.created.clubId ? `/clubs/${value.created.clubId}` : `/organizations/${value.created.id}`)
      && value.created.workspacePath === `${value.created.profilePath}/workspace`));
}

export const CreateOrganizationPage = () => {
  const { user, sessionId } = useAuth();
  return <OrganizationCreator key={`${user?.id}:${sessionId}`} />;
};
function OrganizationCreator() {
  const { user, refreshNavigationCapabilities } = useAuth();
  const location = useLocation(), navigate = useNavigate();
  const requested = new URLSearchParams(location.search).get('kind');
  const [recovery] = useState(() => readSetupRecovery(user?.id, 'organization', validRecovery));
  const tournamentDraft = readTournamentSetupDraft(location.state, user?.id) ?? readTournamentSetupDraft({ tournamentSetupDraft: recovery?.tournamentDraft }, user?.id);
  const startingType: OrganizationType = organizationTypes.some(([key]) => key === requested) ? requested as OrganizationType : 'SPORTS_ORG';
  const emptyForm: SetupDraft = { displayName: '', description: '', organizationType: startingType, clubCategory: '',
    venueEnabled: requested === 'VENUE', tournamentEnabled: Boolean(tournamentDraft) || requested === 'TOURNAMENT_ORGANIZER',
    website: '', publicEmail: '', publicPhone: '', addressText: '', focus: '' };
  const [form, setForm] = useState<SetupDraft>(recovery?.form ?? emptyForm);
  const [point, setPoint] = useState<Point | null>(recovery?.point ?? null);
  const [city, setCity] = useState(recovery?.city ?? ''), [step, setStep] = useState(recovery?.request ? 3 : recovery?.step ?? 1), [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(Boolean(recovery?.request && !recovery.created));
  const [created, setCreated] = useState<CreatedOrganization | null>(recovery?.created ?? null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const request = useRef<CreationRequest | null>(recovery?.request ?? null), active = useRef(true), saving = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    setStorageAvailable(writeSetupRecovery(user?.id, 'organization', { form, point, city, step, request: request.current, created, tournamentDraft }));
  }, [user?.id, form, point, city, step, created, tournamentDraft, uncertain]);
  const canCreate = user?.navigationCapabilities?.workspaces.some(item => item.id === 'organization.create');
  const edit = (values: Partial<SetupDraft>) => { setForm(current => ({ ...current, ...values })); setError(''); };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || created || canCreate === false) return;
    if (step >= 2 && (form.displayName.trim().length < 2 || form.displayName.trim().length > 120)) { setStep(2); setError('Enter a name between 2 and 120 characters.'); return; }
    if (step < 3) { setStep(step + 1); return; }
    saving.current = true; setBusy(true); setError('');
    if (!request.current) request.current = { id: crypto.randomUUID(), body: { ...form, displayName: form.displayName.trim(),
      location: point ? { latitude: point.lat, longitude: point.lng, city: city || null } : null } };
    // Save before sending: navigating away can never turn an uncertain write into
    // a fresh request. A retry is always deliberate and uses the original body.
    setStorageAvailable(writeSetupRecovery(user?.id, 'organization', { form, point, city, step, request: request.current, created: null, tournamentDraft }));
    try {
      const response = await apiClient.post<CreatedOrganization>('/organizations/setup', { ...request.current.body, requestId: request.current.id });
      if (!active.current) return;
      setCreated(response.data); setUncertain(false); request.current = null;
      writeSetupRecovery(user?.id, 'organization', { form, point, city, step, request: null, created: response.data, tournamentDraft });
      void refreshNavigationCapabilities().catch(() => undefined);
    } catch (err) {
      if (!active.current) return;
      const status = (err as { response?: { status?: number } }).response?.status;
      setUncertain(status == null || status >= 500);
      if (status != null && status < 500) request.current = null;
      writeSetupRecovery(user?.id, 'organization', { form, point, city, step, request: request.current, created: null, tournamentDraft });
      setError(extractApiErrorMessage(err, 'Could not confirm creation. Retry this request to check its result.'));
    } finally { saving.current = false; if (active.current) setBusy(false); }
  }
  function startAnother() {
    if (saving.current || uncertain) return;
    clearSetupRecovery(user?.id, 'organization'); request.current = null; setCreated(null); setForm(emptyForm); setPoint(null); setCity(''); setStep(1); setError('');
  }
  if (created) return <main className="org-setup"><p className="org-setup-kicker">Ready to use</p><h1>{form.displayName}</h1>
    <section className="org-setup-card"><h2>Your {created.clubId ? 'club' : 'organization'} has been created</h2><p>Creation is confirmed. Open the workspace to complete the remaining details, invite your team, or import your facilities{created.clubId ? ' and squads' : ''}.</p>
      <div className="org-setup-actions"><Link className="org-setup-button org-setup-primary" to={created.workspacePath}>Open workspace</Link><Link className="org-setup-button" to={created.profilePath}>View profile</Link>
        <Link className="org-setup-button" to={created.clubId ? `${created.workspacePath}?tab=settings&section=imports` : `${created.workspacePath}?tab=imports`}>{created.clubId ? 'Import squads or venues' : 'Import venues'}</Link>
        <button type="button" onClick={startAnother}>Create another organization</button>
      {tournamentDraft && <button type="button" onClick={() => { const destination = organizationDestination(created.id, 'SPORTS_ORG', tournamentDraft); navigate(destination.to, { state: destination.state }); }}>Continue tournament setup</button>}</div>
    </section></main>;
  return <main className="org-setup"><Link to="/my-organizations">← My organizations</Link><header className="org-setup-header"><div><p className="org-setup-kicker">Start your organization</p><h1>Create a club or organization</h1><p>One profile and workspace, with the activities your organization needs.</p></div></header>
    {canCreate === false && <p className="org-setup-notice">Creation requires a verified adult account with completed account setup. Check your account details before continuing.</p>}
    <p className="org-setup-notice">{storageAvailable ? 'Your progress is saved for this account in this browser tab. You can leave setup and return here.' : 'This browser could not save your progress. Keep this page open until creation is confirmed.'}</p>
    {recovery && !uncertain && <button type="button" disabled={busy} onClick={startAnother}>Discard draft and start again</button>}
    <nav className="org-setup-steps" aria-label="Creation steps">{['Type and activities', 'Profile details', 'Review'].map((label, i) => <span key={label} aria-current={step === i + 1 ? 'step' : undefined}>{i + 1}. {label}</span>)}</nav>
    {error && <p role="alert">{error}</p>}{uncertain && <p role="status">The response was interrupted. Retry with the same details to recover the result safely.</p>}
    <form onSubmit={submit}><fieldset disabled={busy || uncertain} className="org-setup-card">
      {step === 1 && <><h2>What kind of organization is it?</h2><div className="org-setup-types">{organizationTypes.map(([key, label, help]) => <label key={key}><input type="radio" name="organizationType" checked={form.organizationType === key} onChange={() => edit({ organizationType: key })} /><strong>{label}</strong><small>{help}</small></label>)}</div>
        {form.organizationType === 'CLUB' && <label className="mt-5">Club category<select required value={form.clubCategory} onChange={e => edit({ clubCategory: e.target.value })}><option value="">Choose the football setting</option>{clubCategories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        <h2 className="mt-6">What will you do here?</h2><p>Your profile and workspace are included. Activities can be changed later.</p>
        <label className="org-setup-check"><input type="checkbox" checked={form.tournamentEnabled} onChange={e => edit({ tournamentEnabled: e.target.checked })} />Organize tournaments</label>
        <label className="org-setup-check"><input type="checkbox" checked={form.venueEnabled} onChange={e => edit({ venueEnabled: e.target.checked })} />Manage a venue and its bookings</label><p>A sponsor or company can organize tournaments without owning a venue. You can also add several facilities from the workspace.</p>
      </>}
      {step === 2 && <><h2>Build the profile</h2><p>Start with the name. Add contact information you want to show on the profile. You can complete photos and further details in the workspace.</p>
        <label>Name<input required minLength={2} maxLength={120} value={form.displayName} onChange={e => edit({ displayName: e.target.value })} autoComplete="organization" /></label>
        <label>About<textarea maxLength={2000} rows={4} value={form.description} onChange={e => edit({ description: e.target.value })} /></label>
        <div className="org-setup-fields"><label>Website<input type="url" maxLength={500} value={form.website} onChange={e => edit({ website: e.target.value })} /></label><label>Public email<input type="email" maxLength={254} value={form.publicEmail} onChange={e => edit({ publicEmail: e.target.value })} /></label><label>Public phone<input type="tel" maxLength={60} value={form.publicPhone} onChange={e => edit({ publicPhone: e.target.value })} /></label><label>Address<input maxLength={500} value={form.addressText} onChange={e => edit({ addressText: e.target.value })} /></label></div>
        <label>What we do<textarea rows={3} maxLength={2000} value={form.focus} onChange={e => edit({ focus: e.target.value })} /></label>
        {(form.organizationType === 'CLUB' || form.venueEnabled) && <details><summary>Map location (optional)</summary><label>City<input value={city} maxLength={100} onChange={e => setCity(e.target.value)} /></label><MiniMap mode="picker" title="Choose a location" selectedLocation={point} onSelectLocation={setPoint} />{point && <button type="button" onClick={() => setPoint(null)}>Remove map location</button>}</details>}
        <button type="button" onClick={() => setImporting(value => !value)}>{importing ? 'Close import' : 'Fill details from Excel or CSV'}</button>
        {importing && <ImportMapping fields={profileFields} single onMapped={rows => { const row = rows[0]; edit({ displayName: row.displayName, description: row.description, website: row.website, publicEmail: row.publicEmail, publicPhone: row.publicPhone, addressText: row.addressText, focus: row.focus }); setImporting(false); }} />}
      </>}
      {step === 3 && <><h2>Review your organization</h2><dl className="org-setup-summary"><dt>Name</dt><dd>{form.displayName}</dd><dt>Type</dt><dd>{typeLabel(form.organizationType)}{form.organizationType === 'CLUB' ? ` · ${clubCategories.find(([key]) => key === form.clubCategory)?.[1]}` : ''}</dd><dt>Activities</dt><dd>Profile and workspace{form.tournamentEnabled ? ', tournaments' : ''}{form.venueEnabled ? ', venue bookings' : ''}</dd><dt>About</dt><dd>{form.description || 'To be completed'}</dd><dt>Contact</dt><dd>{[form.publicEmail, form.publicPhone, form.website].filter(Boolean).join(' · ') || 'No public contact yet'}</dd><dt>Address</dt><dd>{form.addressText || 'Not added'}</dd></dl><p>{form.organizationType === 'CLUB' ? 'The club uses the existing club profile and workspace, with full team and football operations.' : 'The profile starts as a draft. Publishing it is optional and separate from using your workspace.'}</p><p>Creating this organization records you as its owner. It does not mark the organization or your qualifications as verified.</p></>}
    </fieldset><div className="org-setup-actions">{step > 1 && <button type="button" disabled={busy || uncertain} onClick={() => { request.current = null; setStep(step - 1); }}>Back</button>}<button className="org-setup-primary" disabled={busy || canCreate === false || (step === 1 && form.organizationType === 'CLUB' && !form.clubCategory)}>{busy ? 'Creating…' : uncertain ? 'Retry same request' : step < 3 ? 'Continue' : 'Create organization'}</button><Link to="/my-organizations">Open an existing organization</Link></div></form>
  </main>;
}
