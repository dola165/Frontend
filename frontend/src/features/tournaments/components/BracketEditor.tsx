import { useMemo, useState } from 'react';
import { Loader2, Trophy, Undo2, XCircle, Edit3 } from 'lucide-react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { cancelFixture, completeFixture, reopenFixture, updateFixtureScores } from '../api';
import type { TournamentDetail, TournamentEntryDto, TournamentFixtureDto, TournamentStageDto } from '../domain';
import { fixtureStatusTone, tournamentScopeLabel } from '../domain';

interface Props {
    tournamentId: number;
    tournament: TournamentDetail;
    onRefresh: () => void;
}

const statusToneBorder: Record<string, string> = {
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
};

type ModalMode = 'scores' | 'complete' | null;

const entryLabel = (entry: TournamentEntryDto | undefined): string => {
    if (!entry) return '—';
    return entry.displayName ?? entry.clubName ?? entry.squadName ?? `Entry #${entry.id}`;
};

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1f6feb] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#4c8dff]';
const selectClass = inputClass;
const btnDefault = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';
const btnDestructive = 'inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-500/10';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-full bg-[#1f6feb] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1957bb] disabled:opacity-50';

export const BracketEditor = ({ tournamentId, tournament, onRefresh }: Props) => {
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [selectedFixture, setSelectedFixture] = useState<TournamentFixtureDto | null>(null);
    const [homeScore, setHomeScore] = useState('');
    const [awayScore, setAwayScore] = useState('');
    const [winnerEntryId, setWinnerEntryId] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const entriesById = useMemo(() => {
        const map = new Map<number, TournamentEntryDto>();
        (tournament.entries ?? []).forEach((e) => map.set(e.id, e));
        return map;
    }, [tournament.entries]);

    const stages = tournament.stages ?? [];
    const fixtures = tournament.fixtures ?? [];

    const fixturesByStage = useMemo(() => {
        const grouped = new Map<number | null, TournamentFixtureDto[]>();
        fixtures.forEach((f) => {
            const key = f.stageId;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(f);
        });
        return grouped;
    }, [fixtures]);

    const openScoresModal = (fixture: TournamentFixtureDto) => {
        setSelectedFixture(fixture);
        setHomeScore(fixture.homeScore != null ? String(fixture.homeScore) : '');
        setAwayScore(fixture.awayScore != null ? String(fixture.awayScore) : '');
        setModalMode('scores');
    };

    const openCompleteModal = (fixture: TournamentFixtureDto) => {
        setSelectedFixture(fixture);
        setHomeScore(fixture.homeScore != null ? String(fixture.homeScore) : '');
        setAwayScore(fixture.awayScore != null ? String(fixture.awayScore) : '');
        setWinnerEntryId(fixture.homeEntryId != null ? String(fixture.homeEntryId) : '');
        setModalMode('complete');
    };

    const closeModal = () => {
        setModalMode(null);
        setSelectedFixture(null);
    };

    const handleUpdateScores = async () => {
        if (!selectedFixture) return;
        setSaving(true);
        try {
            await updateFixtureScores(tournamentId, selectedFixture.id, {
                homeScore: homeScore ? Number(homeScore) : null,
                awayScore: awayScore ? Number(awayScore) : null,
            });
            showMessage('Scores updated', 'success');
            closeModal();
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to update scores'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCompleteFixture = async () => {
        if (!selectedFixture || !winnerEntryId) return;
        setSaving(true);
        try {
            await completeFixture(tournamentId, selectedFixture.id, {
                winnerEntryId: Number(winnerEntryId),
                homeScore: homeScore ? Number(homeScore) : null,
                awayScore: awayScore ? Number(awayScore) : null,
            });
            showMessage('Fixture completed', 'success');
            closeModal();
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to complete fixture'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleReopen = async (fixtureId: number) => {
        setSaving(true);
        try {
            await reopenFixture(tournamentId, fixtureId);
            showMessage('Fixture reopened', 'success');
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to reopen fixture'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async (fixtureId: number) => {
        setSaving(true);
        try {
            await cancelFixture(tournamentId, fixtureId);
            showMessage('Fixture cancelled', 'success');
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to cancel fixture'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const getParticipantsForFixture = (fixture: TournamentFixtureDto) => {
        const home = fixture.homeEntryId != null ? entriesById.get(fixture.homeEntryId) : undefined;
        const away = fixture.awayEntryId != null ? entriesById.get(fixture.awayEntryId) : undefined;
        return { home, away };
    };

    if (fixtures.length === 0) {
        return (
            <div>
                <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bracketing</p>
                </div>
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Trophy className="mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No fixtures yet</p>
                    <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">Create stages and fixtures to start managing the bracket.</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Stats bar */}
            <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                <div className="px-4 py-3 text-center">
                    <p className="text-xl font-bold text-slate-950 dark:text-white">{fixtures.length}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Fixtures</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className="text-xl font-bold text-slate-950 dark:text-white">{stages.length}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Stages</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className="text-xl font-bold text-slate-950 dark:text-white">{tournament.entries?.length ?? 0}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Entries</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className="text-xl font-bold text-slate-950 dark:text-white">{tournamentScopeLabel(tournament.participantScope)}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Scope</p>
                </div>
            </div>

            {/* Message toast */}
            {message && (
                <div className={`border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800 ${
                    messageType === 'success'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                }`}>
                    {message}
                </div>
            )}

            {/* Fixtures by stage */}
            {stages.map((stage) => {
                const stageFixtures = fixturesByStage.get(stage.id) ?? [];
                if (stageFixtures.length === 0) return null;
                return (
                    <div key={stage.id}>
                        <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {stage.name}
                                <span className="ml-2 font-normal text-slate-400">
                                    {stage.stageType} &middot; {stage.status}
                                </span>
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">#</th>
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Home</th>
                                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400" style={{ width: 60 }}>Score</th>
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Away</th>
                                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                                        <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stageFixtures.map((fx) => {
                                        const { home, away } = getParticipantsForFixture(fx);
                                        const tone = fixtureStatusTone(fx.status);
                                        const isComplete = fx.status === 'COMPLETED';
                                        const isScheduled = fx.status === 'SCHEDULED';
                                        return (
                                            <tr key={fx.id} className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${isComplete ? 'opacity-70' : ''}`}>
                                                <td className="px-5 py-3 text-xs font-medium text-slate-400">
                                                    {fx.roundNumber != null ? `R${fx.roundNumber}` : '—'}
                                                </td>
                                                <td className="px-5 py-3 text-sm font-semibold text-slate-950 dark:text-white">
                                                    {entryLabel(home)}
                                                    {fx.winnerEntryId != null && fx.winnerEntryId === fx.homeEntryId && (
                                                        <Trophy className="ml-1.5 inline-block h-3.5 w-3.5 text-amber-500" />
                                                    )}
                                                </td>
                                                <td className="px-2 py-3 text-center text-sm font-bold tabular-nums text-slate-950 dark:text-white">
                                                    {fx.homeScore != null && fx.awayScore != null ? `${fx.homeScore} - ${fx.awayScore}` : '—'}
                                                </td>
                                                <td className="px-5 py-3 text-sm font-semibold text-slate-950 dark:text-white">
                                                    {entryLabel(away)}
                                                    {fx.winnerEntryId != null && fx.winnerEntryId === fx.awayEntryId && (
                                                        <Trophy className="ml-1.5 inline-block h-3.5 w-3.5 text-amber-500" />
                                                    )}
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                                        {fx.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {(isScheduled || isComplete) && (
                                                            <button onClick={() => openScoresModal(fx)} className={btnDefault} title="Edit scores">
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {isScheduled && fx.homeEntryId != null && fx.awayEntryId != null && (
                                                            <button onClick={() => openCompleteModal(fx)} className={btnDestructive} title="Force complete">
                                                                <Trophy className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {isComplete && (
                                                            <button onClick={() => handleReopen(fx.id)} disabled={saving} className={btnDefault} title="Reopen fixture">
                                                                <Undo2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {!isComplete && fx.status !== 'CANCELLED' && (
                                                            <button onClick={() => handleCancel(fx.id)} disabled={saving} className={btnDestructive} title="Cancel fixture">
                                                                <XCircle className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}

            {/* Un-staged fixtures */}
            {(() => {
                const orphanFixtures = fixturesByStage.get(null) ?? [];
                if (orphanFixtures.length === 0) return null;
                return (
                    <div>
                        <div className="border-b border-slate-200 bg-[#f2f4f7] px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Unassigned Fixtures</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">#</th>
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Home</th>
                                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400" style={{ width: 60 }}>Score</th>
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Away</th>
                                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">Status</th>
                                        <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orphanFixtures.map((fx) => {
                                        const { home, away } = getParticipantsForFixture(fx);
                                        const tone = fixtureStatusTone(fx.status);
                                        const isComplete = fx.status === 'COMPLETED';
                                        const isScheduled = fx.status === 'SCHEDULED';
                                        return (
                                            <tr key={fx.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                                                <td className="px-5 py-3 text-xs font-medium text-slate-400">—</td>
                                                <td className="px-5 py-3 text-sm font-semibold text-slate-950 dark:text-white">{entryLabel(home)}</td>
                                                <td className="px-2 py-3 text-center text-sm font-bold tabular-nums text-slate-950 dark:text-white">
                                                    {fx.homeScore != null && fx.awayScore != null ? `${fx.homeScore} - ${fx.awayScore}` : '—'}
                                                </td>
                                                <td className="px-5 py-3 text-sm font-semibold text-slate-950 dark:text-white">{entryLabel(away)}</td>
                                                <td className="px-2 py-3 text-center">
                                                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                                        {fx.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {(isScheduled || isComplete) && (
                                                            <button onClick={() => openScoresModal(fx)} className={btnDefault} title="Edit scores">
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {isScheduled && fx.homeEntryId != null && fx.awayEntryId != null && (
                                                            <button onClick={() => openCompleteModal(fx)} className={btnDestructive} title="Force complete">
                                                                <Trophy className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {isComplete && (
                                                            <button onClick={() => handleReopen(fx.id)} disabled={saving} className={btnDefault} title="Reopen fixture">
                                                                <Undo2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        {!isComplete && fx.status !== 'CANCELLED' && (
                                                            <button onClick={() => handleCancel(fx.id)} disabled={saving} className={btnDestructive} title="Cancel fixture">
                                                                <XCircle className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}

            {/* Modal Overlay */}
            {modalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
                    <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
                        {modalMode === 'scores' && selectedFixture && (
                            <>
                                <div className="rounded-t-[28px] border-b border-slate-200 bg-[#f2f4f7] px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                                    <p className="text-base font-semibold text-slate-950 dark:text-white">Update Scores</p>
                                </div>
                                <div className="space-y-5 p-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {entryLabel(entriesById.get(selectedFixture.homeEntryId!))}
                                            </span>
                                            <input type="number" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className={inputClass} placeholder="Home" />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {entryLabel(entriesById.get(selectedFixture.awayEntryId!))}
                                            </span>
                                            <input type="number" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className={inputClass} placeholder="Away" />
                                        </label>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <button onClick={closeModal} className={btnDefault}>Cancel</button>
                                        <button onClick={handleUpdateScores} disabled={saving} className={btnPrimary}>
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                            Save Scores
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {modalMode === 'complete' && selectedFixture && (
                            <>
                                <div className="rounded-t-[28px] border-b border-amber-200 bg-amber-50 px-6 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                                    <p className="text-base font-semibold text-amber-800 dark:text-amber-300">Force Complete Fixture</p>
                                </div>
                                <div className="space-y-5 p-6">
                                    <label className="flex flex-col gap-2">
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Winner</span>
                                        <select value={winnerEntryId} onChange={(e) => setWinnerEntryId(e.target.value)} className={selectClass}>
                                            <option value="">Select winner...</option>
                                            {selectedFixture.homeEntryId != null && (
                                                <option value={selectedFixture.homeEntryId}>{entryLabel(entriesById.get(selectedFixture.homeEntryId))} (Home)</option>
                                            )}
                                            {selectedFixture.awayEntryId != null && (
                                                <option value={selectedFixture.awayEntryId}>{entryLabel(entriesById.get(selectedFixture.awayEntryId))} (Away)</option>
                                            )}
                                        </select>
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Home Score</span>
                                            <input type="number" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className={inputClass} />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Away Score</span>
                                            <input type="number" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className={inputClass} />
                                        </label>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <button onClick={closeModal} className={btnDefault}>Cancel</button>
                                        <button onClick={handleCompleteFixture} disabled={saving || !winnerEntryId} className={btnDestructive}>
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                                            Force Complete
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
