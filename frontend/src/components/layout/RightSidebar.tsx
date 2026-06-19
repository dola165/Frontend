import { Link } from 'react-router-dom';
import { MessageSquare, Radar, Trophy } from 'lucide-react';
import { MiniMap } from '../MiniMap';

const trendingItems = [
    { label: '#ChampionsLeague Final', mentions: '12.4K posts' },
    { label: 'Kvaratskhelia transfer', mentions: '8.2K posts' },
    { label: 'U21 Scouting Spotlight', mentions: '5.1K posts' },
    { label: 'Dinamo Tbilisi — Cup Run', mentions: '3.6K posts' },
    { label: 'Grassroots Weekend Recap', mentions: '2.8K posts' }
];

const liveScores = [
    { home: 'FC Dinamo', away: 'Saburtalo', homeScore: 2, awayScore: 1, minute: "74'", live: true },
    { home: 'Torpedo', away: 'Locomotive', homeScore: 0, awayScore: 0, minute: "32'", live: true },
    { home: 'Dila Gori', away: 'Samgurali', homeScore: 1, awayScore: 2, minute: "FT", live: false }
];

export const RightSidebar = () => (
    <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--app-header-height)+12px)] flex flex-col gap-3">
            {/* Trending in Football */}
            <section className="overflow-hidden rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)]">
                <div className="flex items-center gap-2 border-b border-[var(--feed-card-border)] px-4 py-3">
                    <Trophy className="h-4 w-4 text-[var(--feed-accent)]" />
                    <p className="text-sm font-semibold text-[var(--feed-text-primary)]">Trending in Football</p>
                </div>
                <div className="divide-y divide-[var(--feed-divider)]">
                    {trendingItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--feed-hover-bg)]">
                            <span className="mt-0.5 text-sm font-bold text-[var(--feed-accent)]">{idx + 1}</span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[var(--feed-text-primary)]">{item.label}</p>
                                <p className="text-xs text-[var(--feed-text-muted)]">{item.mentions}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Live Scores */}
            <section className="overflow-hidden rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)]">
                <div className="flex items-center justify-between border-b border-[var(--feed-card-border)] px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-[var(--feed-accent)] animate-pulse" />
                        <p className="text-sm font-semibold text-[var(--feed-text-primary)]">Live Scores</p>
                    </div>
                    <span className="text-xs font-medium text-[var(--feed-text-muted)]">Georgia</span>
                </div>
                <div className="divide-y divide-[var(--feed-divider)]">
                    {liveScores.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-sm text-[var(--feed-text-muted)]">No live matches right now</p>
                            <p className="mt-1 text-xs text-[var(--feed-text-placeholder)]">Scores will appear during matchdays</p>
                        </div>
                    ) : (
                        liveScores.map((match, idx) => (
                            <div key={idx} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--feed-hover-bg)]">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-[var(--feed-text-primary)]">{match.home}</span>
                                        <span className="text-lg font-bold text-[var(--feed-text-primary)] tabular-nums">{match.homeScore} - {match.awayScore}</span>
                                        <span className="text-sm font-medium text-[var(--feed-text-primary)]">{match.away}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        {match.live && <span className="h-1.5 w-1.5 rounded-full bg-[var(--feed-accent)]" />}
                                        <span className={`text-xs font-medium ${match.live ? 'text-[var(--feed-accent)]' : 'text-[var(--feed-text-muted)]'}`}>{match.minute}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Map Integration */}
            <section className="overflow-hidden rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)]">
                <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--feed-text-primary)]">Local Scan</p>
                    <Radar className="h-4 w-4 text-[var(--feed-accent)]" />
                </div>
                <div className="overflow-hidden border-t border-[var(--feed-card-border)]">
                    <MiniMap />
                </div>
            </section>

            {/* Messages shortcut */}
            <section className="overflow-hidden rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)]">
                <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--feed-text-primary)]">Messages</p>
                    <Link to="/messages" className="text-xs font-medium text-[var(--feed-accent)] transition-colors hover:text-[var(--feed-accent-hover)]">
                        Open Inbox
                    </Link>
                </div>
                <div className="px-4 pb-4">
                    <Link
                        to="/messages"
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--feed-card-border)] bg-[var(--feed-layer-bg)] px-4 py-3 text-left transition-colors hover:border-[var(--feed-accent)]"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--feed-accent)]/10">
                            <MessageSquare className="h-4 w-4 text-[var(--feed-accent)]" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--feed-text-primary)]">View all conversations</p>
                            <p className="mt-0.5 text-xs text-[var(--feed-text-muted)]">Open your message inbox</p>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    </aside>
);
