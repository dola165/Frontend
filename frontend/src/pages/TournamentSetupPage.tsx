import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, ShieldCheck, Trophy, Users } from 'lucide-react';
import { extractApiErrorMessage } from '../utils/apiError';
import { createTournament, fetchMyOrganizations, fetchTournamentHostClubs } from '../features/tournaments/api';
import type {
    CreateTournamentPayload,
    MyOrganization,
    TournamentDetail,
    TournamentHostClubOption,
    TournamentParticipantScope,
    TournamentVisibility
} from '../features/tournaments/domain';
import { hostAccessLabel, membershipRoleLabel, organizationKindLabel, tournamentScopeLabel, tournamentVisibilityLabel } from '../features/tournaments/domain';

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

const inputClass = 'rounded-md border border-[var(--fc-border)] bg-[var(--fc-card-bg)] text-[#f4f4f5] placeholder:text-[#a1a1aa] px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#16a34a]';
const textareaClass = `${inputClass} min-h-[110px] resize-none`;
const selectClass = inputClass;

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

const buildInitialForm = (): TournamentFormState => {
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
    const navigate = useNavigate();
    const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
    const [organizationsLoading, setOrganizationsLoading] = useState(true);
    const [organizationsError, setOrganizationsError] = useState<string | null>(null);
    const [selectedOrganizerId, setSelectedOrganizerId] = useState<number | null>(null);
    const [hostClubs, setHostClubs] = useState<TournamentHostClubOption[]>([]);
    const [hostClubsLoading, setHostClubsLoading] = useState(false);
    const [hostClubsError, setHostClubsError] = useState<string | null>(null);
    const [form, setForm] = useState<TournamentFormState>(() => buildInitialForm());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdEvent, setCreatedEvent] = useState<TournamentDetail | null>(null);

    const eventReadyOrganizations = useMemo(() => organizations.filter((o) => o.canCreateTournament), [organizations]);
    const selectedOrganizer = useMemo(() => organizations.find((o) => o.id === selectedOrganizerId) ?? null, [organizations, selectedOrganizerId]);
    const selectedHostClub = useMemo(() => hostClubs.find((c) => String(c.clubId) === form.hostClubId) ?? null, [hostClubs, form.hostClubId]);

    const syncSelectedOrganizer = (next: MyOrganization[]) => {
        setSelectedOrganizerId((current) => {
            if (current != null && next.some((o) => o.id === current && o.canCreateTournament)) return current;
            return next.find((o) => o.canCreateTournament)?.id ?? null;
        });
    };

    const loadOrganizations = async () => {
        setOrganizationsLoading(true);
        try {
            const data = await fetchMyOrganizations();
            setOrganizations(data);
            syncSelectedOrganizer(data);
            setOrganizationsError(null);
        } catch (err) {
            setOrganizations([]);
            setOrganizationsError(extractApiErrorMessage(err, 'Failed to load organizations.'));
        } finally {
            setOrganizationsLoading(false);
        }
    };

    useEffect(() => { void loadOrganizations(); }, []);

    useEffect(() => {
        let active = true;
        if (selectedOrganizerId == null) {
            setHostClubs([]);
            setHostClubsError(null);
            return () => { active = false; };
        }
        setHostClubsLoading(true);
        setHostClubsError(null);
        void fetchTournamentHostClubs(selectedOrganizerId)
            .then((data) => {
                if (!active) return;
                setHostClubs(data);
                setForm((c) => data.some((club) => String(club.clubId) === c.hostClubId) ? c : { ...c, hostClubId: '' });
            })
            .catch((err) => { if (active) { setHostClubs([]); setHostClubsError(extractApiErrorMessage(err, 'Failed to load host clubs.')); } })
            .finally(() => { if (active) setHostClubsLoading(false); });
        return () => { active = false; };
    }, [selectedOrganizerId]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (selectedOrganizerId == null) {
            setError('Select an organizer before creating an event.');
            return;
        }
        setSaving(true);
        setError(null);

        const payload: CreateTournamentPayload = {
            organizerOrganizationId: selectedOrganizerId,
            hostClubId: form.hostClubId ? Number(form.hostClubId) : null,
            name: form.name.trim(),
            description: blankToNull(form.description),
            rules: blankToNull(form.rules),
            participantScope: form.participantScope,
            visibility: form.visibility,
            registrationOpensAt: form.registrationOpensAt || null,
            registrationClosesAt: form.registrationClosesAt || null,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            locationId: null
        };

        try {
            const event = await createTournament(payload);
            setCreatedEvent(event);
            navigate(`/tournaments/${event.id}/workspace`);
        } catch (err) {
            setError(extractApiErrorMessage(err, 'Failed to create the event.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full bg-[#0f1117] font-sans text-[#f4f4f5] selection:bg-[#16a34a]/20">
            <div className="flex w-full flex-col gap-6 px-6 py-8">
                {/* Header */}
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                    <div>
                        <Link to="/tournaments" className="inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]">
                            <ArrowLeft className="h-4 w-4" />
                            Browse Events
                        </Link>
                        <p className="mt-4 text-sm font-semibold text-[#16a34a]">Event Layer</p>
                        <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl">
                            Event Setup
                        </h1>
                        <p className="mt-3 max-w-2xl text-base leading-7 text-[#a1a1aa]">
                            Select an organizer, optionally attach a host club, and create an event. Navigate to the workspace after creation to manage brackets and participants.
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="rounded-md border border-[#ffffff0d] bg-[#16181d]">
                        <div className="grid divide-y divide-[#ffffff0d] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-5 py-4">
                                <p className="text-xs font-semibold text-[#a1a1aa]">Organizations</p>
                                <p className="mt-1 text-2xl font-bold text-[#f4f4f5]">{organizations.length}</p>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-xs font-semibold text-[#a1a1aa]">Event-Ready</p>
                                <p className="mt-1 text-2xl font-bold text-[#16a34a]">{eventReadyOrganizations.length}</p>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-xs font-semibold text-[#a1a1aa]">Host Clubs</p>
                                <p className="mt-1 text-2xl font-bold text-[#f4f4f5]">{hostClubs.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main layout */}
                <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_320px] xl:items-start">
                    {/* Left sidebar — Steps */}
                    <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
                        <div className="rounded-md border border-[#ffffff0d] bg-[#16181d]">
                            <div className="border-b border-[#ffffff0d] px-5 py-4">
                                <p className="text-xs font-semibold text-[#a1a1aa]">Workflow</p>
                                <p className="mt-1 text-base font-semibold text-[#f4f4f5]">Steps</p>
                            </div>
                            <div className="divide-y divide-[#ffffff0d]">
                                <div className="flex items-start gap-3 px-5 py-4">
                                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" />
                                    <div>
                                        <p className="text-sm font-semibold text-[#f4f4f5]">1. Select Organizer</p>
                                        <p className="mt-1 text-sm leading-6 text-[#a1a1aa]">Pick from your existing organizations or create a new one.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 px-5 py-4">
                                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" />
                                    <div>
                                        <p className="text-sm font-semibold text-[#f4f4f5]">2. Choose Host Club</p>
                                        <p className="mt-1 text-sm leading-6 text-[#a1a1aa]">Optionally attach a club that will host the event.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 px-5 py-4">
                                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" />
                                    <div>
                                        <p className="text-sm font-semibold text-[#f4f4f5]">3. Create Event</p>
                                        <p className="mt-1 text-sm leading-6 text-[#a1a1aa]">Fill in the event details and submit. You'll be routed to the workspace.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-md border border-[#ffffff0d] bg-[#16181d]">
                            <div className="border-b border-[#ffffff0d] px-5 py-4">
                                <p className="text-xs font-semibold text-[#a1a1aa]">Current Organizer</p>
                                <p className="mt-1 text-base font-semibold text-[#f4f4f5]">Selection</p>
                            </div>
                            <div className="px-5 py-4">
                                {selectedOrganizer ? (
                                    <div className="space-y-3">
                                        <div className="rounded-md border border-[#ffffff0d] bg-[#16181d] p-4">
                                            <p className="text-xs font-semibold text-[#a1a1aa]">Organizer</p>
                                            <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">{selectedOrganizer.displayName}</p>
                                            <p className="mt-1 text-sm leading-5 text-[#a1a1aa]">{selectedOrganizer.description || 'No description yet.'}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full bg-[var(--fc-surface-hover)] px-3 py-1 text-xs font-medium text-[#a1a1aa]">{membershipRoleLabel(selectedOrganizer.membershipRole)}</span>
                                            <span className="rounded-full bg-[var(--fc-surface-hover)] px-3 py-1 text-xs font-medium text-[#a1a1aa]">{organizationKindLabel(selectedOrganizer.primaryKind)}</span>
                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${selectedOrganizer.clubBacked ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'bg-[var(--fc-surface-hover)] text-[#a1a1aa]'}`}>
                                                {selectedOrganizer.clubBacked ? 'Club Backed' : 'Independent'}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm leading-6 text-[#a1a1aa]">No organizer selected. Choose one from your existing organizations to set up an event.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Center — Form */}
                    <section className="min-w-0">
                        <div className="rounded-md border border-[#ffffff0d] bg-[#16181d]">
                            <div className="border-b border-[#ffffff0d] px-6 py-5">
                                <p className="text-xs font-semibold text-[#a1a1aa]">Event Form</p>
                                <p className="mt-1 text-lg font-semibold text-[#f4f4f5]">Create New Event</p>
                                <p className="mt-1 text-sm text-[#a1a1aa]">Fill in the details below. After creation you'll be routed to the event workspace.</p>
                            </div>

                            {organizationsLoading ? (
                                <div className="flex items-center justify-center px-6 py-16">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#16a34a]" />
                                </div>
                            ) : organizationsError ? (
                                <div className="px-6 py-8 text-sm font-semibold text-rose-300">{organizationsError}</div>
                            ) : (
                                <div className="p-6">
                                    <form onSubmit={handleSubmit} className="space-y-0">
                                        <div>
                                            <p className="text-sm font-semibold text-[#16a34a]">Event Details</p>
                                            <p className="text-sm text-[#a1a1aa]">Organizer, optional host club, and core event configuration.</p>
                                        </div>

                                        {eventReadyOrganizations.length === 0 ? (
                                            <div className="mt-6 rounded-md border border-[#ffffff0d] bg-[#16181d] p-5 text-sm leading-6 text-[#a1a1aa]">
                                                No organization with event-creation access is available yet. Organizations are managed through your club workspace.
                                            </div>
                                        ) : (
                                            <div className="mt-6 grid gap-5 md:grid-cols-2">
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Organizer</span>
                                                    <select value={selectedOrganizerId ?? ''} onChange={(e) => { setSelectedOrganizerId(e.target.value ? Number(e.target.value) : null); setForm((c) => ({ ...c, hostClubId: '' })); }} className={selectClass}>
                                                        {eventReadyOrganizations.map((o) => <option key={o.id} value={o.id}>{o.displayName} ({organizationKindLabel(o.primaryKind)})</option>)}
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Host Club</span>
                                                    <select value={form.hostClubId} onChange={(e) => setForm((c) => ({ ...c, hostClubId: e.target.value }))} className={selectClass} disabled={selectedOrganizerId == null || hostClubsLoading}>
                                                        <option value="">No host club</option>
                                                        {hostClubs.map((club) => <option key={club.clubId} value={club.clubId}>{club.clubName} ({hostAccessLabel(club.accessType)})</option>)}
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Event Name</span>
                                                    <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} className={inputClass} placeholder="Spring Cup 2026" required />
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Description</span>
                                                    <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} className={textareaClass} placeholder="Short note about this event." />
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Rules</span>
                                                    <textarea value={form.rules} onChange={(e) => setForm((c) => ({ ...c, rules: e.target.value }))} className={textareaClass} placeholder="Optional bracket, tie-break, or eligibility notes." />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Participant Scope</span>
                                                    <select value={form.participantScope} onChange={(e) => setForm((c) => ({ ...c, participantScope: e.target.value as TournamentParticipantScope }))} className={selectClass}>
                                                        <option value="CLUB">Club</option>
                                                        <option value="SQUAD">Squad</option>
                                                        <option value="PLAYER">Player</option>
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Visibility</span>
                                                    <select value={form.visibility} onChange={(e) => setForm((c) => ({ ...c, visibility: e.target.value as TournamentVisibility }))} className={selectClass}>
                                                        <option value="PRIVATE">Private</option>
                                                        <option value="UNLISTED">Unlisted</option>
                                                        <option value="PUBLIC">Public</option>
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Registration Opens</span>
                                                    <input type="datetime-local" value={form.registrationOpensAt} onChange={(e) => setForm((c) => ({ ...c, registrationOpensAt: e.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Registration Closes</span>
                                                    <input type="datetime-local" value={form.registrationClosesAt} onChange={(e) => setForm((c) => ({ ...c, registrationClosesAt: e.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Starts</span>
                                                    <input type="datetime-local" value={form.startDate} onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-[#f4f4f5]">Ends</span>
                                                    <input type="datetime-local" value={form.endDate} onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))} className={inputClass} />
                                                </label>
                                            </div>
                                        )}

                                        {error && <div className="mt-5 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div>}

                                        <div className="mt-6 flex justify-end">
                                            <button type="submit" disabled={saving || selectedOrganizerId == null} className="inline-flex items-center gap-2 rounded-md bg-[#16a34a] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e] disabled:opacity-60">
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                                                Create Event
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Right sidebar */}
                    <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
                        {/* Host Club Options */}
                        <div className="rounded-md border border-[#ffffff0d] bg-[#16181d]">
                            <div className="border-b border-[#ffffff0d] px-5 py-4">
                                <p className="text-xs font-semibold text-[#a1a1aa]">Host Club Options</p>
                                <p className="mt-1 text-sm text-[#a1a1aa]">These options come from the organizer and backend rules.</p>
                            </div>
                            {hostClubsLoading ? (
                                <div className="flex items-center justify-center px-5 py-10"><Loader2 className="h-5 w-5 animate-spin text-[#16a34a]" /></div>
                            ) : hostClubsError ? (
                                <div className="px-5 py-6 text-sm font-semibold text-rose-300">{hostClubsError}</div>
                            ) : hostClubs.length === 0 ? (
                                <div className="px-5 py-6 text-sm leading-6 text-[#a1a1aa]">No host club options available for this organizer.</div>
                            ) : (
                                <div className="divide-y divide-[#ffffff0d]">
                                    {hostClubs.map((club) => (
                                        <div key={club.clubId} className="px-5 py-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-[#f4f4f5]">{club.clubName}</p>
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedHostClub?.clubId === club.clubId ? 'bg-[#16a34a]/10 text-[#16a34a]' : 'bg-[var(--fc-surface-hover)] text-[#a1a1aa]'}`}>{hostAccessLabel(club.accessType)}</span>
                                            </div>
                                            <p className="mt-1 text-sm text-[#a1a1aa]">{club.organizationName}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected Context */}
                        <div className="rounded-md border border-[#ffffff0d] bg-[#16181d] p-5">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" />
                                <div>
                                    <p className="text-xs font-semibold text-[#a1a1aa]">Selected Context</p>
                                    <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">{selectedOrganizer ? selectedOrganizer.displayName : 'No organizer selected'}</p>
                                    <p className="mt-1 text-sm leading-6 text-[#a1a1aa]">{selectedHostClub ? `${selectedHostClub.clubName} will be used as the host club.` : 'No host club selected — valid for organizer-only events.'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Last Created Event */}
                        {createdEvent && (
                            <div className="rounded-md border border-[#ffffff0d] bg-[#16181d]">
                                <div className="border-b border-[#ffffff0d] px-5 py-4">
                                    <p className="text-xs font-semibold text-[#a1a1aa]">Last Created Event</p>
                                    <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">{createdEvent.name}</p>
                                </div>
                                <div className="divide-y divide-[#ffffff0d] px-5 py-2 text-sm">
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-[#a1a1aa]">ID</span><span className="font-semibold text-[#f4f4f5]">{createdEvent.id}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-[#a1a1aa]">Status</span><span className="font-semibold text-[#f4f4f5]">{createdEvent.status}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-[#a1a1aa]">Scope</span><span className="font-semibold text-[#f4f4f5]">{tournamentScopeLabel(createdEvent.participantScope)}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-[#a1a1aa]">Visibility</span><span className="font-semibold text-[#f4f4f5]">{tournamentVisibilityLabel(createdEvent.visibility)}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-[#a1a1aa]">Starts</span><span className="font-semibold text-[#f4f4f5]">{renderDateTime(createdEvent.startDate)}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-[#a1a1aa]">Ends</span><span className="font-semibold text-[#f4f4f5]">{renderDateTime(createdEvent.endDate)}</span></div>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
};
