import { useState } from 'react';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { avatarHue } from '../../design/avatarHue';

const initials = (name: string) => name.trim().split(/\s+/).filter(part => /^[\p{L}\p{N}]/u.test(part)).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';

/**
 * A club, venue or person image in the avatar shape; protected media loads with the session. An image that does not
 * load gives way to the initials, never a broken picture.
 */
export function Crest({ src, name, size = 44, round = false }: { src?: string | null; name: string; size?: number; round?: boolean }) {
    const url = resolveMediaUrl(src);
    const [failed, setFailed] = useState<string | null>(null);
    const shown = url && url !== failed ? url : null;
    return (
        <span className={`gk-avatar${round ? '' : ' gk-avatar--square'}`} data-hue={shown ? undefined : avatarHue(name)} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
            {shown ? <MediaImage src={shown} alt="" loading="lazy" onError={() => setFailed(shown)} /> : initials(name)}
        </span>
    );
}
