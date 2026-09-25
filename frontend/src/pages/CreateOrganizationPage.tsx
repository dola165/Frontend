import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrganizationInvitations } from '../features/organizations/activities/OrganizationDelegationPanel';
import { extractApiErrorMessage } from '../utils/apiError';
import { createOrganization, fetchMyOrganizations } from '../features/tournaments/api';
import type { CreatableOrganizationKind, MyOrganization } from '../features/tournaments/domain';
import { membershipRoleLabel, organizationKindLabel } from '../features/tournaments/domain';
import { useAuth } from '../context/AuthContext';
import { readTournamentSetupDraft } from '../features/tournaments/setupDraft';
import {
  getOrganizationOnboardingCopy,
  organizationDestination,
  parseOrganizationKind,
} from '../features/organizations/onboarding/organizationOnboarding';

const inputClass = 'w-full rounded-xl border border-subtle bg-inset px-4 py-3 text-sm text-primary outline-none transition-colors placeholder:text-muted focus:border-[#168a4b] focus:ring-2 focus:ring-[#168a4b]/20 disabled:cursor-not-allowed disabled:opacity-60';
const textareaClass = `${inputClass} min-h-[100px] resize-y`;

const buildForm = (kind: CreatableOrganizationKind) => ({ displayName: '', description: '', kind });

type AuthSnapshot = {
  sessionId: ReturnType<typeof useAuth>['sessionId'];
  userId?: number;
};

const authChanged = (started: AuthSnapshot, current: AuthSnapshot) =>
  started.sessionId !== current.sessionId || started.userId !== current.userId;

const requestMayHaveCompleted = (error: unknown) => {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status == null || status >= 500;
};

