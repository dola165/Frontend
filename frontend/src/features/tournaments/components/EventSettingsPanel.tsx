import { useState } from 'react';
import { Globe, Loader2, Lock, Save } from 'lucide-react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { updateTournament } from '../api';
import type { TournamentDetail, TournamentVisibility } from '../domain';

interface Props {
    tournament: TournamentDetail;
    onRefresh: () => void;
}

const inputClass = 'w-full rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-3 text-sm text-[#f4f4f5] outline-none transition-colors placeholder:text-[#a1a1aa] focus:border-[#16a34a]';

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

    const radioSelected = 'border-[#16a34a] bg-[#16a34a]/10';
    const radioDefault = 'border-[#ffffff0d] bg-[#16181d] hover:bg-[#1a1c22]';

    return (
        <div>
            <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                <p className="text-sm font-semibold text-[#f4f4f5]">Event Settings</p>
            </div>

            {message && (
                <div className={`border-b border-[#ffffff0d] px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'bg-[#16a34a]/10 text-[#16a34a]'
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                }`}>
                    {message}
                </div>
            )}

            <div className="space-y-5 p-6">
                <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-[#f4f4f5]">Event Name</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Event name" />
                </label>

                <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-[#f4f4f5]">Description</span>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-h-[80px] resize-none`} placeholder="Short note about this event." />
                </label>

                <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-[#f4f4f5]">Rules</span>
                    <textarea value={rules} onChange={(e) => setRules(e.target.value)} className={`${inputClass} min-h-[80px] resize-none`} placeholder="Bracket, tie-break, or eligibility notes." />
                </label>

                <fieldset>
                    <legend className="text-sm font-semibold text-[#f4f4f5]">Visibility</legend>
                    <div className="mt-2 flex gap-3">
                        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                            visibility === 'PUBLIC' ? radioSelected : radioDefault
                        }`}>
                            <input type="radio" name="settings-visibility" value="PUBLIC" checked={visibility === 'PUBLIC'} onChange={() => setVisibility('PUBLIC')} className="accent-[#16a34a]" />
                            <div>
                                <Globe className="h-4 w-4 text-[#a1a1aa]" />
                                <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">Public</p>
                                <p className="text-xs text-[#a1a1aa]">Visible in discovery</p>
                            </div>
                        </label>
                        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                            visibility === 'PRIVATE' ? radioSelected : radioDefault
                        }`}>
                            <input type="radio" name="settings-visibility" value="PRIVATE" checked={visibility === 'PRIVATE'} onChange={() => setVisibility('PRIVATE')} className="accent-[#16a34a]" />
                            <div>
                                <Lock className="h-4 w-4 text-[#a1a1aa]" />
                                <p className="mt-1 text-sm font-semibold text-[#f4f4f5]">Private</p>
                                <p className="text-xs text-[#a1a1aa]">Invite or link only</p>
                            </div>
                        </label>
                    </div>
                </fieldset>

                <fieldset>
                    <legend className="text-sm font-semibold text-[#f4f4f5]">Registration</legend>
                    <div className="mt-2 flex gap-3">
                        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                            registrationPolicy === 'OPEN' ? radioSelected : radioDefault
                        }`}>
                            <input type="radio" name="settings-registration" value="OPEN" checked={registrationPolicy === 'OPEN'} onChange={() => setRegistrationPolicy('OPEN')} className="accent-[#16a34a]" />
                            <div>
                                <p className="text-sm font-semibold text-[#f4f4f5]">Open</p>
                                <p className="text-xs text-[#a1a1aa]">Anyone can apply</p>
                            </div>
                        </label>
                        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                            registrationPolicy === 'INVITE_ONLY' ? radioSelected : radioDefault
                        }`}>
                            <input type="radio" name="settings-registration" value="INVITE_ONLY" checked={registrationPolicy === 'INVITE_ONLY'} onChange={() => setRegistrationPolicy('INVITE_ONLY')} className="accent-[#16a34a]" />
                            <div>
                                <p className="text-sm font-semibold text-[#f4f4f5]">Invite-Only</p>
                                <p className="text-xs text-[#a1a1aa]">Host must invite</p>
                            </div>
                        </label>
                    </div>
                </fieldset>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges || !name.trim()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e] disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
