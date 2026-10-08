import { MediaImage } from '../ui/MediaImage';
import { useState } from 'react';
import { avatarLetter } from './helpers';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface AvatarCellProps {
    avatarUrl?: string | null;
    fallback: string;
    size?: 'sm' | 'md';
}

const sizeClasses: Record<string, string> = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm'
};

// Google-style avatar colors — vibrant, distinct hues based on character code
const AVATAR_COLORS = [
    { bg: 'var(--color-inset)', text: 'var(--color-info)' }, // blue
    { bg: 'var(--color-inset)', text: 'var(--color-accent)' }, // green
    { bg: 'var(--color-inset)', text: 'var(--color-orange)' }, // orange
    { bg: 'var(--color-inset)', text: 'var(--color-danger)' }, // red
    { bg: 'var(--color-inset)', text: 'var(--color-purple)' }, // purple
    { bg: 'var(--color-inset)', text: 'var(--color-cyan)' }, // teal
    { bg: 'var(--color-inset)', text: 'var(--color-orange)' }, // amber
    { bg: 'var(--color-inset)', text: 'var(--color-info)' }, // indigo
];

const colorForName = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const AvatarCell = ({ avatarUrl, fallback, size = 'md' }: AvatarCellProps) => {
    const [imgError, setImgError] = useState(false);
    const palette = colorForName(fallback);
    const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);

    if (resolvedAvatarUrl && !imgError) {
        return (
            <MediaImage
                src={resolvedAvatarUrl}
                alt=""
                className={`${sizeClasses[size]} shrink-0 rounded-full object-cover`}
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <span
            className={`${sizeClasses[size]} flex shrink-0 items-center justify-center rounded-full font-semibold`}
            style={{ backgroundColor: palette.bg, color: palette.text }}
        >
            {avatarLetter(fallback)}
        </span>
    );
};
