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

    const formControlClass = 'theme-surface-strong theme-border w-full border px-3 py-2.5 text-sm font-semibold text-[#f4f4f5] outline-none transition-colors focus:border-[#16a34a] disabled:opacity-60';

    return (
        <div className="theme-overlay-strong fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="theme-surface theme-border flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-[#ffffff0d] px-6 py-5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#ffffff0d] bg-[#0f1117]">
                            <Swords className="h-4 w-4 accent-muted" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold uppercase tracking-tight text-[#f4f4f5]">
                                Issue Challenge
                            </h2>
                            <p className="text-[11px] font-semibold  text-[#a1a1aa]">
                                versus {targetClubName}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center border border-[#ffffff0d] bg-[#0f1117] text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-5 p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">
                                Challenge Type
                            </label>
                            <select
                                value={formData.matchType}
                                onChange={(event) => updateField('matchType', event.target.value as MatchChallengePayload['matchType'])}
                                className={formControlClass}
                            >
                                <option value="FRIENDLY">Friendly</option>
                                <option value="COMPETITIVE">Competitive</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-semibold  text-[#a1a1aa]">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Proposed Kickoff
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.proposedDate}
                                onChange={(event) => updateField('proposedDate', event.target.value)}
                                className={formControlClass}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">
                                Your Squad
                            </label>
                            <select
                                value={formData.challengingSquadId}
                                onChange={(event) => updateField('challengingSquadId', event.target.value)}
                                disabled={isLoadingSquads}
                                className={formControlClass}
                            >
                                <option value="">Whole club / not specified</option>
                                {sourceSquads.map((squad) => (
                                    <option key={squad.id} value={squad.id}>
                                        {formatSquadLabel(squad)}
                                    </option>
                                ))}
                            </select>
                            {selectedSourceSquad && (
                                <p className="text-[11px] font-semibold  text-[#16a34a]">
                                    {selectedSourceSquad.category} / {selectedSourceSquad.gender}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">
                                Requested Opponent Squad
                            </label>
                            <select
                                value={formData.targetSquadId}
                                onChange={(event) => updateField('targetSquadId', event.target.value)}
                                disabled={isLoadingSquads}
                                className={formControlClass}
                            >
                                <option value="">Any suitable squad</option>
                                {targetSquads.map((squad) => (
                                    <option key={squad.id} value={squad.id}>
                                        {formatSquadLabel(squad)}
                                    </option>
                                ))}
                            </select>
                            {selectedTargetSquad && (
                                <p className="text-[11px] font-semibold  text-[#16a34a]">
                                    {selectedTargetSquad.category} / {selectedTargetSquad.gender}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-semibold  text-[#a1a1aa]">
                                <Shield className="h-3.5 w-3.5" />
                                Venue Preference
                            </label>
                            <select
                                value={formData.venuePreference}
                                onChange={(event) => updateField('venuePreference', event.target.value as NonNullable<MatchChallengePayload['venuePreference']>)}
                                className={formControlClass}
                            >
                                <option value="FLEXIBLE">Flexible</option>
                                <option value="HOME">Host at our club</option>
                                <option value="AWAY">We can travel</option>
                                <option value="NEUTRAL">Neutral site</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-semibold  text-[#a1a1aa]">
                                <MapPin className="h-3.5 w-3.5" />
                                Desired Location
                            </label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(event) => updateField('location', event.target.value)}
                                maxLength={255}
                                placeholder="Optional venue note or preferred ground"
                                className={formControlClass}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold  text-[#a1a1aa]">
                            Notes
                        </label>
                        <textarea
                            value={formData.message}
                            onChange={(event) => updateField('message', event.target.value)}
                            rows={4}
                            maxLength={500}
                            placeholder="Share context like age group balance, travel window, or the type of test you want."
                            className={`${formControlClass} resize-none`}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold  text-[#a1a1aa]">
                            <span>External messaging stays available separately from this challenge flow.</span>
                            <span>{formData.message.length}/500</span>
                        </div>
                    </div>

                    {isLoadingSquads && (
                        <div className="flex items-center gap-2 border border-[#ffffff0d] bg-[#0f1117] px-4 py-3 text-xs font-semibold  text-[#a1a1aa]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#16a34a]" />
                            Loading squad context
                        </div>
                    )}

                    {error && (
                        <div className="border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-[#ffffff0d] px-6 py-4 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="border border-[#ffffff0d] bg-[#0f1117] px-4 py-2 text-[11px] font-semibold  text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.proposedDate}
                        className="inline-flex items-center gap-2 border border-accent-muted bg-accent-muted-soft px-4 py-2 text-[11px] font-semibold  text-[color:var(--accent-muted)] transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send Challenge</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
