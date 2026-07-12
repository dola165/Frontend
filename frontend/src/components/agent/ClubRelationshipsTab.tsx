import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { fetchMyEngagements, initiateEngagement } from '../../features/agents/api';
import type { AgentEngagement } from '../../features/agents/domain';
import { SectionHeader } from '../workspace/helpers';
import { EmptyStateCard } from '../workspace/EmptyStateCard';
import { OverflowActions } from '../ui/OverflowActions';

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400',
    ACTIVE: 'bg-[#16a34a]/10 text-[#16a34a]',
    DECLINED: 'bg-red-500/10 text-red-400',
    CANCELLED: 'bg-[#71717a]/10 text-[#71717a]',
    TERMINATED: 'bg-[#71717a]/10 text-[#71717a]'
};

export const ClubRelationshipsTab = () => {
    const [engagements, setEngagements] = useState<AgentEngagement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showEngageModal, setShowEngageModal] = useState(false);
    const [clubIdInput, setClubIdInput] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadEngagements = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMyEngagements();
            setEngagements(data);
        } catch (err) {
            console.error('Failed to load engagements', err);
            setError('Could not load club relationships.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEngagements();
    }, []);

    const handleInitiate = async () => {
        const id = parseInt(clubIdInput, 10);
        if (!id || isNaN(id)) return;
        setSubmitting(true);
        try {
            await initiateEngagement(id, notesInput || undefined);
            setShowEngageModal(false);
            setClubIdInput('');
            setNotesInput('');
            loadEngagements();
        } catch (err) {
            console.error('Failed to initiate engagement', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <SectionHeader
                title="Club Relationships"
                description="Clubs you have active engagements with"
                action={
                    <button
                        onClick={() => setShowEngageModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#16a34a] text-white text-xs font-semibold hover:bg-[#15803d] transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Initiate Engagement
                    </button>
                }
            />

            {loading && <p className="text-sm text-[#71717a] py-6">Loading...</p>}
            {error && <p className="text-sm text-[#d4737a] py-4">{error}</p>}

            {!loading && !error && engagements.length === 0 && (
                <EmptyStateCard
                    icon={Building2}
                    title="No club relationships"
                    description="Initiate an engagement with a club to start working together."
                    actionLabel="Initiate First Engagement"
                    actionIcon={Plus}
                    onAction={() => setShowEngageModal(true)}
                />
            )}

            {!loading && engagements.length > 0 && (
                <div className="space-y-3 mt-4">
                    {engagements.map(eng => (
                        <div
                            key={eng.engagementId}
                            className="flex items-center gap-4 px-4 py-3 rounded-md border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)]"
                        >
                            <div className="w-8 h-8 rounded-md bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0">
                                {eng.clubLogoUrl ? (
                                    <img src={eng.clubLogoUrl} alt="" className="w-6 h-6 rounded object-cover" />
                                ) : (
                                    <Building2 className="w-4 h-4 text-[#71717a]" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[#f4f4f5]">{eng.clubName}</p>
                                {eng.notes && <p className="text-xs text-[#71717a] truncate">{eng.notes}</p>}
                            </div>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[eng.status] || STATUS_COLORS.PENDING}`}>
                                {eng.status}
                            </span>
                            <span className="text-[11px] text-[#71717a] hidden sm:inline">
                                {new Date(eng.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Initiate Engagement Modal */}
            {showEngageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowEngageModal(false)}>
                    <div className="bg-[#16181d] border border-[#26282d] rounded-md p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-base font-semibold text-[#f4f4f5] mb-4">Initiate Club Engagement</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">Club ID</label>
                                <input type="number" value={clubIdInput} onChange={e => setClubIdInput(e.target.value)}
                                    className="w-full px-3 py-2 rounded-md border border-[#26282d] bg-[#0f1117] text-sm text-[#f4f4f5] outline-none focus:border-[#16a34a]"
                                    placeholder="Enter club ID" autoFocus />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">Notes (optional)</label>
                                <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)}
                                    className="w-full px-3 py-2 rounded-md border border-[#26282d] bg-[#0f1117] text-sm text-[#f4f4f5] outline-none focus:border-[#16a34a] h-20 resize-none"
                                    placeholder="e.g. Seeking trial opportunities for U16 striker..." />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={() => setShowEngageModal(false)} className="px-3 py-1.5 rounded-md border border-[#26282d] text-xs font-semibold text-[#a1a1aa]">Cancel</button>
                                <button onClick={handleInitiate} disabled={submitting || !clubIdInput} className="px-3 py-1.5 rounded-md bg-[#16a34a] text-white text-xs font-semibold hover:bg-[#15803d] disabled:opacity-50">
                                    {submitting ? 'Submitting...' : 'Initiate'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
