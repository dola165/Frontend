import { Earth } from 'lucide-react';
import './world-brand.css';

/** GrassKickZ World's mark: the top bar's globe on the brand green, with the brand's ball as its badge. */
export function WorldMark({ size = 36 }: { size?: number }) {
    return <span className="gk-world-mark" style={{ width: size, height: size }} aria-hidden="true">
        <Earth style={{ width: size * 0.56, height: size * 0.56 }} />
    </span>;
}
