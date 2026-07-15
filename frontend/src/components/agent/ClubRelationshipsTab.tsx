import { useEffect, useRef, useState } from 'react';
import { Building2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchMyEngagements, initiateEngagement, searchClubs } from '../../features/agents/api';
import type { AgentEngagement } from '../../features/agents/domain';
import type { ClubSearchResult } from '../../features/tournaments/domain';
import { SectionHeader } from '../workspace/helpers';
import { EmptyStateCard } from '../workspace/EmptyStateCard';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [clubResults, setClubResults] = useState<ClubSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedClub, setSelectedClub] = useState<ClubSearchResult | null>(null);
    const [notesInput, setNotesInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

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

    // Debounced club search
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.trim().length < 2) {
            setClubResults([]);
            return;
        }
        let active = true;
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const results = await searchClubs(searchQuery);
                if (active) setClubResults(results);
            } catch {
                if (active) setClubResults([]);
            } finally {
                if (active) setSearching(false);
            }
        }, 300);
        return () => { active = false; clearTimeout(timer); };
    }, [searchQuery]);

    const handleSelectClub = (club: ClubSearchResult) => {
        setSelectedClub(club);
        setSearchQuery('');
        setClubResults([]);
    };

    const handleClearSelection = () => {
        setSelectedClub(null);
        setSubmitError(null);
        setTimeout(() => searchRef.current?.focus(), 0);
    };

    const handleInitiate = async () => {
        if (!selectedClub) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            await initiateEngagement(selectedClub.id, notesInput || undefined);
            setShowEngageModal(false);
            setSelectedClub(null);
            setSearchQuery('');
            setNotesInput('');
            setSubmitError(null);
            toast.success(`Engagement request sent to ${selectedClub.name}`);
            loadEngagements();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to initiate engagement.';
            setSubmitError(msg);
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenModal = () => {
        setShowEngageModal(true);
        setSelectedClub(null);
        setSearchQuery('');
        setClubResults([]);
        setNotesInput('');
        setSubmitError(null);
    };

    const handleCloseModal = () => {
        setShowEngageModal(false);
        setSelectedClub(null);
        setSearchQuery('');
        setClubResults([]);
        setNotesInput('');
        setSubmitError(null);
    };

    // Filter out clubs that already have an engagement
    const engagedClubIds = new Set(engagements.map(e => e.clubId));

    return (
        <div>
            <SectionHeader
                eyebrow="Relationships"
                title="Club Relationships"
                description="Clubs you have active engagements with"
                action={
                    <button
                        onClick={handleOpenModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#16a34a] text-white text-xs font-semibold hover:bg-[#15803d] transition-colors"
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
                    onAction={handleOpenModal}
                />
            )}

            {!loading && engagements.length > 0 && (
                <div className="space-y-3 mt-4">
                    {engagements.map(eng => (
                        <div
                            key={eng.engagementId}
                            className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)]"
                        >
                            <div className="w-8 h-8 rounded-xl bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleCloseModal}>
                    <div className="bg-[#16181d] border border-[#26282d] rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-base font-semibold text-[#f4f4f5] mb-4">Initiate Club Engagement</h3>

                        {/* Club Search / Selection */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">Find Club</label>

                                {selectedClub ? (
                                    /* Selected club chip */
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[#16a34a]/30 bg-[#16a34a]/5">
                                        <div className="w-8 h-8 rounded-xl bg-[rgba(255,255,255,0.08)] flex items-center justify-center shrink-0 overflow-hidden">
                                            {selectedClub.logoUrl ? (
                                                <img src={selectedClub.logoUrl} alt="" className="w-6 h-6 rounded object-cover" />
                                            ) : (
                                                <Building2 className="w-4 h-4 text-[#16a34a]" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-[#f4f4f5] truncate">{selectedClub.name}</p>
                                            <p className="text-[11px] text-[#a1a1aa]">
                                                {[selectedClub.cityName, selectedClub.countryName].filter(Boolean).join(', ') || '—'}
                                                {selectedClub.memberCount != null && ` · ${selectedClub.memberCount} members`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleClearSelection}
                                            className="p-1 rounded hover:bg-[rgba(255,255,255,0.06)] text-[#71717a] hover:text-[#a1a1aa] transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    /* Search input */
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717a]" />
                                        <input
                                            ref={searchRef}
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#26282d] bg-[#0f1117] text-sm text-[#f4f4f5] outline-none focus:border-[#16a34a]"
                                            placeholder="Search clubs by name..."
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {/* Search results dropdown */}
                                {!selectedClub && (searchQuery.trim().length >= 2 || searching) && (
                                    <div className="mt-1 max-h-[220px] overflow-y-auto rounded-xl border border-[#26282d] bg-[#0f1117]">
                                        {searching && clubResults.length === 0 && (
                                            <p className="px-3 py-3 text-xs text-[#71717a]">Searching…</p>
                                        )}
                                        {!searching && searchQuery.trim().length >= 2 && clubResults.length === 0 && (
                                            <p className="px-3 py-3 text-xs text-[#71717a]">No clubs found.</p>
                                        )}
                                        {clubResults.map(club => {
                                            const alreadyEngaged = engagedClubIds.has(club.id);
                                            return (
                                                <button
                                                    key={club.id}
                                                    onClick={() => !alreadyEngaged && handleSelectClub(club)}
                                                    disabled={alreadyEngaged}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                                        alreadyEngaged
                                                            ? 'opacity-40 cursor-not-allowed'
                                                            : 'hover:bg-[rgba(255,255,255,0.04)]'
                                                    }`}
                                                >
                                                    <div className="w-8 h-8 rounded-xl bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0 overflow-hidden">
                                                        {club.logoUrl ? (
                                                            <img src={club.logoUrl} alt="" className="w-5 h-5 rounded object-cover" />
                                                        ) : (
                                                            <Building2 className="w-3.5 h-3.5 text-[#71717a]" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-[#f4f4f5] truncate">{club.name}</p>
                                                        <p className="text-[11px] text-[#71717a]">
                                                            {[club.cityName, club.countryName].filter(Boolean).join(', ') || '—'}
                                                            {club.memberCount != null && ` · ${club.memberCount} members`}
                                                        </p>
                                                    </div>
                                                    {alreadyEngaged && (
                                                        <span className="text-[10px] text-[#71717a] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">Engaged</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            {selectedClub && (
                                <div>
                                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">Notes (optional)</label>
                                    <textarea
                                        value={notesInput}
                                        onChange={e => setNotesInput(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-[#26282d] bg-[#0f1117] text-sm text-[#f4f4f5] outline-none focus:border-[#16a34a] h-20 resize-none"
                                        placeholder="e.g. Seeking trial opportunities for U16 striker..."
                                    />
                                </div>
                            )}

                            {/* Submit error */}
                            {submitError && (
                                <p className="text-xs text-red-400">{submitError}</p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 justify-end pt-2">
                                <button onClick={handleCloseModal} className="px-3 py-1.5 rounded-xl border border-[#26282d] text-xs font-semibold text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleInitiate}
                                    disabled={submitting || !selectedClub}
                                    className="px-3 py-1.5 rounded-xl bg-[#16a34a] text-white text-xs font-semibold hover:bg-[#15803d] disabled:opacity-50 transition-colors"
                                >
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
