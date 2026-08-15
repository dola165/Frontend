import { Link } from 'react-router-dom';
import { MessageSquare, Megaphone, Radar, Zap } from 'lucide-react';
import { MiniMap } from '../MiniMap';

/**
 * Feed right rail. The top slot is a mock ad — an imitation to showcase that
 * this placement is reserved for sponsored content (WEB_APP_MASTER_PLAN.md §7,
 * monetization lane "ads"). No real advertiser, no tracking, dead CTA.
 */
export const RightSidebar = () => (
    <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--app-header-height)+12px)] flex flex-col gap-3">
            {/* Sponsored slot — mock ad */}
            <section className="overflow-hidden rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-card)]">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--feed-text-muted)]">
                        Sponsored
                    </p>
                    <Megaphone className="h-3.5 w-3.5 text-[var(--feed-text-muted)]" />
                </div>
                <div className="mx-3 rounded-lg border border-[var(--feed-card-border)] bg-gradient-to-br from-[#16a34a]/15 via-[var(--feed-layer-bg)] to-[#0f1117] px-4 py-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16a34a]">
                            <Zap className="h-4 w-4 text-white" />
                        </span>
                        <p className="text-sm font-bold tracking-tight text-[var(--feed-text-primary)]">VOLT Performance</p>
                    </div>
                    <p className="mt-2.5 text-sm font-semibold text-[var(--feed-text-primary)]">
                        Fuel the next 90 minutes.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--feed-text-muted)]">
                        Isotonic hydration built with grassroots clubs. Squad discount for every GrassKickZ team.
                    </p>
                    <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-[var(--feed-accent)] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        Learn More
                    </a>
                </div>
                <p className="px-4 pb-3 pt-2 text-[10px] text-[var(--feed-text-placeholder)]">
                    Ad · This slot is available for sponsors
                </p>
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
