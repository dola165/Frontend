import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, MapPin, Send, Shield, Swords, X } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';

interface SquadOption {
    id: number;
    name: string;
    category: string;
    gender: string;
}

export interface MatchChallengePayload {
    targetClubId: number;
    challengingSquadId?: number;
    targetSquadId?: number;
    matchType: 'FRIENDLY' | 'COMPETITIVE';
    proposedDate: string;
    location?: string;
    venuePreference?: 'HOME' | 'AWAY' | 'NEUTRAL' | 'FLEXIBLE';
    message?: string;
}

interface MatchInviteModalProps {
    sourceClubId: number;
    targetClubId: number;
    targetClubName: string;
    onClose: () => void;
    onSubmit: (inviteData: MatchChallengePayload) => Promise<void>;
}

const formatSquadLabel = (squad: SquadOption) => {
    const parts = [squad.name, squad.category, squad.gender].filter(Boolean);
    return parts.join(' / ');
};

export const MatchInviteModal = ({
    sourceClubId,
    targetClubId,
    targetClubName,
    onClose,
    onSubmit
}: MatchInviteModalProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingSquads, setIsLoadingSquads] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sourceSquads, setSourceSquads] = useState<SquadOption[]>([]);
    const [targetSquads, setTargetSquads] = useState<SquadOption[]>([]);
    const [formData, setFormData] = useState({
        matchType: 'FRIENDLY' as MatchChallengePayload['matchType'],
        proposedDate: '',
        challengingSquadId: '',
        targetSquadId: '',
        venuePreference: 'FLEXIBLE' as NonNullable<MatchChallengePayload['venuePreference']>,
        location: '',
        message: ''
    });

    useEffect(() => {
        let isMounted = true;

        Promise.all([
            apiClient.get<SquadOption[]>(`/clubs/${sourceClubId}/squads`),
            apiClient.get<SquadOption[]>(`/clubs/${targetClubId}/squads`)
        ])
            .then(([sourceRes, targetRes]) => {
                if (!isMounted) {
                    return;
                }
                setSourceSquads(sourceRes.data || []);
                setTargetSquads(targetRes.data || []);
            })
            .catch((requestError) => {
                if (!isMounted) {
                    return;
                }
                setError(extractApiErrorMessage(requestError, 'Challenge details loaded, but squad context is temporarily unavailable.'));
                setSourceSquads([]);
                setTargetSquads([]);
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingSquads(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [sourceClubId, targetClubId]);

    const selectedSourceSquad = useMemo(
        () => sourceSquads.find((squad) => String(squad.id) === formData.challengingSquadId) ?? null,
        [formData.challengingSquadId, sourceSquads]
    );
    const selectedTargetSquad = useMemo(
        () => targetSquads.find((squad) => String(squad.id) === formData.targetSquadId) ?? null,
        [formData.targetSquadId, targetSquads]
    );

    const updateField = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
        setFormData((current) => ({ ...current, [field]: value }));
        if (error) {
            setError(null);
        }
    };

    const handleSubmit = async () => {
        if (!formData.proposedDate) {
            setError('A proposed date and time are required.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                targetClubId,
                challengingSquadId: formData.challengingSquadId ? Number(formData.challengingSquadId) : undefined,
                targetSquadId: formData.targetSquadId ? Number(formData.targetSquadId) : undefined,
                matchType: formData.matchType,
                proposedDate: formData.proposedDate,
                location: formData.location.trim() || undefined,
                venuePreference: formData.venuePreference,
                message: formData.message.trim() || undefined
            });
            onClose();
        } catch (submitError) {
            console.error('Failed to send challenge', submitError);
            setError(extractApiErrorMessage(submitError, 'Failed to send challenge. Please try again.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="theme-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-surface theme-border w-full max-w-2xl overflow-hidden rounded-lg border-2 shadow-2xl">
                <div className="theme-surface-strong theme-border flex items-center justify-between border-b p-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/20">
                            <Swords className="h-4 w-4 text-rose-600 dark:text-rose-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white">
                                Issue Challenge
                            </h2>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                versus {targetClubName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 transition-colors hover:text-rose-500"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-5 p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Challenge Type
                            </label>
                            <select
                                value={formData.matchType}
                                onChange={(event) => updateField('matchType', event.target.value as MatchChallengePayload['matchType'])}
                                className="theme-surface-strong theme-border w-full rounded-sm border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 dark:text-white"
                            >
                                <option value="FRIENDLY">Friendly</option>
                                <option value="COMPETITIVE">Competitive</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Proposed Kickoff
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.proposedDate}
                                onChange={(event) => updateField('proposedDate', event.target.value)}
                                className="theme-surface-strong theme-border w-full rounded-sm border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Your Squad
                            </label>
                            <select
                                value={formData.challengingSquadId}
                                onChange={(event) => updateField('challengingSquadId', event.target.value)}
                                disabled={isLoadingSquads}
                                className="theme-surface-strong theme-border w-full rounded-sm border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 disabled:opacity-60 dark:text-white"
                            >
                                <option value="">Whole club / not specified</option>
                                {sourceSquads.map((squad) => (
                                    <option key={squad.id} value={squad.id}>
                                        {formatSquadLabel(squad)}
                                    </option>
                                ))}
                            </select>
                            {selectedSourceSquad && (
                                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500">
                                    {selectedSourceSquad.category} / {selectedSourceSquad.gender}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Requested Opponent Squad
                            </label>
                            <select
                                value={formData.targetSquadId}
                                onChange={(event) => updateField('targetSquadId', event.target.value)}
                                disabled={isLoadingSquads}
                                className="theme-surface-strong theme-border w-full rounded-sm border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 disabled:opacity-60 dark:text-white"
                            >
                                <option value="">Any suitable squad</option>
                                {targetSquads.map((squad) => (
                                    <option key={squad.id} value={squad.id}>
                                        {formatSquadLabel(squad)}
                                    </option>
                                ))}
                            </select>
                            {selectedTargetSquad && (
                                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500">
                                    {selectedTargetSquad.category} / {selectedTargetSquad.gender}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                <Shield className="h-3.5 w-3.5" />
                                Venue Preference
                            </label>
                            <select
                                value={formData.venuePreference}
                                onChange={(event) => updateField('venuePreference', event.target.value as NonNullable<MatchChallengePayload['venuePreference']>)}
                                className="theme-surface-strong theme-border w-full rounded-sm border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 dark:text-white"
                            >
                                <option value="FLEXIBLE">Flexible</option>
                                <option value="HOME">Host at our club</option>
                                <option value="AWAY">We can travel</option>
                                <option value="NEUTRAL">Neutral site</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                <MapPin className="h-3.5 w-3.5" />
                                Desired Location
                            </label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(event) => updateField('location', event.target.value)}
                                maxLength={255}
                                placeholder="Optional venue note or preferred ground"
                                className="theme-surface-strong theme-border w-full rounded-sm border px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 dark:text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Notes
                        </label>
                        <textarea
                            value={formData.message}
                            onChange={(event) => updateField('message', event.target.value)}
                            rows={4}
                            maxLength={500}
                            placeholder="Share context like age group balance, travel window, or the type of test you want."
                            className="theme-surface-strong theme-border w-full resize-none rounded-sm border px-3 py-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 dark:text-white"
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                            <span>External messaging stays available separately from this challenge flow.</span>
                            <span>{formData.message.length}/500</span>
                        </div>
                    </div>

                    {isLoadingSquads && (
                        <div className="flex items-center gap-2 rounded-md border border-slate-300/60 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                            Loading squad context
                        </div>
                    )}

                    {error && (
                        <div className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                            {error}
                        </div>
                    )}
                </div>

                <div className="theme-surface-strong theme-border flex justify-end gap-3 border-t p-5">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.proposedDate}
                        className="flex items-center gap-2 rounded-sm border border-transparent bg-rose-600 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-[4px_4px_0px_0px_#020617] transition-all active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 hover:bg-rose-500"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send Challenge</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
