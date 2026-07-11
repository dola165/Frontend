import { AvatarCell } from './AvatarCell';

interface UserIdentityCellProps {
    avatarUrl?: string | null;
    fullName?: string | null;
    username?: string | null;
    userId?: number | null;
    subtitle?: string | null;
    size?: 'sm' | 'md';
}

export const UserIdentityCell = ({
    avatarUrl, fullName, username, userId, subtitle, size = 'md'
}: UserIdentityCellProps) => {
    const fallback = fullName || username || (userId ? `#${userId}` : '?');
    return (
        <div className="flex items-center gap-3">
            <AvatarCell avatarUrl={avatarUrl} fallback={fallback} size={size} />
            <div>
                <p className="text-sm font-semibold text-[var(--fc-text-primary)]">
                    {fullName || username || (userId ? `User #${userId}` : 'Unknown')}
                </p>
                {username && (
                    <p className="text-xs text-[var(--fc-text-muted)]">
                        @{username}
                    </p>
                )}
                {subtitle && (
                    <p className="text-xs text-[var(--fc-text-secondary)]">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
};
