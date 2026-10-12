import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { avatarHue } from '../../design/avatarHue';

const initials = (name: string) => name.trim().split(/\s+/).filter(part => /^[\p{L}\p{N}]/u.test(part)).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';

/** A club, venue or person image in the avatar shape; protected media loads with the session. */
export function Crest({ src, name, size = 44, round = false }: { src?: string | null; name: string; size?: number; round?: boolean }) {
    const url = resolveMediaUrl(src);
    return (
        <span className={`gk-avatar${round ? '' : ' gk-avatar--square'}`} data-hue={url ? undefined : avatarHue(name)} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
            {url ? <MediaImage src={url} alt="" loading="lazy" /> : initials(name)}
        </span>
    );
}