export const CreateOrganizationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const { sessionId, user, refreshNavigationCapabilities } = useAuth();
  const copy = getOrganizationOnboardingCopy(i18n.resolvedLanguage ?? i18n.language);
  const setupDraft = readTournamentSetupDraft(location.state, user?.id);
  const requestedKind = parseOrganizationKind(new URLSearchParams(location.search).get('kind'));
  const returnState = setupDraft ? { tournamentSetupDraft: setupDraft } : undefined;
  const returnPath = setupDraft ? '/tournaments/setup' : requestedKind === 'VENUE' ? '/stadiums' : '/';
  const returnLabel = setupDraft ? copy.backToTournament : requestedKind === 'VENUE' ? copy.backToStadiums : copy.back;
  const active = useRef(true);
  const submitting = useRef(false);
  const submissionAuth = useRef<AuthSnapshot | null>(null);
  const currentAuth = useRef<AuthSnapshot>({ sessionId, userId: user?.id });
  currentAuth.current = { sessionId, userId: user?.id };
  const [form, setForm] = useState(() => buildForm(requestedKind));
  const [saving, setSaving] = useState(false);
  const [creationLocked, setCreationLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [orgsAttempt, setOrgsAttempt] = useState(0);
  const selectedKind = copy.kinds.find(({ kind }) => kind === form.kind) ?? copy.kinds[0];

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    const started = submissionAuth.current;
    if (saving && started && authChanged(started, currentAuth.current)) {
      setMessage(copy.sessionChangedPending);
    }
  }, [copy.sessionChangedPending, saving, sessionId, user?.id]);

  useEffect(() => {
    let current = true;
    setOrgsLoading(true);
    setOrgsError(null);
    void fetchMyOrganizations().then(data => {
      if (current) setOrganizations(data);
    }).catch(() => {
      if (current) {
        setOrganizations([]);
        setOrgsError(copy.organizationsLoadFailed);
      }
    }).finally(() => { if (current) setOrgsLoading(false); });
    return () => { current = false; };
  }, [copy.organizationsLoadFailed, orgsAttempt, sessionId, user?.id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || creationLocked || !form.displayName.trim()) return;
    const startedAuth = currentAuth.current;
    submissionAuth.current = startedAuth;
    const hasKnownOrganizationInventory = !orgsLoading && !orgsError;
    const knownOrganizationIds = new Set(organizations.map(({ id }) => id));
    const payload = {
      displayName: form.displayName.trim(),
      description: form.description.trim() || null,
      kind: form.kind,
    };
    submitting.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const created = await createOrganization(payload);
      if (!active.current) return;
      if (authChanged(startedAuth, currentAuth.current)) {
        setCreationLocked(true);
        setMessage(copy.sessionChangedAfterCreate);
        return;
      }
      if (typeof refreshNavigationCapabilities === 'function') void refreshNavigationCapabilities().catch(() => undefined);
      const destination = organizationDestination(created.id, form.kind, setupDraft);
      navigate(destination.to, { replace: true, state: destination.state });
    } catch (err) {
      if (!active.current) return;
      if (authChanged(startedAuth, currentAuth.current)) {
        setCreationLocked(true);
        setMessage(copy.sessionChangedAfterError);
      } else if (requestMayHaveCompleted(err)) {
        try {
          const refreshed = await fetchMyOrganizations();
          if (!active.current) return;
          if (authChanged(startedAuth, currentAuth.current)) {
            setCreationLocked(true);
            setMessage(copy.sessionChangedAfterError);
            return;
          }
          setOrganizations(refreshed);
          const candidates = hasKnownOrganizationInventory ? refreshed.filter(organization =>
            !knownOrganizationIds.has(organization.id)
            && organization.displayName === payload.displayName
            && organization.kinds.includes(payload.kind)) : [];
          if (candidates.length === 1) {
            if (typeof refreshNavigationCapabilities === 'function') void refreshNavigationCapabilities().catch(() => undefined);
            const destination = organizationDestination(candidates[0].id, payload.kind, setupDraft);
            navigate(destination.to, { replace: true, state: destination.state });
            return;
          }
          // An immediate read cannot prove that an uncertain create did not commit.
          setCreationLocked(true);
          setMessage(copy.creationUnconfirmed);
        } catch {
          if (!active.current) return;
          setCreationLocked(true);
          setMessage(authChanged(startedAuth, currentAuth.current)
            ? copy.sessionChangedAfterError : copy.creationUnconfirmed);
        }
      } else {
        setMessage(extractApiErrorMessage(err, copy.createFailed));
      }
    } finally {
      submissionAuth.current = null;
      submitting.current = false;
      if (active.current) setSaving(false);
    }
  };

  return (
    <main className="theme-page min-h-full text-primary">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <header>
          <Link
            to={returnPath}
            state={returnState}
            replace
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168a4b]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {returnLabel}
          </Link>
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-[#168a4b] dark:text-[#6ee7a0]">{copy.eyebrow}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-primary sm:text-5xl">
            {setupDraft ? copy.tournamentTitle : form.kind === 'VENUE' ? copy.venueTitle : copy.title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-secondary">
            {setupDraft ? copy.tournamentSubtitle : form.kind === 'VENUE' ? copy.venueSubtitle : copy.subtitle}
          </p>
        </header>

        <OrganizationInvitations />

        {message && (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <form onSubmit={handleSubmit} className="theme-surface theme-border rounded-2xl border p-5 shadow-panel sm:p-7">
            <div className="flex items-start gap-3">
              <div className="theme-surface-inset theme-border flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[#168a4b] dark:text-[#6ee7a0]">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-primary">{copy.nameLabel}</h2>
                <p className="mt-1 text-sm leading-6 text-secondary">{copy.identityNotice}</p>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-primary">{copy.nameLabel}</span>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm(current => ({ ...current, displayName: event.target.value }))}
                  className={inputClass}
                  placeholder={copy.namePlaceholder}
                  maxLength={255}
                  disabled={saving || creationLocked}
                  autoComplete="organization"
                  required
                />
              </label>

              <fieldset disabled={saving || creationLocked}>
                <legend className="text-sm font-semibold text-primary">{copy.typeLabel}</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {copy.kinds.map((option) => {
                    const descriptionId = `organization-kind-${option.kind.toLowerCase()}-description`;
                    return (
                      <label
                        key={option.kind}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 transition-colors focus-within:ring-2 focus-within:ring-[#168a4b] ${
                          form.kind === option.kind
                            ? 'border-accent-primary bg-accent-primary-soft'
                            : 'theme-border theme-surface-inset hover:border-strong'
                        }`}
                      >
                        <input
                          type="radio"
                          name="orgKind"
                          value={option.kind}
                          checked={form.kind === option.kind}
                          onChange={(event) => setForm(current => ({ ...current, kind: event.target.value as CreatableOrganizationKind }))}
                          aria-describedby={descriptionId}
                          className="mt-0.5 h-4 w-4 accent-[#168a4b]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-primary">{option.label}</span>
                          <span id={descriptionId} className="mt-1 block text-xs leading-5 text-secondary">{option.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="border-l-2 border-[#168a4b] bg-accent-primary-soft px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#168a4b] dark:text-[#6ee7a0]">{copy.nextStepLabel}</p>
                <p className="mt-1 text-sm leading-6 text-secondary">{selectedKind.nextStep}</p>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-primary">{copy.descriptionLabel}</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm(current => ({ ...current, description: event.target.value }))}
                  className={textareaClass}
                  placeholder={copy.descriptionPlaceholder}
                  maxLength={4000}
                  disabled={saving || creationLocked}
                />
              </label>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                to={returnPath}
                state={returnState}
                replace
                className="theme-border theme-surface-inset inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168a4b]"
              >
                {copy.cancel}
              </Link>
              <button
                type="submit"
                disabled={saving || creationLocked || !form.displayName.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#168a4b] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#11753f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168a4b] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {saving ? copy.creating : copy.create}
              </button>
            </div>
          </form>

          <aside className="theme-surface theme-border overflow-hidden rounded-2xl border shadow-panel">
            <div className="theme-border border-b px-5 py-5 sm:px-6">
              <h2 className="text-sm font-semibold text-primary">{copy.myOrganizations}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary">{copy.myOrganizationsHint}</p>
            </div>
            {orgsLoading ? (
              <div role="status" aria-label={copy.myOrganizations} className="flex items-center justify-center px-6 py-10">
                <Loader2 className="h-5 w-5 animate-spin text-[#168a4b]" aria-hidden="true" />
              </div>
            ) : orgsError ? (
              <div role="alert" className="px-6 py-5 text-sm text-rose-700 dark:text-rose-300">
                <p>{orgsError}</p>
                <button type="button" onClick={() => setOrgsAttempt(attempt => attempt + 1)} className="mt-2 min-h-11 font-semibold underline underline-offset-4">
                  {copy.retryOrganizations}
                </button>
              </div>
            ) : organizations.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-secondary">{copy.noOrganizations}</div>
            ) : (
              <div className="theme-border max-h-[420px] divide-y overflow-y-auto">
                {organizations.map((organization) => (
                  <div key={organization.id} className="px-5 py-4 sm:px-6">
                    <Link
                      to={(organization.capabilities?.canManageVenueBookings || (!Object.prototype.hasOwnProperty.call(organization, 'capabilities') && organization.kinds.includes('VENUE') && ['OWNER', 'ADMIN'].includes(organization.membershipRole))) ? `/stadiums/${organization.id}/manage` : `/organizations/${organization.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168a4b]"
                    >
                      {organization.displayName}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="theme-surface-inset rounded-full px-2.5 py-1 text-xs font-medium text-secondary">{membershipRoleLabel(organization.membershipRole)}</span>
                      <span className="theme-surface-inset rounded-full px-2.5 py-1 text-xs font-medium text-secondary">{organizationKindLabel(organization.primaryKind)}</span>
                    </div>
                    {setupDraft && organization.canCreateTournament && (
                      <Link
                        to={`/tournaments/setup?organizer=${organization.id}`}
                        state={{ tournamentSetupDraft: { ...setupDraft, organizerId: organization.id, form: { ...setupDraft.form, hostClubId: '' } } }}
                        replace
                        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-accent-primary-soft px-3 py-2 text-xs font-semibold text-[#168a4b] hover:underline dark:text-[#6ee7a0]"
                      >
                        {copy.useForTournament}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
};
