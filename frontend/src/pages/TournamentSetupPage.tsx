import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, ShieldCheck, Trophy, Users } from 'lucide-react';
import { EntityHeaderBand, EntityPageLayout, EntitySection } from '../components/layout/EntityPageLayout';
import { EntityTabs, type EntityTabItem } from '../components/layout/EntityTabs';
import { extractApiErrorMessage } from '../utils/apiError';
import { createOrganization, createTournament, fetchMyOrganizations, fetchTournamentHostClubs } from '../features/tournaments/api';
import type {
    CreateOrganizationPayload,
    CreateTournamentPayload,
    CreatableOrganizationKind,
    MyOrganization,
    TournamentDetail,
    TournamentHostClubOption,
    TournamentParticipantScope,
    TournamentVisibility
} from '../features/tournaments/domain';
import { hostAccessLabel, membershipRoleLabel, organizationKindLabel, tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';

type Tab = 'organizations' | 'tournament';

type OrganizationFormState = {
    displayName: string;
    description: string;
    kind: CreatableOrganizationKind;
};

type TournamentFormState = {
    hostClubId: string;
    name: string;
    description: string;
    rules: string;
    participantScope: TournamentParticipantScope;
    visibility: TournamentVisibility;
    registrationOpensAt: string;
    registrationClosesAt: string;
    startDate: string;
    endDate: string;
};

const tabs: EntityTabItem[] = [
    { id: 'organizations', label: 'Organizations' },
    { id: 'tournament', label: 'Create Tournament' }
];

const organizationKinds: Array<{ value: CreatableOrganizationKind; label: string }> = [
    { value: 'COMPANY', label: 'Company' },
    { value: 'SPONSOR', label: 'Sponsor' },
    { value: 'MEDIA', label: 'Media' },
    { value: 'HEALTHCARE', label: 'Healthcare' },
    { value: 'SPORTS_ORG', label: 'Sports Org' },
    { value: 'PARTNER', label: 'Partner' }
];

const inputClass = 'w-full border border-subtle bg-base px-3 py-2.5 text-sm text-primary outline-none transition-colors placeholder:text-muted focus:border-accent-primary';
const textareaClass = `${inputClass} min-h-[110px] resize-none`;
const labelClass = 'text-[11px] font-black uppercase tracking-[0.18em] text-secondary';

const normalizeTab = (value: string | null): Tab => value === 'tournament' ? 'tournament' : 'organizations';
const blankToNull = (value: string) => value.trim() || null;

const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const toDateTimeLocalValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};

const buildInitialTournamentForm = (): TournamentFormState => {
    const now = new Date();
    return {
        hostClubId: '',
        name: '',
        description: '',
        rules: '',
        participantScope: 'CLUB',
        visibility: 'PRIVATE',
        registrationOpensAt: toDateTimeLocalValue(now),
        registrationClosesAt: toDateTimeLocalValue(addDays(now, 14)),
        startDate: toDateTimeLocalValue(addDays(now, 21)),
        endDate: toDateTimeLocalValue(addDays(now, 23))
    };
};

