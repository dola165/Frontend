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
    info: 'border-sky-600 text-sky-600',
    success: 'border-emerald-600 text-emerald-600',
    danger: 'border-rose-600 text-rose-600',
    neutral: 'border-zinc-500 text-zinc-500',
};

type ModalMode = 'scores' | 'complete' | null;

const entryLabel = (entry: TournamentEntryDto | undefined): string => {
    if (!entry) return '—';
    return entry.displayName ?? entry.clubName ?? entry.squadName ?? `Entry #${entry.id}`;
};

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
            showMessage('Fixture completed — bracket advanced', 'success');
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
            showMessage('Fixture reopened — downstream slots cleared', 'success');
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
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Trophy className="mb-4 h-10 w-10 text-muted" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">No fixtures yet</p>
                <p className="mt-2 text-xs text-muted">Create stages and fixtures to start managing the bracket.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0">
            {/* Stats bar */}
            <div className="tw-stat-grid">
                <div className="tw-stat-cell">
                    <div className="tw-stat-value">{fixtures.length}</div>
                    <div className="tw-stat-label">Fixtures</div>
                </div>
                <div className="tw-stat-cell">
                    <div className="tw-stat-value">{stages.length}</div>
                    <div className="tw-stat-label">Stages</div>
                </div>
                <div className="tw-stat-cell">
                    <div className="tw-stat-value">{tournament.entries?.length ?? 0}</div>
                    <div className="tw-stat-label">Entries</div>
                </div>
                <div className="tw-stat-cell">
                    <div className="tw-stat-value">{tournamentScopeLabel(tournament.participantScope)}</div>
                    <div className="tw-stat-label">Scope</div>
                </div>
            </div>

            {/* Message toast */}
            {message && (
                <div className={`mx-0 mt-0 border px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
                    messageType === 'success'
                        ? 'border-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'border-rose-600 text-rose-600 bg-rose-50 dark:bg-rose-500/10'
                }`}>
                    {message}
                </div>
            )}

            {/* Fixtures by stage */}
            {stages.map((stage) => {
                const stageFixtures = fixturesByStage.get(stage.id) ?? [];
                if (stageFixtures.length === 0) return null;
                return (
                    <div key={stage.id} className="mt-0">
                        <div className="tw-section-header">
                            {stage.name}
                            <span className="ml-2 font-normal tracking-normal normal-case text-muted">
                                ({stage.stageType} &middot; {stage.status})
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="tw-table w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left">#</th>
                                        <th className="text-left">Home</th>
                                        <th className="text-center" style={{ width: 60 }}>Score</th>
                                        <th className="text-left">Away</th>
                                        <th className="text-center">Status</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stageFixtures.map((fx) => {
                                        const { home, away } = getParticipantsForFixture(fx);
                                        const tone = fixtureStatusTone(fx.status);
                                        const isComplete = fx.status === 'COMPLETED';
                                        const isScheduled = fx.status === 'SCHEDULED';
                                        return (
                                            <tr key={fx.id} className={isComplete ? 'opacity-80' : ''}>
                                                <td className="text-muted text-[10px] font-bold">
                                                    {fx.roundNumber != null ? `R${fx.roundNumber}` : '—'}
                                                </td>
                                                <td className="text-xs font-semibold text-primary">
                                                    {entryLabel(home)}
                                                    {fx.winnerEntryId != null && fx.winnerEntryId === fx.homeEntryId && (
                                                        <Trophy className="ml-1 inline-block h-3 w-3 text-amber-500" />
                                                    )}
                                                </td>
                                                <td className="text-center text-xs font-black tabular-nums text-primary">
                                                    {fx.homeScore != null && fx.awayScore != null
                                                        ? `${fx.homeScore} - ${fx.awayScore}`
                                                        : '—'}
                                                </td>
                                                <td className="text-xs font-semibold text-primary">
                                                    {entryLabel(away)}
                                                    {fx.winnerEntryId != null && fx.winnerEntryId === fx.awayEntryId && (
                                                        <Trophy className="ml-1 inline-block h-3 w-3 text-amber-500" />
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <span className={`tw-status-badge ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                                        {fx.status}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {(isScheduled || isComplete) && (
                                                            <button
                                                                onClick={() => openScoresModal(fx)}
                                                                className="tw-btn-default"
                                                                title="Edit scores"
                                                            >
                                                                <Edit3 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {isScheduled && fx.homeEntryId != null && fx.awayEntryId != null && (
                                                            <button
                                                                onClick={() => openCompleteModal(fx)}
                                                                className="tw-btn-destructive"
                                                                title="Force complete"
                                                            >
                                                                <Trophy className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {isComplete && (
                                                            <button
                                                                onClick={() => handleReopen(fx.id)}
                                                                disabled={saving}
                                                                className="tw-btn-default"
                                                                title="Reopen fixture"
                                                            >
                                                                <Undo2 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {!isComplete && fx.status !== 'CANCELLED' && (
                                                            <button
                                                                onClick={() => handleCancel(fx.id)}
                                                                disabled={saving}
                                                                className="tw-btn-destructive"
                                                                title="Cancel fixture"
                                                            >
                                                                <XCircle className="h-3 w-3" />
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
                    <div className="mt-0">
                        <div className="tw-section-header">Unassigned Fixtures</div>
                        <div className="overflow-x-auto">
                            <table className="tw-table w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left">#</th>
                                        <th className="text-left">Home</th>
                                        <th className="text-center" style={{ width: 60 }}>Score</th>
                                        <th className="text-left">Away</th>
                                        <th className="text-center">Status</th>
                                        <th className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orphanFixtures.map((fx) => {
                                        const { home, away } = getParticipantsForFixture(fx);
                                        const tone = fixtureStatusTone(fx.status);
                                        const isComplete = fx.status === 'COMPLETED';
                                        const isScheduled = fx.status === 'SCHEDULED';
                                        return (
                                            <tr key={fx.id}>
                                                <td className="text-muted text-[10px] font-bold">—</td>
                                                <td className="text-xs font-semibold text-primary">{entryLabel(home)}</td>
                                                <td className="text-center text-xs font-black tabular-nums text-primary">
                                                    {fx.homeScore != null && fx.awayScore != null
                                                        ? `${fx.homeScore} - ${fx.awayScore}`
                                                        : '—'}
                                                </td>
                                                <td className="text-xs font-semibold text-primary">{entryLabel(away)}</td>
                                                <td className="text-center">
                                                    <span className={`tw-status-badge ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                                        {fx.status}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {(isScheduled || isComplete) && (
                                                            <button onClick={() => openScoresModal(fx)} className="tw-btn-default" title="Edit scores">
                                                                <Edit3 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {isScheduled && fx.homeEntryId != null && fx.awayEntryId != null && (
                                                            <button onClick={() => openCompleteModal(fx)} className="tw-btn-destructive" title="Force complete">
                                                                <Trophy className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {isComplete && (
                                                            <button onClick={() => handleReopen(fx.id)} disabled={saving} className="tw-btn-default" title="Reopen fixture">
                                                                <Undo2 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {!isComplete && fx.status !== 'CANCELLED' && (
                                                            <button onClick={() => handleCancel(fx.id)} disabled={saving} className="tw-btn-destructive" title="Cancel fixture">
                                                                <XCircle className="h-3 w-3" />
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

            {/* Modal: Update Scores */}
            {modalMode === 'scores' && selectedFixture && (
                <div className="tw-modal-overlay" onClick={closeModal}>
                    <div className="tw-modal-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="tw-section-header">Update Scores</div>
                        <div className="space-y-4 p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                                        {entryLabel(entriesById.get(selectedFixture.homeEntryId!))}
                                    </span>
                                    <input
                                        type="number"
                                        value={homeScore}
                                        onChange={(e) => setHomeScore(e.target.value)}
                                        className="border border-subtle bg-base px-3 py-2 text-sm font-bold text-primary outline-none focus:border-accent-primary"
                                        placeholder="Home"
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-secondary">
                                        {entryLabel(entriesById.get(selectedFixture.awayEntryId!))}
                                    </span>
                                    <input
                                        type="number"
                                        value={awayScore}
                                        onChange={(e) => setAwayScore(e.target.value)}
                                        className="border border-subtle bg-base px-3 py-2 text-sm font-bold text-primary outline-none focus:border-accent-primary"
                                        placeholder="Away"
                                    />
                                </label>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={closeModal} className="tw-btn-default">Cancel</button>
                                <button onClick={handleUpdateScores} disabled={saving} className="tw-btn-default">
                                    {saving ? <Loader2 className="mr-1 inline-block h-3 w-3 animate-spin" /> : null}
                                    Save Scores
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Force Complete */}
            {modalMode === 'complete' && selectedFixture && (
                <div className="tw-modal-overlay" onClick={closeModal}>
                    <div className="tw-modal-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="tw-section-header" style={{ background: 'var(--accent-highlight-soft)', color: 'var(--accent-highlight)' }}>
                            Force Complete Fixture
                        </div>
                        <div className="space-y-4 p-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-secondary">Winner</span>
                                <select
                                    value={winnerEntryId}
                                    onChange={(e) => setWinnerEntryId(e.target.value)}
                                    className="border border-subtle bg-base px-3 py-2 text-sm font-bold text-primary outline-none focus:border-accent-primary"
                                >
                                    <option value="">Select winner...</option>
                                    {selectedFixture.homeEntryId != null && (
                                        <option value={selectedFixture.homeEntryId}>
                                            {entryLabel(entriesById.get(selectedFixture.homeEntryId))} (Home)
                                        </option>
                                    )}
                                    {selectedFixture.awayEntryId != null && (
                                        <option value={selectedFixture.awayEntryId}>
                                            {entryLabel(entriesById.get(selectedFixture.awayEntryId))} (Away)
                                        </option>
                                    )}
                                </select>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-secondary">Home Score</span>
                                    <input
                                        type="number"
                                        value={homeScore}
                                        onChange={(e) => setHomeScore(e.target.value)}
                                        className="border border-subtle bg-base px-3 py-2 text-sm font-bold text-primary outline-none focus:border-accent-primary"
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-secondary">Away Score</span>
                                    <input
                                        type="number"
                                        value={awayScore}
                                        onChange={(e) => setAwayScore(e.target.value)}
                                        className="border border-subtle bg-base px-3 py-2 text-sm font-bold text-primary outline-none focus:border-accent-primary"
                                    />
                                </label>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={closeModal} className="tw-btn-default">Cancel</button>
                                <button
                                    onClick={handleCompleteFixture}
                                    disabled={saving || !winnerEntryId}
                                    className="tw-btn-destructive"
                                >
                                    {saving ? <Loader2 className="mr-1 inline-block h-3 w-3 animate-spin" /> : <Trophy className="mr-1 inline-block h-3 w-3" />}
                                    Force Complete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
