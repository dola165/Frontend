import { useState } from 'react';
import { Globe, Loader2, Lock, Save } from 'lucide-react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { updateTournament } from '../api';
import type { TournamentDetail, TournamentVisibility } from '../domain';

interface Props {
    tournament: TournamentDetail;
    onRefresh: () => void;
}

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#1f6feb] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#4c8dff]';

export const EventSettingsPanel = ({ tournament, onRefresh }: Props) => {
    const [name, setName] = useState(tournament.name);
    const [description, setDescription] = useState(tournament.description ?? '');
    const [rules, setRules] = useState(tournament.rules ?? '');
    const [visibility, setVisibility] = useState<TournamentVisibility>(tournament.visibility);
    const [registrationPolicy, setRegistrationPolicy] = useState<'OPEN' | 'INVITE_ONLY'>(
        tournament.registrationPolicy ?? 'OPEN',
    );
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const hasChanges =
        name !== tournament.name ||
        (description || '') !== (tournament.description ?? '') ||
        (rules || '') !== (tournament.rules ?? '') ||
        visibility !== tournament.visibility ||
        registrationPolicy !== (tournament.registrationPolicy ?? 'OPEN');

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await updateTournament(tournament.id, {
                name: name.trim() || null,
                description: description.trim() || null,
                rules: rules.trim() || null,
                visibility,
                registrationPolicy,
            });
            showMessage('Settings saved.', 'success');
            setName(updated.name);
            setDescription(updated.description ?? '');
            setRules(updated.rules ?? '');
            setVisibility(updated.visibility);
            setRegistrationPolicy(updated.registrationPolicy ?? 'OPEN');
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to save settings.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Event Settings</p>
            </div>

            {message && (
                <div className={`border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800 ${
                    messageType === 'success'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                }`}>
                    {message}
                </div>
            )}

            <div className="space-y-5 p-6">
                <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Event Name</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Event name" />
                </label>

                <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Description</span>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-h-[80px] resize-none`} placeholder="Short note about this event." />
                </label>

                <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rules</span>
                    <textarea value={rules} onChange={(e) => setRules(e.target.value)} className={`${inputClass} min-h-[80px] resize-none`} placeholder="Bracket, tie-break, or eligibility notes." />
                </label>

                <fieldset>
                    <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Visibility</legend>
                    <div className="mt-2 flex gap-3">
                        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
                            visibility === 'PUBLIC'
                                ? 'border-[#1f6feb] bg-blue-50 dark:bg-blue-500/10'
                                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                        }`}>
                            <input type="radio" name="settings-visibility" value="PUBLIC" checked={visibility === 'PUBLIC'} onChange={() => setVisibility('PUBLIC')} className="accent-[#1f6feb]" />
                            <div>
                                <Globe className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">Public</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Visible in discovery</p>
                            </div>
                        </label>
                        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
                            visibility === 'PRIVATE'
                                ? 'border-[#1f6feb] bg-blue-50 dark:bg-blue-500/10'
                                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                        }`}>
                            <input type="radio" name="settings-visibility" value="PRIVATE" checked={visibility === 'PRIVATE'} onChange={() => setVisibility('PRIVATE')} className="accent-[#1f6feb]" />
                            <div>
                                <Lock className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">Private</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Invite or link only</p>
                            </div>
                        </label>
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Registration</legend>
                    <div className="mt-2 flex gap-3">
                        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
                            registrationPolicy === 'OPEN'
                                ? 'border-[#1f6feb] bg-blue-50 dark:bg-blue-500/10'
                                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                        }`}>
                            <input type="radio" name="settings-registration" value="OPEN" checked={registrationPolicy === 'OPEN'} onChange={() => setRegistrationPolicy('OPEN')} className="accent-[#1f6feb]" />
                            <div>
                                <p className="text-sm font-semibold text-slate-950 dark:text-white">Open</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Anyone can apply</p>
                            </div>
                        </label>
                        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
                            registrationPolicy === 'INVITE_ONLY'
                                ? 'border-[#1f6feb] bg-blue-50 dark:bg-blue-500/10'
                                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                        }`}>
                            <input type="radio" name="settings-registration" value="INVITE_ONLY" checked={registrationPolicy === 'INVITE_ONLY'} onChange={() => setRegistrationPolicy('INVITE_ONLY')} className="accent-[#1f6feb]" />
                            <div>
                                <p className="text-sm font-semibold text-slate-950 dark:text-white">Invite-Only</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Host must invite</p>
                            </div>
                        </label>
                    </div>
                </fieldset>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges || !name.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-[#1f6feb] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1957bb] disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