const renderDateTime = (value?: string | null) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const TournamentSetupPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
    const [organizationsLoading, setOrganizationsLoading] = useState(true);
    const [organizationsError, setOrganizationsError] = useState<string | null>(null);
    const [organizationForm, setOrganizationForm] = useState<OrganizationFormState>({ displayName: '', description: '', kind: 'COMPANY' });
    const [organizationSaving, setOrganizationSaving] = useState(false);
    const [organizationMessage, setOrganizationMessage] = useState<string | null>(null);
    const [organizationError, setOrganizationError] = useState<string | null>(null);
    const [selectedOrganizerId, setSelectedOrganizerId] = useState<number | null>(null);
    const [hostClubs, setHostClubs] = useState<TournamentHostClubOption[]>([]);
    const [hostClubsLoading, setHostClubsLoading] = useState(false);
    const [hostClubsError, setHostClubsError] = useState<string | null>(null);
    const [tournamentForm, setTournamentForm] = useState<TournamentFormState>(() => buildInitialTournamentForm());
    const [tournamentSaving, setTournamentSaving] = useState(false);
    const [tournamentMessage, setTournamentMessage] = useState<string | null>(null);
    const [tournamentError, setTournamentError] = useState<string | null>(null);
    const [createdTournament, setCreatedTournament] = useState<TournamentDetail | null>(null);

    const activeTab = normalizeTab(searchParams.get('tab'));
    const tournamentReadyOrganizations = useMemo(() => organizations.filter((organization) => organization.canCreateTournament), [organizations]);
    const selectedOrganizer = useMemo(() => organizations.find((organization) => organization.id === selectedOrganizerId) ?? null, [organizations, selectedOrganizerId]);
    const selectedHostClub = useMemo(() => hostClubs.find((club) => String(club.clubId) === tournamentForm.hostClubId) ?? null, [hostClubs, tournamentForm.hostClubId]);

    const setActiveTab = (tab: Tab) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', tab);
        setSearchParams(nextParams, { replace: true });
    };

    const syncSelectedOrganizer = (nextOrganizations: MyOrganization[]) => {
        setSelectedOrganizerId((current) => {
            if (current != null && nextOrganizations.some((organization) => organization.id === current && organization.canCreateTournament)) {
                return current;
            }
            return nextOrganizations.find((organization) => organization.canCreateTournament)?.id ?? null;
        });
    };

    const loadOrganizations = async () => {
        setOrganizationsLoading(true);
        try {
            const response = await fetchMyOrganizations();
            setOrganizations(response);
            syncSelectedOrganizer(response);
            setOrganizationsError(null);
        } catch (error) {
            setOrganizations([]);
            setOrganizationsError(extractApiErrorMessage(error, 'Failed to load your organizations.'));
        } finally {
            setOrganizationsLoading(false);
        }
    };

    useEffect(() => {
        void loadOrganizations();
    }, []);

    useEffect(() => {
        let active = true;
        if (selectedOrganizerId == null) {
            setHostClubs([]);
            setHostClubsError(null);
            return () => {
                active = false;
            };
        }

        setHostClubsLoading(true);
        setHostClubsError(null);
        void fetchTournamentHostClubs(selectedOrganizerId)
            .then((response) => {
                if (!active) return;
                setHostClubs(response);
                setTournamentForm((current) => {
                    if (!current.hostClubId) return current;
                    return response.some((club) => String(club.clubId) === current.hostClubId) ? current : { ...current, hostClubId: '' };
                });
            })
            .catch((error) => {
                if (!active) return;
                setHostClubs([]);
                setHostClubsError(extractApiErrorMessage(error, 'Failed to load host club options.'));
            })
            .finally(() => {
                if (active) setHostClubsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [selectedOrganizerId]);

    const handleOrganizationSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setOrganizationSaving(true);
        setOrganizationMessage(null);
        setOrganizationError(null);

        const payload: CreateOrganizationPayload = {
            displayName: organizationForm.displayName.trim(),
            description: blankToNull(organizationForm.description),
            kind: organizationForm.kind
        };

        try {
            const created = await createOrganization(payload);
            await loadOrganizations();
            setSelectedOrganizerId(created.canCreateTournament ? created.id : selectedOrganizerId);
            setOrganizationForm({ displayName: '', description: '', kind: 'COMPANY' });
            setOrganizationMessage(`${created.displayName} is ready in your organizer list.`);
            setActiveTab('tournament');
        } catch (error) {
            setOrganizationError(extractApiErrorMessage(error, 'Failed to create the organization.'));
        } finally {
            setOrganizationSaving(false);
        }
    };

    const handleTournamentSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (selectedOrganizerId == null) {
            setTournamentError('Select an organizer before creating a tournament.');
            return;
        }

        setTournamentSaving(true);
        setTournamentMessage(null);
        setTournamentError(null);

        const payload: CreateTournamentPayload = {
            organizerOrganizationId: selectedOrganizerId,
            hostClubId: tournamentForm.hostClubId ? Number(tournamentForm.hostClubId) : null,
            name: tournamentForm.name.trim(),
            description: blankToNull(tournamentForm.description),
            rules: blankToNull(tournamentForm.rules),
            participantScope: tournamentForm.participantScope,
            visibility: tournamentForm.visibility,
            registrationOpensAt: tournamentForm.registrationOpensAt || null,
            registrationClosesAt: tournamentForm.registrationClosesAt || null,
            startDate: tournamentForm.startDate || null,
            endDate: tournamentForm.endDate || null,
            locationId: null
        };

        try {
            const tournament = await createTournament(payload);
            setCreatedTournament(tournament);
            setTournamentMessage(`${tournament.name} was created and is ready for tournament-side testing.`);
        } catch (error) {
            setTournamentError(extractApiErrorMessage(error, 'Failed to create the tournament.'));
        } finally {
            setTournamentSaving(false);
        }
    };

    return (
        <div className="bg-base min-h-full">
            <EntityHeaderBand>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
                    <div>
                        <Link to="/feed" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back
                        </Link>
                        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] accent-primary">Tournament Utility Layer</p>
                        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-primary">Tournament Setup</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">
                            This page keeps the organizer model testable without redesigning the app. Create an organizer, inspect host-club access, and submit a tournament from one workspace.
                        </p>
                    </div>

                    <section className="border border-subtle bg-base">
                        <div className="grid divide-y divide-[color:var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-4 py-3">
                                <p className={labelClass}>Organizations</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{organizations.length}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className={labelClass}>Ready Organizers</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight accent-primary">{tournamentReadyOrganizations.length}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className={labelClass}>Host Clubs</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{hostClubs.length}</p>
                            </div>
                        </div>
                    </section>
                </div>
            </EntityHeaderBand>

            <EntityPageLayout
                left={(
                    <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Workflow" title="What To Test" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            <div className="flex items-start gap-3 px-4 py-4">
                                <Building2 className="mt-0.5 h-4 w-4 accent-primary" />
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">1. Create Organizer</p>
                                    <p className="mt-2 text-sm leading-6 text-secondary">Use the organizations tab to create a sponsor, company, media, or healthcare organizer.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 px-4 py-4">
                                <Users className="mt-0.5 h-4 w-4 accent-primary" />
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">2. Check Host Clubs</p>
                                    <p className="mt-2 text-sm leading-6 text-secondary">Switch to tournament creation and verify whether the organizer sees own clubs or `ORGANIZER_FOR` clubs.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 px-4 py-4">
                                <Trophy className="mt-0.5 h-4 w-4 accent-primary" />
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">3. Submit Tournament</p>
                                    <p className="mt-2 text-sm leading-6 text-secondary">Create a tournament with or without a host club and confirm the backend accepts the safe combinations.</p>
                                </div>
                            </div>
                        </EntitySection>

                        <EntitySection eyebrow="Current Organizer" title="Selection" bodyClassName="px-4 py-4">
                            {selectedOrganizer ? (
                                <div className="space-y-3">
                                    <div className="border border-subtle bg-base px-3 py-3">
                                        <p className={labelClass}>Organizer</p>
                                        <p className="mt-2 text-sm font-black uppercase tracking-[0.14em] text-primary">{selectedOrganizer.displayName}</p>
                                        <p className="mt-2 text-xs leading-5 text-secondary">{selectedOrganizer.description || 'No description yet.'}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-primary">{membershipRoleLabel(selectedOrganizer.membershipRole)}</span>
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-primary">{organizationKindLabel(selectedOrganizer.primaryKind)}</span>
                                        <span className={`border px-2.5 py-1 ${selectedOrganizer.clubBacked ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-base text-primary'}`}>
                                            {selectedOrganizer.clubBacked ? 'Club Backed' : 'Independent'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm leading-6 text-secondary">No organizer is selected yet. Create one in the first tab or use an organization where you already have tournament-create access.</p>
                            )}
                        </EntitySection>
                    </div>
                )}
                center={(
                    <EntitySection eyebrow="Setup Surface" title="Organizer And Tournament Flow" description="The tabs stay local here so you can test the new business path without touching unfinished tournament management screens.">
                        <EntityTabs items={tabs} activeId={activeTab} onChange={(tabId) => setActiveTab(tabId as Tab)} />

                        {activeTab === 'organizations' ? (
                            <div className="grid gap-5 p-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                                <div className="space-y-4">
                                    <form onSubmit={handleOrganizationSubmit} className="border border-subtle bg-base px-4 py-4">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Create Organization</p>
                                        <p className="mt-2 text-sm leading-6 text-secondary">This is the minimal non-club organizer creation flow needed for tournament testing.</p>

                                        <div className="mt-4 space-y-4">
                                            <label className="flex flex-col gap-2">
                                                <span className={labelClass}>Display Name</span>
                                                <input value={organizationForm.displayName} onChange={(event) => setOrganizationForm((current) => ({ ...current, displayName: event.target.value }))} className={inputClass} placeholder="Crocobet Events" required />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className={labelClass}>Kind</span>
                                                <select value={organizationForm.kind} onChange={(event) => setOrganizationForm((current) => ({ ...current, kind: event.target.value as CreatableOrganizationKind }))} className={inputClass}>
                                                    {organizationKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className={labelClass}>Description</span>
                                                <textarea value={organizationForm.description} onChange={(event) => setOrganizationForm((current) => ({ ...current, description: event.target.value }))} className={textareaClass} placeholder="Short internal note about how this organizer is used." />
                                            </label>
                                        </div>

                                        {organizationMessage && <div className="mt-4 border border-accent-primary bg-accent-primary-soft px-4 py-3 text-sm font-semibold accent-primary">{organizationMessage}</div>}
                                        {organizationError && <div className="mt-4 border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{organizationError}</div>}

                                        <div className="mt-4 flex justify-end">
                                            <button type="submit" disabled={organizationSaving} className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60">
                                                {organizationSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                                                Create Organization
                                            </button>
                                        </div>
                                    </form>

                                    <div className="border border-subtle bg-base px-4 py-4">
                                        <p className={labelClass}>Club-backed Note</p>
                                        <p className="mt-2 text-sm leading-6 text-secondary">Club organizations are not created here. They continue to appear automatically through the club flow and can still be used as tournament organizers.</p>
                                    </div>
                                </div>

                                <div className="border border-subtle bg-base">
                                    <div className="border-b border-subtle px-4 py-4">
                                        <p className={labelClass}>My Organizations</p>
                                        <p className="mt-2 text-sm leading-6 text-secondary">Use this list to verify which organizations are tournament-ready and which ones are club-backed.</p>
                                    </div>

                                    {organizationsLoading ? (
                                        <div className="flex items-center justify-center px-4 py-12"><Loader2 className="h-6 w-6 animate-spin accent-primary" /></div>
                                    ) : organizationsError ? (
                                        <div className="px-4 py-6 text-sm font-semibold text-rose-600 dark:text-rose-300">{organizationsError}</div>
                                    ) : organizations.length === 0 ? (
                                        <div className="px-4 py-6 text-sm leading-6 text-secondary">No organizations are attached to this account yet.</div>
                                    ) : (
                                        <div className="divide-y divide-[color:var(--border-subtle)]">
                                            {organizations.map((organization) => (
                                                <article key={organization.id} className="px-4 py-4">
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div>
                                                            <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">{organization.displayName}</p>
                                                            <p className="mt-2 text-sm leading-6 text-secondary">{organization.description || 'No description yet.'}</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
                                                            <span className="border border-subtle bg-surface px-2.5 py-1 text-primary">{membershipRoleLabel(organization.membershipRole)}</span>
                                                            <span className="border border-subtle bg-surface px-2.5 py-1 text-primary">{organizationKindLabel(organization.primaryKind)}</span>
                                                            <span className={`border px-2.5 py-1 ${organization.clubBacked ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-surface text-primary'}`}>{organization.clubBacked ? 'Club Backed' : 'Independent'}</span>
                                                            <span className={`border px-2.5 py-1 ${organization.canCreateTournament ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-surface text-secondary'}`}>{organization.canCreateTournament ? 'Can Create Tournament' : 'No Create Access'}</span>
                                                        </div>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                                <form onSubmit={handleTournamentSubmit} className="border border-subtle bg-base px-4 py-4">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Create Tournament</p>
                                    <p className="mt-2 text-sm leading-6 text-secondary">The form intentionally stays thin: organizer, optional host club, and the base tournament details needed to hit the backend safely.</p>

                                    {tournamentReadyOrganizations.length === 0 ? (
                                        <div className="mt-4 border border-subtle bg-surface px-4 py-4 text-sm leading-6 text-secondary">No organization with tournament-create access is available yet. Create one first or use an existing club-backed organization.</div>
                                    ) : (
                                        <>
                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className={labelClass}>Organizer</span>
                                                    <select value={selectedOrganizerId ?? ''} onChange={(event) => { setSelectedOrganizerId(event.target.value ? Number(event.target.value) : null); setTournamentForm((current) => ({ ...current, hostClubId: '' })); }} className={inputClass}>
                                                        {tournamentReadyOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.displayName} ({organizationKindLabel(organization.primaryKind)})</option>)}
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className={labelClass}>Host Club</span>
                                                    <select value={tournamentForm.hostClubId} onChange={(event) => setTournamentForm((current) => ({ ...current, hostClubId: event.target.value }))} className={inputClass} disabled={selectedOrganizerId == null || hostClubsLoading}>
                                                        <option value="">No host club</option>
                                                        {hostClubs.map((club) => <option key={club.clubId} value={club.clubId}>{club.clubName} ({hostAccessLabel(club.accessType)})</option>)}
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className={labelClass}>Tournament Name</span>
                                                    <input value={tournamentForm.name} onChange={(event) => setTournamentForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} placeholder="Spring Cup 2026" required />
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className={labelClass}>Description</span>
                                                    <textarea value={tournamentForm.description} onChange={(event) => setTournamentForm((current) => ({ ...current, description: event.target.value }))} className={textareaClass} placeholder="Short testing note for this tournament." />
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className={labelClass}>Rules</span>
                                                    <textarea value={tournamentForm.rules} onChange={(event) => setTournamentForm((current) => ({ ...current, rules: event.target.value }))} className={textareaClass} placeholder="Optional bracket, tie-break, or eligibility notes." />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className={labelClass}>Participant Scope</span>
                                                    <select value={tournamentForm.participantScope} onChange={(event) => setTournamentForm((current) => ({ ...current, participantScope: event.target.value as TournamentParticipantScope }))} className={inputClass}>
                                                        <option value="CLUB">Club</option>
                                                        <option value="SQUAD">Squad</option>
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className={labelClass}>Visibility</span>
                                                    <select value={tournamentForm.visibility} onChange={(event) => setTournamentForm((current) => ({ ...current, visibility: event.target.value as TournamentVisibility }))} className={inputClass}>
                                                        <option value="PRIVATE">Private</option>
                                                        <option value="UNLISTED">Unlisted</option>
                                                        <option value="PUBLIC">Public</option>
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className={labelClass}>Registration Opens</span>
                                                    <input type="datetime-local" value={tournamentForm.registrationOpensAt} onChange={(event) => setTournamentForm((current) => ({ ...current, registrationOpensAt: event.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className={labelClass}>Registration Closes</span>
                                                    <input type="datetime-local" value={tournamentForm.registrationClosesAt} onChange={(event) => setTournamentForm((current) => ({ ...current, registrationClosesAt: event.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className={labelClass}>Starts</span>
                                                    <input type="datetime-local" value={tournamentForm.startDate} onChange={(event) => setTournamentForm((current) => ({ ...current, startDate: event.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className={labelClass}>Ends</span>
                                                    <input type="datetime-local" value={tournamentForm.endDate} onChange={(event) => setTournamentForm((current) => ({ ...current, endDate: event.target.value }))} className={inputClass} />
                                                </label>
                                            </div>

                                            {tournamentMessage && <div className="mt-4 border border-accent-primary bg-accent-primary-soft px-4 py-3 text-sm font-semibold accent-primary">{tournamentMessage}</div>}
                                            {tournamentError && <div className="mt-4 border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{tournamentError}</div>}

                                            <div className="mt-4 flex justify-end">
                                                <button type="submit" disabled={tournamentSaving || selectedOrganizerId == null} className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60">
                                                    {tournamentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                                                    Create Tournament
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </form>

                                <div className="flex flex-col gap-4">
                                    <div className="border border-subtle bg-base">
                                        <div className="border-b border-subtle px-4 py-4">
                                            <p className={labelClass}>Host Club Options</p>
                                            <p className="mt-2 text-sm leading-6 text-secondary">These options come directly from the organizer selection and the new backend relationship rules.</p>
                                        </div>
                                        {hostClubsLoading ? (
                                            <div className="flex items-center justify-center px-4 py-10"><Loader2 className="h-6 w-6 animate-spin accent-primary" /></div>
                                        ) : hostClubsError ? (
                                            <div className="px-4 py-6 text-sm font-semibold text-rose-600 dark:text-rose-300">{hostClubsError}</div>
                                        ) : hostClubs.length === 0 ? (
                                            <div className="px-4 py-6 text-sm leading-6 text-secondary">No host club options are attached to this organizer right now. A tournament can still be created without a host club.</div>
                                        ) : (
                                            <div className="divide-y divide-[color:var(--border-subtle)]">
                                                {hostClubs.map((club) => (
                                                    <article key={club.clubId} className="px-4 py-4">
                                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                                            <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">{club.clubName}</p>
                                                            <span className={`border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${selectedHostClub?.clubId === club.clubId ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-surface text-primary'}`}>{hostAccessLabel(club.accessType)}</span>
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-secondary">{club.organizationName}</p>
                                                    </article>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border border-subtle bg-base px-4 py-4">
                                        <div className="flex items-start gap-3">
                                            <ShieldCheck className="mt-0.5 h-4 w-4 accent-primary" />
                                            <div>
                                                <p className={labelClass}>Selected Context</p>
                                                <p className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-primary">{selectedOrganizer ? selectedOrganizer.displayName : 'No organizer selected'}</p>
                                                <p className="mt-2 text-sm leading-6 text-secondary">{selectedHostClub ? `${selectedHostClub.clubName} will be used as the host club.` : 'No host club is selected, which is valid for organizer-only tournaments.'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {createdTournament && (
                                        <div className="border border-subtle bg-base">
                                            <div className="border-b border-subtle px-4 py-4">
                                                <p className="text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Last Created Tournament</p>
                                                <p className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-primary">{createdTournament.name}</p>
                                            </div>
                                            <div className="divide-y divide-[color:var(--border-subtle)]">
                                                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className={labelClass}>Id</span><span className="text-right font-semibold text-primary">{createdTournament.id}</span></div>
                                                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className={labelClass}>Status</span><span className="text-right font-semibold text-primary">{createdTournament.status}</span></div>
                                                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className={labelClass}>Scope</span><span className="text-right font-semibold text-primary">{tournamentScopeLabel(createdTournament.participantScope)}</span></div>
                                                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className={labelClass}>Visibility</span><span className="text-right font-semibold text-primary">{tournamentVisibilityLabel(createdTournament.visibility)}</span></div>
                                                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className={labelClass}>Starts</span><span className="text-right font-semibold text-primary">{renderDateTime(createdTournament.startDate)}</span></div>
                                                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm"><span className={labelClass}>Ends</span><span className="text-right font-semibold text-primary">{renderDateTime(createdTournament.endDate)}</span></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </EntitySection>
                )}
                right={(
                    <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Testing Notes" title="Intentional Limits" bodyClassName="px-4 py-4">
                            <p className="text-sm leading-6 text-secondary">This phase only makes organizer-based tournament creation testable. Staff, bracket management, results surfaces, and polished discovery stay deferred.</p>
                        </EntitySection>
                        <EntitySection eyebrow="Current Result" title="What You Can Confirm" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]"><span className="text-secondary">Organization Creation</span><span className="text-primary">Live</span></div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]"><span className="text-secondary">Host Club Lookup</span><span className="text-primary">Live</span></div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]"><span className="text-secondary">Tournament Create Form</span><span className="text-primary">Live</span></div>
                        </EntitySection>
                    </div>
                )}
            />
        </div>
    );
};
