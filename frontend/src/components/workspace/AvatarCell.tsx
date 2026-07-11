import { useState } from 'react';
import { avatarLetter } from './helpers';

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
    { bg: '#e3f2fd', text: '#1565c0' }, // blue
    { bg: '#e8f5e9', text: '#2e7d32' }, // green
    { bg: '#fff3e0', text: '#e65100' }, // orange
    { bg: '#fce4ec', text: '#c62828' }, // red
    { bg: '#f3e5f5', text: '#6a1b9a' }, // purple
    { bg: '#e0f7fa', text: '#00838f' }, // teal
    { bg: '#fff8e1', text: '#f9a825' }, // amber
    { bg: '#e8eaf6', text: '#283593' }, // indigo
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

    if (avatarUrl && !imgError) {
        return (
            <img
                src={avatarUrl}
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
