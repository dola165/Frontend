import { Fragment, useMemo, useState } from 'react';
import { Loader2, Trophy, Undo2, XCircle, Edit3, Plus, Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../../../utils/apiError';
import {
    cancelFixture,
    completeFixture,
    createFixture,
    createStage,
    randomizeStageBracket,
    reopenFixture,
    updateFixtureScores,
} from '../api';
import type { TournamentDetail, TournamentEntryDto, TournamentFixtureDto, TournamentStageDto, TournamentStageType } from '../domain';
import { fixtureStatusTone, tournamentScopeLabel } from '../domain';
import { StandingsTable } from './StandingsTable';
import { BracketTree } from './BracketTree';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

interface Props {
    tournamentId: number;
    tournament: TournamentDetail;
    canManage: boolean;
    onRefresh: () => void;
}

const statusToneBorder: Record<string, string> = {
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    neutral: 'bg-[#16181d] text-[#a1a1aa] border-[#ffffff0d]',
};

const entryChipStatuses = new Set(['ELIMINATED', 'WAITLISTED', 'COMPLETED']);

const entryChipTones: Record<string, string> = {
    ELIMINATED: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    WAITLISTED: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    COMPLETED: 'border-[#ffffff0d] bg-[#16181d] text-[#a1a1aa]',
};

type ModalMode = 'scores' | 'complete' | null;

const stageTypeOptions: TournamentStageType[] = ['GROUP', 'KNOCKOUT', 'ROUND_ROBIN', 'LEAGUE'];

const entryLabel = (entry: TournamentEntryDto | undefined): string => {
    if (!entry) return '—';
    return entry.displayName ?? entry.clubName ?? entry.squadName ?? `Entry #${entry.id}`;
};

const inputClass = 'w-full rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-2.5 text-sm font-semibold text-[#f4f4f5] outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a]';
const selectClass = inputClass;
const btnDefault = 'inline-flex items-center gap-1.5 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] disabled:opacity-40';
const btnDestructive = 'inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-[#16181d] px-3 py-1.5 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#22c55e] disabled:opacity-50';

export const BracketEditor = ({ tournamentId, tournament, canManage, onRefresh }: Props) => {
    const { t } = useTranslation();
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [selectedFixture, setSelectedFixture] = useState<TournamentFixtureDto | null>(null);
    const [homeScore, setHomeScore] = useState('');
    const [awayScore, setAwayScore] = useState('');
    const [winnerEntryId, setWinnerEntryId] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [refreshKey, setRefreshKey] = useState(0);
    const [actingStageId, setActingStageId] = useState<number | null>(null);
    const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
    const [stageFormOpen, setStageFormOpen] = useState(false);
    const [stageName, setStageName] = useState('');
    const [stageType, setStageType] = useState<TournamentStageType>('GROUP');
    const [stageOrder, setStageOrder] = useState('');
    const [advanceCount, setAdvanceCount] = useState('');
    const [bracketSize, setBracketSize] = useState('8');
    const [fixtureFormStageId, setFixtureFormStageId] = useState<number | null>(null);
    const [fxHomeEntryId, setFxHomeEntryId] = useState('');
    const [fxAwayEntryId, setFxAwayEntryId] = useState('');
    const [fxRoundNumber, setFxRoundNumber] = useState('1');
    const [fxOrder, setFxOrder] = useState('1');
    const [fxScheduledAt, setFxScheduledAt] = useState('');
    const [fxLocationId, setFxLocationId] = useState('');

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const bumpRefresh = () => setRefreshKey((k) => k + 1);

    const entriesById = useMemo(() => {
        const map = new Map<number, TournamentEntryDto>();
        (tournament.entries ?? []).forEach((e) => map.set(e.id, e));
        return map;
    }, [tournament.entries]);

    const entryStatuses = useMemo(() => {
        const map = new Map<number, string>();
        (tournament.entries ?? []).forEach((e) => map.set(e.id, e.status));
        return map;
    }, [tournament.entries]);

    const stages = tournament.stages ?? [];
    const fixtures = tournament.fixtures ?? [];

    const stageById = useMemo(() => {
        const map = new Map<number, TournamentStageDto>();
        stages.forEach((s) => map.set(s.id, s));
        return map;
    }, [stages]);

    const fixturesByStage = useMemo(() => {
        const grouped = new Map<number | null, TournamentFixtureDto[]>();
        fixtures.forEach((f) => {
            const key = f.stageId;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(f);
        });
        return grouped;
    }, [fixtures]);

    const nextStageOrder = stages.length + 1;

    const getParticipantsForFixture = (fixture: TournamentFixtureDto) => {
        const home = fixture.homeEntryId != null ? entriesById.get(fixture.homeEntryId) : undefined;
        const away = fixture.awayEntryId != null ? entriesById.get(fixture.awayEntryId) : undefined;
        return { home, away };
    };

    /**
     * Knockout bracket slot placeholder. Round-1 empty slots are byes; later
     * rounds pair the winners of the two previous-round fixtures in order
     * (2n-1, 2n) — the same pairing the backend's seeded generator uses.
     */
    const knockoutSlotLabel = (fixture: TournamentFixtureDto, side: 'home' | 'away'): string | null => {
        if (fixture.roundNumber == null || fixture.fixtureOrder == null) return null;
        if (fixture.roundNumber <= 1) return t('tournaments.bracket.bye');
        const sourceOrder = side === 'home' ? fixture.fixtureOrder * 2 - 1 : fixture.fixtureOrder * 2;
        return t('tournaments.bracket.winnerOf', { round: fixture.roundNumber - 1, order: sourceOrder });
    };

    const openScoresModal = (fixture: TournamentFixtureDto) => {
        setSelectedFixture(fixture);
        setHomeScore(fixture.homeScore != null ? String(fixture.homeScore) : '');
        setAwayScore(fixture.awayScore != null ? String(fixture.awayScore) : '');
        setModalMode('scores');
    };

    const openCompleteModal = (fixture: TournamentFixtureDto) => {
        const stage = stageById.get(fixture.stageId ?? -1);
        setSelectedFixture(fixture);
        setHomeScore(fixture.homeScore != null ? String(fixture.homeScore) : '');
        setAwayScore(fixture.awayScore != null ? String(fixture.awayScore) : '');
        // Knockout defaults to home as winner; group/league stages default to a draw.
        setWinnerEntryId(
            stage?.stageType === 'KNOCKOUT' && fixture.homeEntryId != null ? String(fixture.homeEntryId) : '',
        );
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
            bumpRefresh();
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to update scores'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCompleteFixture = async () => {
        if (!selectedFixture) return;
        const isKnockout = stageById.get(selectedFixture.stageId ?? -1)?.stageType === 'KNOCKOUT';
        if (isKnockout && !winnerEntryId) return;
        setSaving(true);
        try {
            await completeFixture(tournamentId, selectedFixture.id, {
                winnerEntryId: winnerEntryId ? Number(winnerEntryId) : null,
                homeScore: homeScore ? Number(homeScore) : null,
                awayScore: awayScore ? Number(awayScore) : null,
            });
            showMessage('Fixture completed', 'success');
            closeModal();
            bumpRefresh();
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
            bumpRefresh();
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
            bumpRefresh();
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, 'Failed to cancel fixture'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleRandomize = async (stageId: number) => {
        setActingStageId(stageId);
        try {
            await randomizeStageBracket(tournamentId, stageId);
            showMessage(t('tournaments.bracket.randomized'), 'success');
            bumpRefresh();
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, t('tournaments.bracket.randomizeFailed')), 'error');
        } finally {
            setActingStageId(null);
        }
    };

    const openStageForm = () => {
        setStageOrder(String(nextStageOrder));
        setStageFormOpen(true);
    };

    const handleCreateStage = async () => {
        if (!stageName.trim()) {
            showMessage(t('tournaments.stages.nameRequired'), 'error');
            return;
        }
        setSaving(true);
        try {
            await createStage(tournamentId, {
                name: stageName.trim(),
                stageType,
                stageOrder: Number(stageOrder) || nextStageOrder,
                advanceCount: advanceCount.trim() === '' ? null : Number(advanceCount),
                bracketSize: stageType === 'KNOCKOUT' ? Number(bracketSize) : null,
            });
            showMessage(t('tournaments.stages.created'), 'success');
            setStageFormOpen(false);
            setStageName('');
            setAdvanceCount('');
            bumpRefresh();
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, t('tournaments.stages.createFailed')), 'error');
        } finally {
            setSaving(false);
        }
    };

    const openFixtureForm = (stageId: number) => {
        const stageFixtures = fixturesByStage.get(stageId) ?? [];
        const maxRound = stageFixtures.reduce((max, f) => Math.max(max, f.roundNumber ?? 0), 0);
        const round = maxRound + 1;
        const order = stageFixtures.filter((f) => f.roundNumber === round).length + 1;
        setFxHomeEntryId('');
        setFxAwayEntryId('');
        setFxRoundNumber(String(round));
        setFxOrder(String(order));
        setFxScheduledAt('');
        setFxLocationId('');
        setFixtureFormStageId(stageId);
    };

    const handleCreateFixture = async (stageId: number) => {
        setSaving(true);
        try {
            await createFixture(tournamentId, stageId, {
                homeEntryId: fxHomeEntryId ? Number(fxHomeEntryId) : null,
                awayEntryId: fxAwayEntryId ? Number(fxAwayEntryId) : null,
                roundNumber: Number(fxRoundNumber),
                fixtureOrder: Number(fxOrder),
                scheduledAt: fxScheduledAt ? `${fxScheduledAt}:00` : null,
                locationId: fxLocationId ? Number(fxLocationId) : null,
            });
            showMessage(t('tournaments.bracket.fixtureCreated'), 'success');
            setFixtureFormStageId(null);
            bumpRefresh();
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, t('tournaments.bracket.fixtureCreateFailed')), 'error');
        } finally {
            setSaving(false);
        }
    };

    const renderFixtureRow = (fx: TournamentFixtureDto, stage: TournamentStageDto | undefined, showRound: boolean) => {
        const { home, away } = getParticipantsForFixture(fx);
        const tone = fixtureStatusTone(fx.status);
        const isComplete = fx.status === 'COMPLETED';
        const isScheduled = fx.status === 'SCHEDULED';
        const isKnockout = stage?.stageType === 'KNOCKOUT';
        const entryChip = (entryId: number | null) => {
            if (entryId == null) return null;
            const status = entryStatuses.get(entryId);
            if (!status || !entryChipStatuses.has(status)) return null;
            return (
                <span className={`ml-1.5 inline-block rounded-xl border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${entryChipTones[status]}`}>
                    {status}
                </span>
            );
        };
        const homeCell = fx.homeEntryId != null ? (
            <>
                {entryLabel(home)}
                {entryChip(fx.homeEntryId)}
                {fx.winnerEntryId != null && fx.winnerEntryId === fx.homeEntryId && (
                    <Trophy className="ml-1.5 inline-block h-3.5 w-3.5 text-amber-500" />
                )}
            </>
        ) : (
            <span className="italic text-[#71717a]">{isKnockout ? (knockoutSlotLabel(fx, 'home') ?? '—') : '—'}</span>
        );
        const awayCell = fx.awayEntryId != null ? (
            <>
                {entryLabel(away)}
                {entryChip(fx.awayEntryId)}
                {fx.winnerEntryId != null && fx.winnerEntryId === fx.awayEntryId && (
                    <Trophy className="ml-1.5 inline-block h-3.5 w-3.5 text-amber-500" />
                )}
            </>
        ) : (
            <span className="italic text-[#71717a]">{isKnockout ? (knockoutSlotLabel(fx, 'away') ?? '—') : '—'}</span>
        );
        return (
            <tr key={fx.id} className={`border-b border-[#ffffff0d] transition-colors hover:bg-[#1a1c22] ${isComplete ? 'opacity-70' : ''}`}>
                {showRound && (
                    <td className="px-5 py-3 text-xs font-medium text-[#a1a1aa]">
                        {fx.roundNumber != null ? `R${fx.roundNumber}` : '—'}
                    </td>
                )}
                <td className="px-5 py-3 text-sm font-semibold text-[#f4f4f5]">{homeCell}</td>
                <td className="px-2 py-3 text-center text-sm font-bold tabular-nums text-[#f4f4f5]">
                    {fx.homeScore != null && fx.awayScore != null ? `${fx.homeScore} - ${fx.awayScore}` : '—'}
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-[#f4f4f5]">{awayCell}</td>
                <td className="px-2 py-3 text-center">
                    <span className={`inline-block rounded-xl border px-2.5 py-0.5 text-xs font-semibold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
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
    };

    const renderFixtureTable = (stageFixtures: TournamentFixtureDto[], stage: TournamentStageDto) => {
        if (stage.stageType !== 'KNOCKOUT') {
            return (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#ffffff0d]">
                                <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#a1a1aa]">#</th>
                                <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#a1a1aa]">Home</th>
                                <th className="px-2 py-2.5 text-center text-xs font-semibold text-[#a1a1aa]" style={{ width: 60 }}>Score</th>
                                <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#a1a1aa]">Away</th>
                                <th className="px-2 py-2.5 text-center text-xs font-semibold text-[#a1a1aa]">Status</th>
                                <th className="px-5 py-2.5 text-right text-xs font-semibold text-[#a1a1aa]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>{stageFixtures.map((fx) => renderFixtureRow(fx, stage, true))}</tbody>
                    </table>
                </div>
            );
        }
        const rounds = [...new Set(stageFixtures.map((f) => f.roundNumber ?? 0))].sort((a, b) => a - b);
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[#ffffff0d]">
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#a1a1aa]">Home</th>
                            <th className="px-2 py-2.5 text-center text-xs font-semibold text-[#a1a1aa]" style={{ width: 60 }}>Score</th>
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#a1a1aa]">Away</th>
                            <th className="px-2 py-2.5 text-center text-xs font-semibold text-[#a1a1aa]">Status</th>
                            <th className="px-5 py-2.5 text-right text-xs font-semibold text-[#a1a1aa]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rounds.map((round) => (
                            <Fragment key={round}>
                                <tr className="border-b border-[#ffffff0d] bg-[#101318]">
                                    <td colSpan={5} className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a1a1aa]">
                                        {t('tournaments.bracket.round', { number: round })}
                                    </td>
                                </tr>
                                {stageFixtures
                                    .filter((f) => (f.roundNumber ?? 0) === round)
                                    .sort((a, b) => (a.fixtureOrder ?? 0) - (b.fixtureOrder ?? 0))
                                    .map((fx) => renderFixtureRow(fx, stage, false))}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const entryOptions = (tournament.entries ?? []).map((e) => (
        <option key={e.id} value={e.id}>
            {entryLabel(e)} ({e.status})
        </option>
    ));

    return (
        <div>
            {/* Stats bar */}
            <div className="grid grid-cols-4 divide-x divide-[#ffffff0d] border-b border-[#ffffff0d]">
                <div className="px-4 py-3 text-center">
                    <p className="text-xl font-bold text-[#f4f4f5]">{fixtures.length}</p>
                    <p className="text-xs font-medium text-[#a1a1aa]">Fixtures</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className="text-xl font-bold text-[#f4f4f5]">{stages.length}</p>
                    <p className="text-xs font-medium text-[#a1a1aa]">Stages</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className="text-xl font-bold text-[#f4f4f5]">{tournament.entries?.length ?? 0}</p>
                    <p className="text-xs font-medium text-[#a1a1aa]">Entries</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className="text-xl font-bold text-[#f4f4f5]">{tournamentScopeLabel(tournament.participantScope)}</p>
                    <p className="text-xs font-medium text-[#a1a1aa]">Scope</p>
                </div>
            </div>

            {/* Champion banner */}
            {(tournament.championEntryId != null || tournament.championName) && (
                <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-5 py-3">
                    <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                    <p className="text-sm font-bold text-amber-400">
                        {t('tournaments.bracket.champion')}
                        <span className="mx-1.5 text-amber-500/50">&middot;</span>
                        {tournament.championName ?? `Entry #${tournament.championEntryId}`}
                    </p>
                </div>
            )}

            {/* Message toast */}
            {message && (
                <div className={`border-b border-[#ffffff0d] px-4 py-3 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'bg-[#16a34a]/10 text-[#16a34a]'
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                }`}>
                    {message}
                </div>
            )}

            {/* Fixtures by stage */}
            {stages.map((stage) => {
                const stageFixtures = fixturesByStage.get(stage.id) ?? [];
                return (
                    <div key={stage.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                            <p className="text-sm font-semibold text-[#f4f4f5]">
                                {stage.name}
                                <span className="ml-2 font-normal text-[#a1a1aa]">
                                    {stage.stageType} &middot; {stage.status}
                                </span>
                            </p>
                            <div className="flex items-center gap-1.5">
                                {stage.stageType !== 'KNOCKOUT' && stageFixtures.length === 0 && (
                                    <button
                                        onClick={() => handleRandomize(stage.id)}
                                        disabled={actingStageId === stage.id}
                                        className={btnDefault}
                                    >
                                        <Shuffle className="h-3.5 w-3.5" />
                                        {t('tournaments.bracket.randomize')}
                                    </button>
                                )}
                                {!(stage.stageType === 'KNOCKOUT' && stageFixtures.length > 0) && (
                                    <button
                                        onClick={() =>
                                            fixtureFormStageId === stage.id ? setFixtureFormStageId(null) : openFixtureForm(stage.id)
                                        }
                                        className={btnDefault}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        {t('tournaments.bracket.addFixture')}
                                    </button>
                                )}
                            </div>
                        </div>

                        {stage.stageType !== 'KNOCKOUT' && stageFixtures.length > 0 && (
                            <p className="border-b border-[#ffffff0d] px-5 py-1.5 text-[11px] text-[#71717a]">
                                {t('tournaments.stages.addFixtureHint')}
                            </p>
                        )}

                        {stageFixtures.length === 0 && (
                            <p className="border-b border-[#ffffff0d] px-5 py-8 text-center text-sm text-[#a1a1aa]">
                                {t('tournaments.bracket.noFixtures')}
                            </p>
                        )}
                        {stageFixtures.length > 0 &&
                            (stage.stageType === 'KNOCKOUT' ? (
                                <BracketTree
                                    tournamentId={tournamentId}
                                    tournament={tournament}
                                    fixtures={stageFixtures}
                                    saving={saving}
                                    canManage={canManage}
                                    onRefresh={onRefresh}
                                    onEditScores={openScoresModal}
                                    onComplete={openCompleteModal}
                                    onReopen={handleReopen}
                                    onCancelFixture={(fixtureId) => setConfirmCancelId(fixtureId)}
                                />
                            ) : (
                                renderFixtureTable(stageFixtures, stage)
                            ))}

                        {/* Inline fixture creation form */}
                        {fixtureFormStageId === stage.id && (
                            <div className="border-b border-[#ffffff0d] bg-[#101318] px-5 py-4">
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.bracket.homeEntry')}</span>
                                        <select value={fxHomeEntryId} onChange={(e) => setFxHomeEntryId(e.target.value)} className={selectClass}>
                                            <option value="">—</option>
                                            {entryOptions}
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.bracket.awayEntry')}</span>
                                        <select value={fxAwayEntryId} onChange={(e) => setFxAwayEntryId(e.target.value)} className={selectClass}>
                                            <option value="">—</option>
                                            {entryOptions}
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.stages.order')}</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="number" min={1} value={fxRoundNumber} onChange={(e) => setFxRoundNumber(e.target.value)} className={inputClass} />
                                            <input type="number" min={1} value={fxOrder} onChange={(e) => setFxOrder(e.target.value)} className={inputClass} />
                                        </div>
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.bracket.scheduledAt')}</span>
                                        <input type="datetime-local" value={fxScheduledAt} onChange={(e) => setFxScheduledAt(e.target.value)} className={inputClass} />
                                    </label>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.bracket.locationId')}</span>
                                        <input type="number" min={1} value={fxLocationId} onChange={(e) => setFxLocationId(e.target.value)} className={inputClass} />
                                    </label>
                                </div>
                                <div className="mt-3 flex justify-end gap-3">
                                    <button onClick={() => setFixtureFormStageId(null)} className={btnDefault}>Cancel</button>
                                    <button onClick={() => handleCreateFixture(stage.id)} disabled={saving} className={btnPrimary}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                        {t('tournaments.bracket.create')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Standings for round-robin style stages */}
                        {(stage.stageType === 'GROUP' || stage.stageType === 'ROUND_ROBIN' || stage.stageType === 'LEAGUE') && (
                            <StandingsTable
                                tournamentId={tournamentId}
                                stageId={stage.id}
                                refreshKey={refreshKey}
                                entryStatuses={entryStatuses}
                            />
                        )}
                    </div>
                );
            })}

            {stages.length === 0 && (
                <div className="flex flex-col items-center justify-center border-b border-[#ffffff0d] py-14 text-center">
                    <Trophy className="mb-3 h-10 w-10 text-[#a1a1aa]" />
                    <p className="text-sm font-semibold text-[#a1a1aa]">{t('tournaments.stages.empty')}</p>
                </div>
            )}

            {/* Un-staged fixtures */}
            {(() => {
                const orphanFixtures = fixturesByStage.get(null) ?? [];
                if (orphanFixtures.length === 0) return null;
                return (
                    <div>
                        <div className="border-b border-[#ffffff0d] bg-[#16181d] px-5 py-3">
                            <p className="text-sm font-semibold text-[#f4f4f5]">Unassigned Fixtures</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[#ffffff0d]">
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#a1a1aa]">#</th>
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#a1a1aa]">Home</th>
                                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-[#a1a1aa]" style={{ width: 60 }}>Score</th>
                                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-[#a1a1aa]">Away</th>
                                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-[#a1a1aa]">Status</th>
                                        <th className="px-5 py-2.5 text-right text-xs font-semibold text-[#a1a1aa]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>{orphanFixtures.map((fx) => renderFixtureRow(fx, undefined, true))}</tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}

            {/* New stage form */}
            <div className="border-b border-[#ffffff0d]">
                {!stageFormOpen ? (
                    <button
                        onClick={openStageForm}
                        className="flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] hover:text-[#f4f4f5]"
                    >
                        <Plus className="h-4 w-4" />
                        {t('tournaments.stages.newStage')}
                    </button>
                ) : (
                    <div className="px-5 py-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.stages.name')}</span>
                                <input value={stageName} onChange={(e) => setStageName(e.target.value)} className={inputClass} placeholder="Group A" />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.stages.type')}</span>
                                <select value={stageType} onChange={(e) => setStageType(e.target.value as TournamentStageType)} className={selectClass}>
                                    {stageTypeOptions.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.stages.order')}</span>
                                <input type="number" min={1} value={stageOrder} onChange={(e) => setStageOrder(e.target.value)} className={inputClass} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.stages.advanceCount')}</span>
                                <input type="number" min={0} value={advanceCount} onChange={(e) => setAdvanceCount(e.target.value)} className={inputClass} />
                            </label>
                            {stageType === 'KNOCKOUT' && (
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-[#a1a1aa]">{t('tournaments.stages.spots')}</span>
                                    <select value={bracketSize} onChange={(e) => setBracketSize(e.target.value)} className={selectClass}>
                                        {[4, 8, 16, 32, 64].map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </label>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-[#71717a]">{t('tournaments.stages.advanceCountHint')}</p>
                        <div className="mt-3 flex justify-end gap-3">
                            <button onClick={() => setStageFormOpen(false)} className={btnDefault}>Cancel</button>
                            <button onClick={handleCreateStage} disabled={saving} className={btnPrimary}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {t('tournaments.stages.create')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Overlay */}
            {modalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
                    <div className="w-full max-w-md rounded-xl border border-[#ffffff0d] bg-[#16181d] " onClick={(e) => e.stopPropagation()}>
                        {modalMode === 'scores' && selectedFixture && (
                            <>
                                <div className="border-b border-[#ffffff0d] bg-[#16181d] px-6 py-4">
                                    <p className="text-base font-semibold text-[#f4f4f5]">Update Scores</p>
                                </div>
                                <div className="space-y-5 p-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-semibold text-[#f4f4f5]">
                                                {selectedFixture.homeEntryId != null
                                                    ? entryLabel(entriesById.get(selectedFixture.homeEntryId))
                                                    : knockoutSlotLabel(selectedFixture, 'home') ?? '—'}
                                            </span>
                                            <input type="number" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className={inputClass} placeholder="Home" />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-semibold text-[#f4f4f5]">
                                                {selectedFixture.awayEntryId != null
                                                    ? entryLabel(entriesById.get(selectedFixture.awayEntryId))
                                                    : knockoutSlotLabel(selectedFixture, 'away') ?? '—'}
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
                                <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-4">
                                    <p className="text-base font-semibold text-amber-400">Force Complete Fixture</p>
                                </div>
                                <div className="space-y-5 p-6">
                                    <label className="flex flex-col gap-2">
                                        <span className="text-sm font-semibold text-[#f4f4f5]">Winner</span>
                                        <select value={winnerEntryId} onChange={(e) => setWinnerEntryId(e.target.value)} className={selectClass}>
                                            {stageById.get(selectedFixture.stageId ?? -1)?.stageType === 'KNOCKOUT' ? (
                                                <option value="">Select winner...</option>
                                            ) : (
                                                <option value="">{t('tournaments.bracket.draw')}</option>
                                            )}
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
                                            <span className="text-sm font-semibold text-[#f4f4f5]">Home Score</span>
                                            <input type="number" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className={inputClass} />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-sm font-semibold text-[#f4f4f5]">Away Score</span>
                                            <input type="number" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className={inputClass} />
                                        </label>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <button onClick={closeModal} className={btnDefault}>Cancel</button>
                                        <button
                                            onClick={handleCompleteFixture}
                                            disabled={saving || (stageById.get(selectedFixture.stageId ?? -1)?.stageType === 'KNOCKOUT' && !winnerEntryId)}
                                            className={btnDestructive}
                                        >
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

            {/* Cancel fixture confirmation */}
            <ConfirmDialog
                open={confirmCancelId != null}
                title="Cancel fixture"
                message={t('tournaments.diagram.confirmUndone')}
                variant="danger"
                confirmLabel="Cancel fixture"
                onCancel={() => setConfirmCancelId(null)}
                onConfirm={() => {
                    const fixtureId = confirmCancelId;
                    setConfirmCancelId(null);
                    if (fixtureId != null) void handleCancel(fixtureId);
                }}
            />
        </div>
    );
};
