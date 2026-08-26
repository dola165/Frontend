import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Edit3, Pencil, Plus, Trophy, Undo2, X, XCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { fetchDraftTeams, moveEntry, replaceEntry, updateFixtureParticipants } from '../api';
import type { DraftTeamDto, TournamentDetail, TournamentEntryDto, TournamentFixtureDto } from '../domain';
import { entryTypeLabel, fixtureStatusTone } from '../domain';
import { ParticipantProfileModal } from './ParticipantProfileModal';
import { CreateTeamModal } from './CreateTeamModal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

type Slot = 'HOME' | 'AWAY';

type DragPayload = { kind: 'entry'; entryId: number } | { kind: 'move'; fixtureId: number; slot: Slot };

interface Props {
    tournamentId: number;
    tournament: TournamentDetail;
    fixtures: TournamentFixtureDto[];
    saving: boolean;
    canManage: boolean;
    onRefresh: () => void;
    onEditScores: (fixture: TournamentFixtureDto) => void;
    onComplete: (fixture: TournamentFixtureDto) => void;
    onReopen: (fixtureId: number) => void;
    onCancelFixture: (fixtureId: number) => void;
}

interface CardCenter {
    left: number;
    right: number;
    y: number;
}

interface Geometry {
    offsets: Map<number, number>;
    paths: string[];
    padTop: number;
    height: number;
    width: number;
}

const entryPrimary = (entry: TournamentEntryDto | undefined): string => {
    if (!entry) return '—';
    return entry.clubName ?? entry.displayName ?? entry.squadName ?? `Entry #${entry.id}`;
};

const entrySecondary = (entry: TournamentEntryDto | undefined): string | null => {
    if (!entry) return null;
    // P6: the club's pre-selected squad shows in small text beneath the club name.
    if (entry.squadName && entry.clubId != null && entry.squadName !== entry.clubName) return entry.squadName;
    return null;
};

const entryTypeTone = (entry: TournamentEntryDto): string => {
    const type = entryTypeLabel(entry);
    if (type === 'Squad') return 'border-violet-500/30 bg-violet-500/10 text-violet-400';
    if (type === 'Club') return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
    return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
};

const statusToneBorder: Record<string, string> = {
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/40',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/40',
    neutral: 'bg-black text-[#a1a1aa] border-white/10',
};

const iconBtn = 'inline-flex items-center justify-center rounded-lg border border-white/10 bg-black p-1.5 text-[#a1a1aa] transition-colors hover:bg-white/5 disabled:opacity-40';
const iconBtnDestructive = 'inline-flex items-center justify-center rounded-lg border border-rose-500/40 bg-black p-1.5 text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50';

