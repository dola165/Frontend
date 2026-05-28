import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Plus } from 'lucide-react';
import { extractApiErrorMessage } from '../utils/apiError';
import { createOrganization, fetchMyOrganizations } from '../features/tournaments/api';
import type { CreatableOrganizationKind, MyOrganization } from '../features/tournaments/domain';
import { membershipRoleLabel, organizationKindLabel } from '../features/tournaments/domain';

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#00c853] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#00c853]';
const textareaClass = `${inputClass} min-h-[100px] resize-none`;

interface OrgTypeOption {
    value: CreatableOrganizationKind;
    label: string;
    description: string;
}

const orgTypeOptions: OrgTypeOption[] = [
    { value: 'SPORTS_ORG', label: 'Club', description: 'Sports club or athletic organization' },
    { value: 'COMPANY', label: 'Betting Company', description: 'Betting or gaming company' },
    { value: 'SPONSOR', label: 'Sponsor', description: 'Brand sponsor or corporate partner' },
    { value: 'PARTNER', label: 'Other', description: 'Other type of organization' },
];

const buildForm = () => ({ displayName: '', description: '', kind: 'SPORTS_ORG' as CreatableOrganizationKind });

export const CreateOrganizationPage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState(buildForm);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [organizations, setOrganizations] = useState<MyOrganization[]>([]);
    const [orgsLoading, setOrgsLoading] = useState(true);

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const loadOrganizations = async () => {
        setOrgsLoading(true);
        try {
            setOrganizations(await fetchMyOrganizations());
        } catch {
            setOrganizations([]);
        } finally {
            setOrgsLoading(false);
        }
    };

    useEffect(() => {
        void loadOrganizations();
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        try {
            const created = await createOrganization({
                displayName: form.displayName.trim(),
                description: form.description.trim() || null,
                kind: form.kind,
            });
            showMessage(`${created.displayName} has been created.`, 'success');
            setForm(buildForm());
            void loadOrganizations();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to create organization.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full bg-[#f2f4f7] font-sans text-slate-950 selection:bg-[#00c853]/20 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-[#00c853]/30">
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div>
                    <Link to="/tournaments/setup" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Event Setup
                    </Link>
                    <p className="mt-4 text-sm font-semibold text-[#00c853]">Organizer Layer</p>
                    <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
                        Create Organization
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                        An organization acts as the legal or hosting entity behind events. Create one to start organizing events on the platform.
                    </p>
                </div>

                {/* Toast */}
                {message && (
                    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                        messageType === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                    }`}>
                        {message}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-[#f2f4f7] text-[#00c853] dark:border-slate-700 dark:bg-slate-800 dark:text-[#00c853]">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-950 dark:text-white">New Organization</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Fill in the details below to register a new organizer.</p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-5">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Organization Name</span>
                                <input
                                    value={form.displayName}
                                    onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))}
                                    className={inputClass}
                                    placeholder="e.g. Crocobet Events, Borjomi Sports"
                                    required
                                />
                            </label>

                            <fieldset>
                                <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Organization Type</legend>
                                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                    {orgTypeOptions.map((opt) => (
                                        <label
                                            key={opt.value}
                                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition-all ${
                                                form.kind === opt.value
                                                    ? 'border-[#1f6feb] bg-blue-50 dark:bg-blue-500/10'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="orgKind"
                                                value={opt.value}
                                                checked={form.kind === opt.value}
                                                onChange={(e) => setForm((c) => ({ ...c, kind: e.target.value as CreatableOrganizationKind }))}
                                                className="mt-0.5 accent-[#1f6feb]"
                                            />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-950 dark:text-white">{opt.label}</p>
                                                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{opt.description}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Description (Optional)</span>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                                    className={textareaClass}
                                    placeholder="Short internal note about this organization."
                                />
                            </label>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Link
                                to="/tournaments/setup"
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={saving || !form.displayName.trim()}
                                className="inline-flex items-center gap-2 rounded-full bg-[#00c853] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#00e676] disabled:opacity-60"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Create Organization
                            </button>
                        </div>
                    </form>

                    {/* Sidebar — My Organizations */}
                    <aside className="flex flex-col gap-4">
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                                <p className="text-sm font-semibold text-slate-950 dark:text-white">My Organizations</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Existing organizations linked to your account.</p>
                            </div>
                            {orgsLoading ? (
                                <div className="flex items-center justify-center px-6 py-10">
                                    <Loader2 className="h-5 w-5 animate-spin text-[#00c853]" />
                                </div>
                            ) : organizations.length === 0 ? (
                                <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No organizations yet. Create one to start organizing events.
                                </div>
                            ) : (
                                <div className="max-h-[400px] divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
                                    {organizations.map((org) => (
                                        <div key={org.id} className="px-6 py-4">
                                            <p className="text-sm font-semibold text-slate-950 dark:text-white">{org.displayName}</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">{membershipRoleLabel(org.membershipRole)}</span>
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">{organizationKindLabel(org.primaryKind)}</span>
                                                {org.canCreateTournament && (
                                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#00c853] dark:bg-blue-500/10 dark:text-[#00c853]">Event Access</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};
