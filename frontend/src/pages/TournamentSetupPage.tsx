import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Plus, ShieldCheck, Trophy, Users } from 'lucide-react';
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

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#00c853] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#00c853]';
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
        <div className="min-h-full bg-[#f2f4f7] font-sans text-slate-950 selection:bg-[#00c853]/20 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-[#00c853]/30">
            <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                    <div>
                        <Link to="/tournaments" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                            <ArrowLeft className="h-4 w-4" />
                            Browse Events
                        </Link>
                        <p className="mt-4 text-sm font-semibold text-[#1f6feb]">Event Layer</p>
                        <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
                            Event Setup
                        </h1>
                        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                            Select an organizer, optionally attach a host club, and create an event. Navigate to the workspace after creation to manage brackets and participants.
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid divide-y divide-slate-200 dark:divide-slate-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-5 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Organizations</p>
                                <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{organizations.length}</p>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Event-Ready</p>
                                <p className="mt-1 text-2xl font-bold text-[#1f6feb]">{eventReadyOrganizations.length}</p>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Host Clubs</p>
                                <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{hostClubs.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main layout */}
                <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_320px] xl:items-start">
                    {/* Left sidebar — Steps */}
                    <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Workflow</p>
                                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-white">Steps</p>
                            </div>
                            <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                <div className="flex items-start gap-3 px-5 py-4">
                                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6feb]" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-950 dark:text-white">1. Select Organizer</p>
                                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Pick from your existing organizations or create a new one.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 px-5 py-4">
                                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6feb]" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-950 dark:text-white">2. Choose Host Club</p>
                                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Optionally attach a club that will host the event.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 px-5 py-4">
                                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6feb]" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-950 dark:text-white">3. Create Event</p>
                                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Fill in the event details and submit. You'll be routed to the workspace.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Current Organizer</p>
                                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-white">Selection</p>
                            </div>
                            <div className="px-5 py-4">
                                {selectedOrganizer ? (
                                    <div className="space-y-3">
                                        <div className="rounded-2xl border border-slate-200 bg-[#f2f4f7] p-4 dark:border-slate-700 dark:bg-slate-800">
                                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Organizer</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{selectedOrganizer.displayName}</p>
                                            <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{selectedOrganizer.description || 'No description yet.'}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">{membershipRoleLabel(selectedOrganizer.membershipRole)}</span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">{organizationKindLabel(selectedOrganizer.primaryKind)}</span>
                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${selectedOrganizer.clubBacked ? 'bg-blue-50 text-[#1f6feb] dark:bg-blue-500/10 dark:text-[#4c8dff]' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                {selectedOrganizer.clubBacked ? 'Club Backed' : 'Independent'}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">No organizer selected. Choose one from your existing organizations to set up an event.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Center — Form */}
                    <section className="min-w-0">
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Event Form</p>
                                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Create New Event</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Fill in the details below. After creation you'll be routed to the event workspace.</p>
                            </div>

                            {organizationsLoading ? (
                                <div className="flex items-center justify-center px-6 py-16">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#1f6feb]" />
                                </div>
                            ) : organizationsError ? (
                                <div className="px-6 py-8 text-sm font-semibold text-rose-600 dark:text-rose-300">{organizationsError}</div>
                            ) : (
                                <div className="p-6">
                                    <form onSubmit={handleSubmit} className="space-y-0">
                                        <div>
                                            <p className="text-sm font-semibold text-[#1f6feb]">Event Details</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Organizer, optional host club, and core event configuration.</p>
                                        </div>

                                        {eventReadyOrganizations.length === 0 ? (
                                            <div className="mt-6 rounded-2xl border border-slate-200 bg-[#f2f4f7] p-5 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                No organization with event-creation access is available yet. Organizations are managed through your club workspace.
                                            </div>
                                        ) : (
                                            <div className="mt-6 grid gap-5 md:grid-cols-2">
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Organizer</span>
                                                    <select value={selectedOrganizerId ?? ''} onChange={(e) => { setSelectedOrganizerId(e.target.value ? Number(e.target.value) : null); setForm((c) => ({ ...c, hostClubId: '' })); }} className={selectClass}>
                                                        {eventReadyOrganizations.map((o) => <option key={o.id} value={o.id}>{o.displayName} ({organizationKindLabel(o.primaryKind)})</option>)}
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Host Club</span>
                                                    <select value={form.hostClubId} onChange={(e) => setForm((c) => ({ ...c, hostClubId: e.target.value }))} className={selectClass} disabled={selectedOrganizerId == null || hostClubsLoading}>
                                                        <option value="">No host club</option>
                                                        {hostClubs.map((club) => <option key={club.clubId} value={club.clubId}>{club.clubName} ({hostAccessLabel(club.accessType)})</option>)}
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Event Name</span>
                                                    <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} className={inputClass} placeholder="Spring Cup 2026" required />
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Description</span>
                                                    <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} className={textareaClass} placeholder="Short note about this event." />
                                                </label>
                                                <label className="flex flex-col gap-2 md:col-span-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rules</span>
                                                    <textarea value={form.rules} onChange={(e) => setForm((c) => ({ ...c, rules: e.target.value }))} className={textareaClass} placeholder="Optional bracket, tie-break, or eligibility notes." />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Participant Scope</span>
                                                    <select value={form.participantScope} onChange={(e) => setForm((c) => ({ ...c, participantScope: e.target.value as TournamentParticipantScope }))} className={selectClass}>
                                                        <option value="CLUB">Club</option>
                                                        <option value="SQUAD">Squad</option>
                                                        <option value="PLAYER">Player</option>
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Visibility</span>
                                                    <select value={form.visibility} onChange={(e) => setForm((c) => ({ ...c, visibility: e.target.value as TournamentVisibility }))} className={selectClass}>
                                                        <option value="PRIVATE">Private</option>
                                                        <option value="UNLISTED">Unlisted</option>
                                                        <option value="PUBLIC">Public</option>
                                                    </select>
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Registration Opens</span>
                                                    <input type="datetime-local" value={form.registrationOpensAt} onChange={(e) => setForm((c) => ({ ...c, registrationOpensAt: e.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Registration Closes</span>
                                                    <input type="datetime-local" value={form.registrationClosesAt} onChange={(e) => setForm((c) => ({ ...c, registrationClosesAt: e.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Starts</span>
                                                    <input type="datetime-local" value={form.startDate} onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))} className={inputClass} />
                                                </label>
                                                <label className="flex flex-col gap-2">
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ends</span>
                                                    <input type="datetime-local" value={form.endDate} onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))} className={inputClass} />
                                                </label>
                                            </div>
                                        )}

                                        {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}

                                        <div className="mt-6 flex justify-end">
                                            <button type="submit" disabled={saving || selectedOrganizerId == null} className="inline-flex items-center gap-2 rounded-full bg-[#00c853] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#00e676] disabled:opacity-60">
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
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Host Club Options</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">These options come from the organizer and backend rules.</p>
                            </div>
                            {hostClubsLoading ? (
                                <div className="flex items-center justify-center px-5 py-10"><Loader2 className="h-5 w-5 animate-spin text-[#1f6feb]" /></div>
                            ) : hostClubsError ? (
                                <div className="px-5 py-6 text-sm font-semibold text-rose-600 dark:text-rose-300">{hostClubsError}</div>
                            ) : hostClubs.length === 0 ? (
                                <div className="px-5 py-6 text-sm leading-6 text-slate-500 dark:text-slate-400">No host club options available for this organizer.</div>
                            ) : (
                                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {hostClubs.map((club) => (
                                        <div key={club.clubId} className="px-5 py-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-slate-950 dark:text-white">{club.clubName}</p>
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedHostClub?.clubId === club.clubId ? 'bg-blue-50 text-[#1f6feb] dark:bg-blue-500/10 dark:text-[#4c8dff]' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{hostAccessLabel(club.accessType)}</span>
                                            </div>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{club.organizationName}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected Context */}
                        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6feb]" />
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Selected Context</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{selectedOrganizer ? selectedOrganizer.displayName : 'No organizer selected'}</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{selectedHostClub ? `${selectedHostClub.clubName} will be used as the host club.` : 'No host club selected — valid for organizer-only events.'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Last Created Event */}
                        {createdEvent && (
                            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Last Created Event</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{createdEvent.name}</p>
                                </div>
                                <div className="divide-y divide-slate-200 px-5 py-2 text-sm dark:divide-slate-800">
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-slate-500">ID</span><span className="font-semibold text-slate-950 dark:text-white">{createdEvent.id}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-slate-500">Status</span><span className="font-semibold text-slate-950 dark:text-white">{createdEvent.status}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-slate-500">Scope</span><span className="font-semibold text-slate-950 dark:text-white">{tournamentScopeLabel(createdEvent.participantScope)}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-slate-500">Visibility</span><span className="font-semibold text-slate-950 dark:text-white">{tournamentVisibilityLabel(createdEvent.visibility)}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-slate-500">Starts</span><span className="font-semibold text-slate-950 dark:text-white">{renderDateTime(createdEvent.startDate)}</span></div>
                                    <div className="flex items-start justify-between gap-4 py-2.5"><span className="text-slate-500">Ends</span><span className="font-semibold text-slate-950 dark:text-white">{renderDateTime(createdEvent.endDate)}</span></div>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
};
