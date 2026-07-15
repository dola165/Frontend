import type { LucideIcon } from 'lucide-react';

interface QuickLinkTileProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    badge?: number | string | null;
    onClick: () => void;
}

export const QuickLinkTile = ({ icon: Icon, title, subtitle, badge, onClick }: QuickLinkTileProps) => (
    <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3 text-left transition-colors hover:bg-[var(--fc-surface-hover)]"
    >
        <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fc-accent)]" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--fc-text-primary)]">{title}</p>
                <p className="mt-0.5 text-xs text-[var(--fc-text-secondary)]">{subtitle}</p>
            </div>
            {badge && (
                <span className="shrink-0 rounded-xl bg-[var(--fc-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--fc-accent)]">
                    {badge}
                </span>
            )}
        </div>
    </button>
);
