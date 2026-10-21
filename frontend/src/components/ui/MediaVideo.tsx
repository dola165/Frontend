import type { VideoHTMLAttributes } from 'react';
import { useMediaSource } from '../../hooks/useMediaSource';

/** Mount only for the selected video. Protected clips use the same account scope and cleanup as photos. */
export function MediaVideo({ src, ...props }: VideoHTMLAttributes<HTMLVideoElement>) {
    const resolved = useMediaSource(src);
    return <video {...props} src={resolved} />;
}