export const BracketTree = ({
    tournamentId,
    tournament,
    fixtures,
    saving,
    canManage,
    onRefresh,
    onEditScores,
    onComplete,
    onReopen,
    onCancelFixture,
}: Props) => {
    const { t } = useTranslation();
    const [drag, setDrag] = useState<DragPayload | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<TournamentEntryDto | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'success' | 'error'>('success');
    const [geometry, setGeometry] = useState<Geometry>({ offsets: new Map(), paths: [], padTop: 0, height: 0, width: 0 });
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [createTeamOpen, setCreateTeamOpen] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
    const [draftTeams, setDraftTeams] = useState<DraftTeamDto[]>([]);
    const [confirmRemove, setConfirmRemove] = useState<{ fixture: TournamentFixtureDto; slot: Slot } | null>(null);

    const contentRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef(new Map<number, HTMLDivElement>());
    const appliedOffsets = useRef(new Map<number, number>());
    const panning = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

    const isBusy = saving || busy;

    // Forming/locked teams the admin can keep working on (edit mode reopens them).
    useEffect(() => {
        let cancelled = false;
        fetchDraftTeams(tournamentId)
            .then((data) => {
                if (!cancelled) setDraftTeams(data ?? []);
            })
            .catch(() => {
                if (!cancelled) setDraftTeams([]);
            });
        return () => {
            cancelled = true;
        };
    }, [tournamentId, tournament.entries]);

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => setMessage(null), 4000);
    };

    const clampZoom = (value: number) => Math.min(1.75, Math.max(0.5, Math.round(value * 4) / 4));

    // Ctrl/Cmd + wheel zooms the bracket (non-passive so preventDefault works).
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.25 : -0.25)));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const entriesById = useMemo(() => {
        const map = new Map<number, TournamentEntryDto>();
        (tournament.entries ?? []).forEach((e) => map.set(e.id, e));
        return map;
    }, [tournament.entries]);

    const fixturesByRound = useMemo(() => {
        const grouped = new Map<number, TournamentFixtureDto[]>();
        fixtures.forEach((f) => {
            const round = f.roundNumber ?? 0;
            if (!grouped.has(round)) grouped.set(round, []);
            grouped.get(round)!.push(f);
        });
        grouped.forEach((list) => list.sort((a, b) => (a.fixtureOrder ?? 0) - (b.fixtureOrder ?? 0)));
        return grouped;
    }, [fixtures]);

    const rounds = useMemo(() => [...fixturesByRound.keys()].sort((a, b) => a - b), [fixturesByRound]);

    const assignedIds = useMemo(() => {
        const ids = new Set<number>();
        fixtures.forEach((f) => {
            if (f.homeEntryId != null) ids.add(f.homeEntryId);
            if (f.awayEntryId != null) ids.add(f.awayEntryId);
        });
        return ids;
    }, [fixtures]);

    /**
     * P7 teams-only pool: club teams (club or its selected squad) and promoted
     * hand-created teams. Individual players never appear here — they are
     * roster material for the Create-team popup.
     */
    const poolEntries = useMemo(
        () =>
            (tournament.entries ?? [])
                .filter(
                    (e) =>
                        (e.clubId != null || e.draftTeamId != null) &&
                        (e.status === 'ACTIVE' || e.status === 'APPROVED') &&
                        !assignedIds.has(e.id),
                )
                .slice()
                .sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER) || a.id - b.id),
        [tournament.entries, assignedIds],
    );

    const slotEntryId = (fixture: TournamentFixtureDto, slot: Slot): number | null =>
        slot === 'HOME' ? fixture.homeEntryId : fixture.awayEntryId;

    const advanceTarget = (fx: TournamentFixtureDto): { targetFixtureId: number; targetSlot: Slot } | null => {
        if (fx.roundNumber == null || fx.fixtureOrder == null) return null;
        const targetOrder = Math.ceil(fx.fixtureOrder / 2);
        const targetFixture = (fixturesByRound.get(fx.roundNumber + 1) ?? []).find((f) => f.fixtureOrder === targetOrder);
        if (!targetFixture) return null;
        return {
            targetFixtureId: targetFixture.id,
            targetSlot: fx.fixtureOrder % 2 === 1 ? 'HOME' : 'AWAY',
        };
    };

    const slotPlaceholder = (fx: TournamentFixtureDto, slot: Slot): string => {
        if (fx.roundNumber == null || fx.fixtureOrder == null) return '—';
        if (fx.roundNumber <= 1) return t('tournaments.diagram.dropHere');
        const sourceOrder = slot === 'HOME' ? fx.fixtureOrder * 2 - 1 : fx.fixtureOrder * 2;
        return t('tournaments.bracket.winnerOf', { round: fx.roundNumber - 1, order: sourceOrder });
    };

    const setTransfer = (e: React.DragEvent, text: string) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.effectAllowed = 'move';
        try {
            e.dataTransfer.setData('text/plain', text);
        } catch {
            // jsdom without a dataTransfer implementation
        }
    };

    const onDragEnd = () => {
        setDrag(null);
        setDragOver(null);
    };

    const handleDrop = async (fixture: TournamentFixtureDto, slot: Slot) => {
        setDragOver(null);
        if (!drag || isBusy || !canManage) return;
        const current = slotEntryId(fixture, slot);
        if (drag.kind === 'move' && drag.fixtureId === fixture.id && drag.slot === slot) {
            setDrag(null);
            return;
        }
        setBusy(true);
        try {
            if (drag.kind === 'entry') {
                if (current == null) {
                    await updateFixtureParticipants(tournamentId, fixture.id, {
                        homeEntryId: slot === 'HOME' ? drag.entryId : fixture.homeEntryId,
                        awayEntryId: slot === 'AWAY' ? drag.entryId : fixture.awayEntryId,
                    });
                } else if (current !== drag.entryId) {
                    await replaceEntry(tournamentId, fixture.id, { slot, replacementEntryId: drag.entryId });
                }
                showMessage(t('tournaments.diagram.entryPlaced'), 'success');
                onRefresh();
            } else {
                const source = fixtures.find((f) => f.id === drag.fixtureId);
                const movingId = source ? slotEntryId(source, drag.slot) : null;
                if (movingId == null) return;
                if (drag.fixtureId === fixture.id) {
                    // P6 (#4): same-fixture move = swap the two slots in one PATCH.
                    await updateFixtureParticipants(tournamentId, fixture.id, {
                        homeEntryId: slot === 'HOME' ? movingId : (drag.slot === 'HOME' ? fixture.awayEntryId : fixture.homeEntryId),
                        awayEntryId: slot === 'AWAY' ? movingId : (drag.slot === 'AWAY' ? fixture.homeEntryId : fixture.awayEntryId),
                    });
                } else if (current == null) {
                    await moveEntry(tournamentId, drag.fixtureId, {
                        entryId: movingId,
                        targetFixtureId: fixture.id,
                        targetSlot: slot,
                    });
                } else if (current !== movingId) {
                    await moveEntry(tournamentId, drag.fixtureId, {
                        entryId: movingId,
                        targetFixtureId: fixture.id,
                        targetSlot: slot,
                    });
                    await replaceEntry(tournamentId, fixture.id, { slot, replacementEntryId: movingId });
                }
                showMessage(t('tournaments.diagram.entryMoved'), 'success');
                onRefresh();
            }
        } catch (err) {
            showMessage(extractApiErrorMessage(err, t('tournaments.diagram.placeFailed')), 'error');
            onRefresh();
        } finally {
            setBusy(false);
            setDrag(null);
        }
    };

    const handleAdvance = async (fx: TournamentFixtureDto, slot: Slot) => {
        const entryId = slotEntryId(fx, slot);
        const target = advanceTarget(fx);
        if (entryId == null || !target || isBusy || !canManage) return;
        setBusy(true);
        try {
            await moveEntry(tournamentId, fx.id, {
                entryId,
                targetFixtureId: target.targetFixtureId,
                targetSlot: target.targetSlot,
            });
            showMessage(t('tournaments.diagram.entryMoved'), 'success');
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, t('tournaments.diagram.placeFailed')), 'error');
            onRefresh();
        } finally {
            setBusy(false);
        }
    };

    const handleRemoveConfirmed = async () => {
        if (!confirmRemove) return;
        const { fixture, slot } = confirmRemove;
        setConfirmRemove(null);
        setBusy(true);
        try {
            await updateFixtureParticipants(tournamentId, fixture.id, {
                homeEntryId: slot === 'HOME' ? null : fixture.homeEntryId,
                awayEntryId: slot === 'AWAY' ? null : fixture.awayEntryId,
            });
            showMessage(t('tournaments.diagram.entryRemoved'), 'success');
            onRefresh();
        } catch (err) {
            showMessage(extractApiErrorMessage(err, t('tournaments.diagram.placeFailed')), 'error');
            onRefresh();
        } finally {
            setBusy(false);
        }
    };

    // ---- Pan: drag on empty canvas moves the view (no scrollbars). ----
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!canManage || e.button !== 0) return;
        panning.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!panning.current) return;
        setPan({
            x: panning.current.panX + (e.clientX - panning.current.startX),
            y: panning.current.panY + (e.clientY - panning.current.startY),
        });
    };

    const onPointerUp = () => {
        panning.current = null;
    };

    // ---- Connected-tree geometry: measured natural centers, later rounds
    // translated between their sources, elbow connectors drawn in natural
    // coordinates (pan is subtracted, zoom divided out). ----
    useLayoutEffect(() => {
        const measure = () => {
            const content = contentRef.current;
            if (!content) return;
            const contentRect = content.getBoundingClientRect();
            const z = zoom;
            const centers = new Map<number, CardCenter>();

            cardRefs.current.forEach((el, fxId) => {
                const rect = el.getBoundingClientRect();
                const applied = appliedOffsets.current.get(fxId) ?? 0;
                centers.set(fxId, {
                    left: (rect.left - contentRect.left) / z,
                    right: (rect.left - contentRect.left) / z + rect.width / z,
                    y: (rect.top - contentRect.top) / z + rect.height / z / 2 - applied,
                });
            });

            const offsets = new Map<number, number>();
            const paths: string[] = [];

            for (const round of rounds) {
                if (round <= 1) continue;
                for (const fx of fixturesByRound.get(round) ?? []) {
                    const prevRound = fixturesByRound.get(round - 1) ?? [];
                    const homeSrc = fx.fixtureOrder != null ? prevRound.find((f) => f.fixtureOrder === fx.fixtureOrder! * 2 - 1) : undefined;
                    const awaySrc = fx.fixtureOrder != null ? prevRound.find((f) => f.fixtureOrder === fx.fixtureOrder! * 2) : undefined;
                    const sources = [homeSrc, awaySrc].filter((s): s is TournamentFixtureDto => Boolean(s));
                    const sourceYs = sources.map((s) => {
                        const c = centers.get(s.id);
                        return c ? c.y + (offsets.get(s.id) ?? 0) : null;
                    }).filter((v): v is number => v != null);
                    const target = centers.get(fx.id);
                    if (!target) continue;
                    const targetY = sourceYs.length > 0 ? sourceYs.reduce((a, b) => a + b, 0) / sourceYs.length : target.y;
                    offsets.set(fx.id, targetY - target.y);
                }
            }

            for (const round of rounds) {
                if (round <= 1) continue;
                for (const fx of fixturesByRound.get(round) ?? []) {
                    const target = centers.get(fx.id);
                    if (!target) continue;
                    const prevRound = fixturesByRound.get(round - 1) ?? [];
                    const sources = [fx.fixtureOrder! * 2 - 1, fx.fixtureOrder! * 2]
                        .map((order) => prevRound.find((f) => f.fixtureOrder === order))
                        .filter((s): s is TournamentFixtureDto => Boolean(s));
                    const ty = target.y + (offsets.get(fx.id) ?? 0);
                    for (const src of sources) {
                        const c = centers.get(src.id);
                        if (!c) continue;
                        const sy = c.y + (offsets.get(src.id) ?? 0);
                        const midX = (c.right + target.left) / 2;
                        paths.push(`M ${c.right} ${sy} H ${midX} V ${ty} H ${target.left}`);
                    }
                }
            }

            let padTop = 0;
            let maxDown = 0;
            let maxBottom = 0;
            offsets.forEach((offset) => {
                padTop = Math.max(padTop, -offset);
                maxDown = Math.max(maxDown, offset);
            });
            centers.forEach((c) => {
                maxBottom = Math.max(maxBottom, c.y);
            });

            appliedOffsets.current = new Map(offsets);
            setGeometry({
                offsets,
                paths,
                padTop: padTop + 8,
                height: maxBottom + maxDown + 32,
                width: content.scrollWidth / z,
            });
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [fixtures, rounds, fixturesByRound, zoom]);

    const renderSquadRow = (fx: TournamentFixtureDto, slot: Slot) => {
        const entryId = slotEntryId(fx, slot);
        const entry = entryId != null ? entriesById.get(entryId) : undefined;
        const isLocked = (fx.roundNumber ?? 0) > 1;
        const dropKey = `${fx.id}:${slot}`;
        const isOver = dragOver === dropKey;
        const target = advanceTarget(fx);
        const score = slot === 'HOME' ? fx.homeScore : fx.awayScore;
        const isPrediction = (fx.roundNumber ?? 0) > 1 && fx.status === 'SCHEDULED' && fx.winnerEntryId == null;

        return (
            <div
                className={`grid grid-cols-[28px_minmax(0,1fr)_44px] items-center gap-2 ${
                    entry ? '' : 'rounded-lg border border-dashed border-white/20 bg-black px-1.5 py-1.5'
                } ${isOver ? 'border-[#16a34a] bg-[#16a34a]/10' : ''}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(dropKey);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(fx, slot);
                }}
            >
                {entry ? (
                    <>
                        <button
                            onClick={() => handleAdvance(fx, slot)}
                            disabled={isBusy || !target || !canManage}
                            title={t('tournaments.diagram.advance')}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-black text-[#a1a1aa] transition-colors hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-30"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <div
                            draggable={canManage && !isBusy}
                            onDragStart={(e) => {
                                setDrag({ kind: 'move', fixtureId: fx.id, slot });
                                setTransfer(e, `${fx.id}:${slot}`);
                            }}
                            onDragEnd={onDragEnd}
                            onClick={() => setSelectedEntry(entry)}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`flex min-w-0 items-center justify-between gap-1.5 rounded-lg border-2 bg-black px-2.5 py-1.5 transition-colors hover:bg-white/5 ${
                                isPrediction ? 'border-dashed border-amber-500/50' : 'border-white/10'
                            } ${
                                drag?.kind === 'move' && drag.fixtureId === fx.id && drag.slot === slot ? 'opacity-40' : ''
                            } ${isBusy ? 'cursor-wait' : canManage ? 'cursor-grab' : 'cursor-default'}`}
                            title={isPrediction ? t('tournaments.diagram.predictionHint') : t('tournaments.diagram.profileTitle')}
                        >
                            <div className="min-w-0 flex-1">
                                <span className="flex items-center truncate text-sm font-bold text-white">
                                    {entryPrimary(entry)}
                                    {fx.winnerEntryId === entryId && (
                                        <Trophy className="ml-1.5 inline-block h-3.5 w-3.5 shrink-0 text-amber-500" />
                                    )}
                                </span>
                                {entrySecondary(entry) && (
                                    <p className="truncate text-[11px] font-semibold text-[#a1a1aa]">{entrySecondary(entry)}</p>
                                )}
                            </div>
                            {canManage && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmRemove({ fixture: fx, slot });
                                    }}
                                    disabled={isBusy}
                                    title={t('tournaments.diagram.removeSlot')}
                                    className="shrink-0 text-[#a1a1aa] transition-colors hover:text-rose-400 disabled:opacity-40"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <span className={`text-right text-base font-black tabular-nums ${fx.status === 'COMPLETED' ? 'text-white' : 'text-[#71717a]'}`}>
                            {score != null ? score : '–'}
                        </span>
                    </>
                ) : (
                    <>
                        <span />
                        <span className={`truncate text-xs font-bold ${isLocked ? 'italic text-[#71717a]' : 'text-center text-[#71717a]'}`}>
                            {slotPlaceholder(fx, slot)}
                        </span>
                        <span className="text-right text-sm font-bold tabular-nums text-[#3f3f46]">–</span>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="border-b border-white/10 bg-black">
            {/* Message toast */}
            {message && (
                <div className={`border-b border-white/10 px-4 py-2.5 text-sm font-semibold ${
                    messageType === 'success'
                        ? 'bg-[#16a34a]/10 text-[#16a34a]'
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                }`}>
                    {message}
                </div>
            )}

            {/* Toolbar: zoom + create team + pan hint */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
                <div className="flex items-center gap-2">
                    {canManage && (
                        <button
                            onClick={() => {
                                setEditingTeamId(null);
                                setCreateTeamOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#16a34a] px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[#22c55e]"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {t('tournaments.diagram.createTeam')}
                        </button>
                    )}
                    <span className="hidden text-[11px] font-semibold text-[#71717a] md:block">
                        {t('tournaments.diagram.panHint')}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={() => setZoom((z) => clampZoom(z - 0.25))} disabled={zoom <= 0.5} className={iconBtn} title={t('tournaments.diagram.zoomOut')}>
                        <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-12 text-center text-xs font-bold tabular-nums text-white">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom((z) => clampZoom(z + 0.25))} disabled={zoom >= 1.75} className={iconBtn} title={t('tournaments.diagram.zoomIn')}>
                        <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Pannable canvas (no scrollbars) */}
            <div
                ref={canvasRef}
                className={`relative overflow-hidden ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{ touchAction: 'none' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
            >
                <div
                    className="min-w-max px-5"
                    style={{
                        paddingTop: geometry.padTop,
                        paddingBottom: 24,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'top left',
                    }}
                >
                    <div ref={contentRef} className="relative flex gap-10">
                        {/* Connector lines */}
                        <svg
                            className="pointer-events-none absolute inset-0"
                            width={geometry.width}
                            height={geometry.height}
                            aria-hidden="true"
                        >
                            {geometry.paths.map((d, i) => (
                                <path key={i} d={d} stroke="#ffffff2e" strokeWidth={2} fill="none" />
                            ))}
                        </svg>

                        {/* Teams-only pool */}
                        <div className="w-64 shrink-0">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                                {t('tournaments.diagram.unplaced')}
                                <span className="ml-2 text-[#71717a]">{poolEntries.length}</span>
                            </p>
                            <div className="mt-2 space-y-1.5">
                                {poolEntries.length === 0 ? (
                                    <p className="text-xs font-semibold text-[#71717a]">{t('tournaments.diagram.allPlaced')}</p>
                                ) : (
                                    poolEntries.map((entry) => (
                                        <div
                                            key={entry.id}
                                            draggable={canManage && !isBusy}
                                            onDragStart={(e) => {
                                                setDrag({ kind: 'entry', entryId: entry.id });
                                                setTransfer(e, String(entry.id));
                                            }}
                                            onDragEnd={onDragEnd}
                                            onClick={() => setSelectedEntry(entry)}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className={`rounded-lg border-2 border-white/10 bg-black px-3 py-2 transition-colors hover:bg-white/5 ${
                                                drag?.kind === 'entry' && drag.entryId === entry.id ? 'opacity-40' : ''
                                            } ${isBusy ? 'cursor-wait' : canManage ? 'cursor-grab' : 'cursor-default'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-sm font-bold text-white">
                                                    {entryPrimary(entry)}
                                                </span>
                                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${entryTypeTone(entry)}`}>
                                                    {entryTypeLabel(entry)}
                                                </span>
                                            </div>
                                            {entrySecondary(entry) && (
                                                <p className="mt-0.5 truncate text-[11px] font-semibold text-[#a1a1aa]">{entrySecondary(entry)}</p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* In preparation — teams being built, not draggable yet */}
                            {canManage && draftTeams.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#71717a]">
                                        {t('tournaments.diagram.preparing')}
                                    </p>
                                    <div className="mt-2 space-y-1.5">
                                        {draftTeams.map((team) => (
                                            <div
                                                key={team.id}
                                                className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-white/15 bg-black/60 px-3 py-2 opacity-80"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-[#a1a1aa]">{team.name}</p>
                                                    <p className="text-[11px] font-semibold text-[#71717a]">{team.memberCount} / 5</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setEditingTeamId(team.id);
                                                        setCreateTeamOpen(true);
                                                    }}
                                                    title={t('tournaments.diagram.editDraftTeam')}
                                                    className="shrink-0 text-[#71717a] transition-colors hover:text-[#16a34a]"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Round columns */}
                        {rounds.map((round) => (
                            <div key={round} className="shrink-0">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                                    {t('tournaments.bracket.round', { number: round })}
                                </p>
                                <div className="mt-2 space-y-4">
                                    {(fixturesByRound.get(round) ?? []).map((fx) => {
                                        const tone = fixtureStatusTone(fx.status);
                                        const isComplete = fx.status === 'COMPLETED';
                                        const isScheduled = fx.status === 'SCHEDULED';
                                        const offset = geometry.offsets.get(fx.id) ?? 0;
                                        return (
                                            <div
                                                key={fx.id}
                                                ref={(el) => {
                                                    if (el) cardRefs.current.set(fx.id, el);
                                                    else cardRefs.current.delete(fx.id);
                                                }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                className="w-[300px] rounded-lg border-2 border-white/15 bg-[#050607] p-2.5"
                                                style={{ transform: `translateY(${offset}px)` }}
                                            >
                                                {renderSquadRow(fx, 'HOME')}
                                                <div className="my-1.5 flex items-center justify-between gap-2 px-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-[#71717a]">
                                                            #{fx.fixtureOrder}
                                                        </span>
                                                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusToneBorder[tone] ?? statusToneBorder.neutral}`}>
                                                            {fx.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {(isScheduled || isComplete) && (
                                                            <button onClick={() => onEditScores(fx)} className={iconBtn} title="Edit scores">
                                                                <Edit3 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {isScheduled && fx.homeEntryId != null && fx.awayEntryId != null && canManage && (
                                                            <button onClick={() => onComplete(fx)} className={iconBtnDestructive} title="Force complete">
                                                                <Trophy className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {isComplete && canManage && (
                                                            <button onClick={() => onReopen(fx.id)} disabled={isBusy} className={iconBtn} title="Reopen fixture">
                                                                <Undo2 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        {!isComplete && fx.status !== 'CANCELLED' && canManage && (
                                                            <button onClick={() => onCancelFixture(fx.id)} disabled={isBusy} className={iconBtnDestructive} title="Cancel fixture">
                                                                <XCircle className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {renderSquadRow(fx, 'AWAY')}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Participant profile modal */}
            {selectedEntry && (
                <ParticipantProfileModal
                    entry={selectedEntry}
                    tournamentId={tournamentId}
                    onRefresh={onRefresh}
                    onClose={() => setSelectedEntry(null)}
                />
            )}

            {/* Create / edit team */}
            {createTeamOpen && (
                <CreateTeamModal
                    key={editingTeamId ?? 'new'}
                    tournamentId={tournamentId}
                    entries={tournament.entries ?? []}
                    teamId={editingTeamId}
                    onClose={() => {
                        setCreateTeamOpen(false);
                        setEditingTeamId(null);
                    }}
                    onRefresh={onRefresh}
                />
            )}

            {/* Slot removal confirmation */}
            <ConfirmDialog
                open={confirmRemove !== null}
                title={t('tournaments.diagram.removeSlot')}
                message={t('tournaments.diagram.confirmRemoveSlot')}
                variant="danger"
                confirmLabel={t('tournaments.diagram.removeSlot')}
                onCancel={() => setConfirmRemove(null)}
                onConfirm={() => void handleRemoveConfirmed()}
            />
        </div>
    );
};
